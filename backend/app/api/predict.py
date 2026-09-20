"""
FastAPI REST router for Predictive AI Delay & Monsoon Congestion Intelligence.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import Route
from backend.app.ml.delay_predictor import get_delay_predictor
from backend.app.schemas.predict import (
    DelayPredictionResponse,
    CorridorSummaryResponse,
    CorridorRiskItem,
)

router = APIRouter(prefix="/api/predict", tags=["Predictive Analytics"])

@router.get("/delay", response_model=DelayPredictionResponse)
def predict_delay(
    route_id: str = Query(..., description="Route ID (e.g. CMRL_BLUE, MTC_29C, SR_MRTS)"),
    departure_time: Optional[str] = Query("08:30:00", description="Departure time in HH:MM:SS"),
    weather: Optional[str] = Query("clear", description="Weather condition: clear, rain, monsoon"),
    db: Session = Depends(get_db),
):
    """
    Get AI-predicted arrival delay, confidence score, and bilingual commuter advisory
    based on transit mode (Metro/Bus/Rail), Chennai corridor characteristics, and monsoon flood alerts.
    """
    route = db.query(Route).filter(Route.route_id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail=f"Route '{route_id}' not found.")

    predictor = get_delay_predictor()
    result = predictor.predict(
        route_id=route.route_id,
        route_type=route.route_type,
        departure_time=departure_time,
        weather=weather or "clear",
    )

    mode_name = (
        "Metro"
        if route.route_type == 1
        else "Suburban Rail"
        if route.route_type == 2
        else "Bus"
    )

    return DelayPredictionResponse(
        route_id=route.route_id,
        route_short_name=route.route_short_name,
        mode=mode_name,
        weather=result["weather"],
        predicted_delay_minutes=result["predicted_delay_minutes"],
        confidence_score=result["confidence_score"],
        risk_level=result["risk_level"],
        corridor_name=result["corridor_name"],
        is_waterlogging_prone=result["is_waterlogging_prone"],
        advisory_en=result["advisory_en"],
        advisory_ta=result["advisory_ta"],
    )

@router.get("/corridors", response_model=CorridorSummaryResponse)
def get_corridors_summary(
    weather: Optional[str] = Query("clear", description="Weather condition: clear, rain, monsoon"),
):
    """
    Get active Chennai transit corridors with historical peak delays, monsoon flood risk, and commuter guidance.
    """
    predictor = get_delay_predictor()
    corridors = predictor.get_corridors_summary(weather=weather or "clear")
    items = [CorridorRiskItem(**c) for c in corridors]
    return CorridorSummaryResponse(
        weather=weather or "clear",
        active_corridors_count=len(items),
        corridors=items,
    )
