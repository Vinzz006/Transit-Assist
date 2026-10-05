"""
Next arrivals / departures endpoint for any transit stop.
Returns upcoming scheduled arrivals, line badges, headsign, and ETA in minutes.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.db.database import get_db
from backend.app.db.models import Stop, StopTime, Trip, Route
from backend.app.ml.predictive_arrivals import get_predictive_arrivals_engine
from backend.app.ml.evaluate_predictions import run_evaluation
from backend.app.schemas.transit import NextArrival
from data.clean_gtfs import parse_time_to_seconds

router = APIRouter(prefix="/api/arrivals", tags=["Arrivals"])

@router.get("", response_model=List[NextArrival])
def get_next_arrivals(
    stop_id: str = Query(..., description="ID of the transit stop"),
    time: Optional[str] = Query(None, description="Current time in HH:MM:SS format"),
    limit: int = Query(10, ge=1, le=50),
    predictive: Optional[bool] = Query(None, description="Explicit override for predictive arrival estimation"),
    db: Session = Depends(get_db),
):
    """
    Get upcoming departures for a given stop.
    When predictive arrivals is enabled (Phase 15), fuses crowdsourced reports,
    mode priors, and time-of-day traffic distributions to estimate realistic arrival times.
    """
    stop = db.query(Stop).filter(Stop.stop_id == stop_id).first()
    if not stop:
        raise HTTPException(status_code=404, detail=f"Stop '{stop_id}' not found.")

    query_sec = parse_time_to_seconds(time) if time else None
    if query_sec is None:
        # Default to 08:30:00 morning peak
        query_sec = 8 * 3600 + 30 * 60

    # Query departures at or after query_sec
    upcoming = (
        db.query(StopTime, Trip, Route)
        .join(Trip, Trip.trip_id == StopTime.trip_id)
        .join(Route, Route.route_id == Trip.route_id)
        .filter(
            StopTime.stop_id == stop_id,
            StopTime.departure_seconds >= query_sec,
        )
        .order_by(StopTime.departure_seconds)
        .limit(limit)
        .all()
    )

    # Wrap around to start of day if late night and fewer than limit
    if len(upcoming) < limit:
        wrap_needed = limit - len(upcoming)
        wrap_around = (
            db.query(StopTime, Trip, Route)
            .join(Trip, Trip.trip_id == StopTime.trip_id)
            .join(Route, Route.route_id == Trip.route_id)
            .filter(
                StopTime.stop_id == stop_id,
                StopTime.departure_seconds < query_sec,
            )
            .order_by(StopTime.departure_seconds)
            .limit(wrap_needed)
            .all()
        )
        upcoming.extend(wrap_around)

    # Determine whether predictive arrivals should be applied
    use_predictions = (
        predictive if predictive is not None else settings.enable_predictive_arrivals
    )
    pred_engine = get_predictive_arrivals_engine() if use_predictions else None

    results = []
    for st, tr, rt in upcoming:
        dep_sec = st.departure_seconds
        # Calculate raw schedule ETA
        if dep_sec >= query_sec:
            diff_sec = dep_sec - query_sec
        else:
            diff_sec = (dep_sec + 86400) - query_sec
        sched_eta_min = int(diff_sec / 60)

        if use_predictions and pred_engine:
            est = pred_engine.estimate_arrival(
                route_id=rt.route_id,
                route_type=rt.route_type,
                scheduled_departure_time=st.departure_time,
                scheduled_departure_seconds=dep_sec,
                query_seconds=query_sec,
                db=db,
                stop_id=stop_id,
            )
            results.append(
                NextArrival(
                    trip_id=tr.trip_id,
                    route_id=rt.route_id,
                    route_short_name=rt.route_short_name,
                    route_long_name=rt.route_long_name,
                    route_type=rt.route_type,
                    route_color=rt.route_color or "0066CC",
                    headsign=tr.trip_headsign or rt.route_long_name,
                    departure_time=est["predicted_time"],
                    departure_seconds=est["predicted_seconds"],
                    eta_minutes=est["predicted_eta_minutes"],
                    is_realtime=False,
                    scheduled_departure_time=st.departure_time,
                    scheduled_departure_seconds=dep_sec,
                    predicted_departure_time=est["predicted_time"],
                    predicted_departure_seconds=est["predicted_seconds"],
                    predicted_delay_minutes=est["predicted_delay_minutes"],
                    confidence_level=est["confidence_level"],
                    confidence_score=est["confidence_score"],
                    data_basis=est["data_basis"],
                    is_predicted=True,
                )
            )
        else:
            results.append(
                NextArrival(
                    trip_id=tr.trip_id,
                    route_id=rt.route_id,
                    route_short_name=rt.route_short_name,
                    route_long_name=rt.route_long_name,
                    route_type=rt.route_type,
                    route_color=rt.route_color or "0066CC",
                    headsign=tr.trip_headsign or rt.route_long_name,
                    departure_time=st.departure_time,
                    departure_seconds=dep_sec,
                    eta_minutes=sched_eta_min,
                    is_realtime=False,
                    scheduled_departure_time=st.departure_time,
                    scheduled_departure_seconds=dep_sec,
                    predicted_departure_time=st.departure_time,
                    predicted_departure_seconds=dep_sec,
                    predicted_delay_minutes=0,
                    confidence_level="LOW",
                    confidence_score=0.0,
                    data_basis="Raw timetable schedule (prediction disabled)",
                    is_predicted=False,
                )
            )

    return results

@router.get("/evaluation", response_model=Dict[str, Any])
def get_prediction_evaluation():
    """
    Public empirical evaluation benchmark for predictive arrival delays.
    Compares the statistical rolling average delay model against raw timetable schedule
    on held-out historical ground truth data.
    """
    return run_evaluation()

