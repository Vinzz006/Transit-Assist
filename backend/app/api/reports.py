"""
API Router for Crowdsourced Crowding & Delay Reports.
Allows commuters to report and query real-time vehicle crowding and delays.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import TransitReport, Route
from backend.app.schemas.reports import (
    ReportCreateRequest,
    ReportItem,
    RouteCrowdSummary,
)

router = APIRouter(prefix="/api/reports", tags=["Crowdsource Reports"])

def _get_status_label(crowd_level: str) -> str:
    if crowd_level == "packed":
        return "Heavily Crowded"
    elif crowd_level == "moderate":
        return "Standing Room Only"
    return "Seats Available"

@router.post("", response_model=ReportItem, status_code=201)
def submit_report(payload: ReportCreateRequest, db: Session = Depends(get_db)):
    """
    Submit a crowdsourced report for vehicle crowding or service delays.
    crowd_level must be 'low', 'moderate', or 'packed'.
    """
    route = db.query(Route).filter(Route.route_id == payload.route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail=f"Route '{payload.route_id}' not found.")

    now_iso = datetime.now(timezone.utc).isoformat()
    report = TransitReport(
        route_id=payload.route_id,
        stop_id=payload.stop_id,
        crowd_level=payload.crowd_level.lower(),
        delay_minutes=payload.delay_minutes,
        comment=payload.comment,
        created_at=now_iso,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return ReportItem(
        id=report.id,
        route_id=report.route_id,
        stop_id=report.stop_id,
        crowd_level=report.crowd_level,
        delay_minutes=report.delay_minutes,
        comment=report.comment,
        created_at=report.created_at,
    )

@router.get("", response_model=List[ReportItem])
def get_reports(
    route_id: Optional[str] = None,
    stop_id: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get the latest crowdsourced reports, optionally filtered by route or stop."""
    query = db.query(TransitReport)
    if route_id:
        query = query.filter(TransitReport.route_id == route_id)
    if stop_id:
        query = query.filter(TransitReport.stop_id == stop_id)

    reports = query.order_by(TransitReport.id.desc()).limit(limit).all()
    return [
        ReportItem(
            id=r.id,
            route_id=r.route_id,
            stop_id=r.stop_id,
            crowd_level=r.crowd_level,
            delay_minutes=r.delay_minutes,
            comment=r.comment,
            created_at=r.created_at,
        )
        for r in reports
    ]

@router.get("/summary/{route_id}", response_model=RouteCrowdSummary)
def get_route_crowd_summary(route_id: str, db: Session = Depends(get_db)):
    """
    Get aggregated consensus crowd level and delay statistics for a route.
    """
    reports = (
        db.query(TransitReport)
        .filter(TransitReport.route_id == route_id)
        .order_by(TransitReport.id.desc())
        .limit(30)
        .all()
    )

    if not reports:
        # Default consensus for routes with no reports
        return RouteCrowdSummary(
            route_id=route_id,
            total_reports=0,
            crowd_level="moderate",
            average_delay_minutes=0.0,
            status_label="Normal Frequency",
            latest_reports=[],
        )

    crowd_counts = {"low": 0, "moderate": 0, "packed": 0}
    total_delay = 0

    for r in reports:
        crowd_counts[r.crowd_level] = crowd_counts.get(r.crowd_level, 0) + 1
        total_delay += r.delay_minutes

    majority_crowd = max(crowd_counts, key=crowd_counts.get)
    avg_delay = round(total_delay / len(reports), 1)

    return RouteCrowdSummary(
        route_id=route_id,
        total_reports=len(reports),
        crowd_level=majority_crowd,
        average_delay_minutes=avg_delay,
        status_label=_get_status_label(majority_crowd),
        latest_reports=[
            ReportItem(
                id=r.id,
                route_id=r.route_id,
                stop_id=r.stop_id,
                crowd_level=r.crowd_level,
                delay_minutes=r.delay_minutes,
                comment=r.comment,
                created_at=r.created_at,
            )
            for r in reports[:5]
        ],
    )
