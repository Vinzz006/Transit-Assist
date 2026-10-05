"""
Statistical Rolling-Average Arrival Delay & Prediction Engine.
Fuses crowdsourced transit reports, GTFS-RT vehicle telemetry, and time-of-day
corridor distributions to produce realistic arrival times with transparent confidence scores.
Follows DPDP Act 2023 principles (zero personal data, purely aggregated transit telemetry).
"""

import math
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session

from backend.app.db.models import TransitReport, Route, StopTime
from data.clean_gtfs import parse_time_to_seconds, format_seconds_to_time

# Time-of-day buckets for commute traffic patterns
TIME_BUCKETS = {
    "early_morning": (18000, 28800),   # 05:00 - 08:00
    "morning_peak": (28800, 39600),    # 08:00 - 11:00
    "midday_slack": (39600, 57600),    # 11:00 - 16:00
    "evening_peak": (57600, 73800),    # 16:00 - 20:30
    "night_offpeak": (73800, 86400),   # 20:30 - 24:00 (also 00:00 - 05:00)
}

def get_time_bucket(time_sec: int) -> str:
    """Return the time-of-day bucket for a given seconds-from-midnight timestamp."""
    sec = time_sec % 86400
    if sec < 18000:
        return "night_offpeak"
    for bucket_name, (start_sec, end_sec) in TIME_BUCKETS.items():
        if start_sec <= sec < end_sec:
            return bucket_name
    return "midday_slack"

# Mode-specific empirical delay priors (minutes) by time bucket
MODE_PRIORS: Dict[int, Dict[str, Tuple[float, float]]] = {
    # route_type 1: Metro (CMRL) - High punctuality, grade-separated viaducts
    1: {
        "early_morning": (0.2, 0.3),
        "morning_peak": (0.8, 0.5),
        "midday_slack": (0.4, 0.4),
        "evening_peak": (1.0, 0.6),
        "night_offpeak": (0.3, 0.3),
    },
    # route_type 2: Suburban Rail (SR / MRTS) - Dedicated rail right-of-way
    2: {
        "early_morning": (1.5, 1.0),
        "morning_peak": (4.2, 2.0),
        "midday_slack": (2.0, 1.2),
        "evening_peak": (4.8, 2.2),
        "night_offpeak": (1.8, 1.0),
    },
    # route_type 3: City Bus (MTC) - Road traffic, signal stops, congestion
    3: {
        "early_morning": (2.0, 1.5),
        "morning_peak": (8.5, 3.5),
        "midday_slack": (4.0, 2.0),
        "evening_peak": (9.8, 4.0),
        "night_offpeak": (2.5, 1.5),
    },
}

class PredictiveArrivalsEngine:
    """
    Empirical statistical model for arrival delay prediction.
    Calculates rolling weighted average delays and assigns an explainable confidence level.
    """

    def __init__(self, decay_rate_per_hour: float = 0.5):
        self.decay_rate = decay_rate_per_hour

    def _get_time_decay_weight(self, report_iso: str, current_dt: datetime) -> float:
        """Calculate exponential freshness decay weight for a crowdsourced report."""
        try:
            # Parse ISO timestamp
            rep_dt = datetime.fromisoformat(report_iso.replace("Z", "+00:00"))
            if rep_dt.tzinfo is None:
                rep_dt = rep_dt.replace(tzinfo=timezone.utc)
            delta_hours = max(0.0, (current_dt - rep_dt).total_seconds() / 3600.0)
            # e^(-lambda * dt)
            return math.exp(-self.decay_rate * delta_hours)
        except Exception:
            return 0.5

    def estimate_arrival(
        self,
        route_id: str,
        route_type: int,
        scheduled_departure_time: str,
        scheduled_departure_seconds: int,
        query_seconds: int,
        db: Session,
        stop_id: Optional[str] = None,
        realtime_delay_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Estimate realistic arrival time, predicted delay minutes, confidence, and basis.
        """
        time_bucket = get_time_bucket(scheduled_departure_seconds)
        mode_prior_mean, mode_prior_std = MODE_PRIORS.get(
            route_type, MODE_PRIORS[3]
        ).get(time_bucket, (4.0, 2.5))

        # Query recent crowd reports for this route
        recent_reports = (
            db.query(TransitReport)
            .filter(TransitReport.route_id == route_id)
            .order_by(TransitReport.id.desc())
            .limit(20)
            .all()
        )

        now_utc = datetime.now(timezone.utc)

        # Weighted calculation
        total_weight = 0.0
        weighted_delay_sum = 0.0
        valid_reports_count = 0

        # Prior distribution weight (regularizer against overfitting on 1 outlier report)
        prior_weight = 2.0
        total_weight += prior_weight
        weighted_delay_sum += prior_weight * mode_prior_mean

        # Add live GTFS-RT telemetry weight if available
        has_realtime_gps = False
        if realtime_delay_seconds is not None:
            has_realtime_gps = True
            rt_weight = 5.0  # High trust in live telemetry
            rt_delay_min = realtime_delay_seconds / 60.0
            total_weight += rt_weight
            weighted_delay_sum += rt_weight * rt_delay_min

        # Add crowd reports with exponential freshness decay
        for r in recent_reports:
            w = self._get_time_decay_weight(r.created_at, now_utc)
            # Give higher weight to reports matching this specific stop
            if stop_id and r.stop_id == stop_id:
                w *= 1.5

            total_weight += w
            weighted_delay_sum += w * float(r.delay_minutes)
            valid_reports_count += 1

        # Estimated delay in minutes
        predicted_delay_min = max(0, int(round(weighted_delay_sum / total_weight)))

        # Confidence calculation
        # Confidence increases with:
        # 1. Presence of real-time GPS telemetry (+0.35)
        # 2. Number of recent crowd reports (+0.08 per report, max +0.40)
        # 3. Base model prior (+0.25)
        base_confidence = 0.30
        if has_realtime_gps:
            base_confidence += 0.40
        reports_boost = min(0.35, valid_reports_count * 0.07)
        confidence_score = min(0.98, base_confidence + reports_boost)

        # Confidence level categorisation
        if confidence_score >= 0.75:
            confidence_level = "HIGH"
        elif confidence_score >= 0.50:
            confidence_level = "MEDIUM"
        else:
            confidence_level = "LOW"

        # Calculate predicted departure seconds & time string
        predicted_dep_seconds = (scheduled_departure_seconds + (predicted_delay_min * 60)) % 86400
        predicted_departure_time = format_seconds_to_time(predicted_dep_seconds)

        # Recalculate ETA minutes from query_seconds
        if predicted_dep_seconds >= query_seconds:
            eta_diff = predicted_dep_seconds - query_seconds
        else:
            eta_diff = (predicted_dep_seconds + 86400) - query_seconds
        predicted_eta_minutes = int(eta_diff / 60)

        # Build transparent basis description
        if has_realtime_gps and valid_reports_count > 0:
            data_basis = (
                f"Fuses live GPS vehicle telemetry & {valid_reports_count} recent commuter report(s) "
                f"for {time_bucket.replace('_', ' ')}."
            )
        elif has_realtime_gps:
            data_basis = f"Based on live GPS vehicle telemetry for {time_bucket.replace('_', ' ')}."
        elif valid_reports_count > 0:
            data_basis = (
                f"Statistical rolling average from {valid_reports_count} recent commuter report(s) "
                f"and historical {time_bucket.replace('_', ' ')} baseline."
            )
        else:
            data_basis = (
                f"Historical corridor schedule baseline for {time_bucket.replace('_', ' ')} "
                "(limited real-time data)."
            )

        return {
            "scheduled_time": scheduled_departure_time,
            "scheduled_seconds": scheduled_departure_seconds,
            "predicted_time": predicted_departure_time,
            "predicted_seconds": predicted_dep_seconds,
            "predicted_delay_minutes": predicted_delay_min,
            "predicted_eta_minutes": predicted_eta_minutes,
            "confidence_level": confidence_level,
            "confidence_score": round(confidence_score, 2),
            "data_basis": data_basis,
            "is_predicted": True,
        }

_predictive_engine_instance = None

def get_predictive_arrivals_engine() -> PredictiveArrivalsEngine:
    global _predictive_engine_instance
    if _predictive_engine_instance is None:
        _predictive_engine_instance = PredictiveArrivalsEngine()
    return _predictive_engine_instance
