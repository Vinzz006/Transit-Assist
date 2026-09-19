"""
Journey planning endpoint.
Computes multi-leg itineraries with transfers, walking connections, and fare estimates.
"""

from fastapi import APIRouter, HTTPException
from backend.app.routing import get_router
from backend.app.schemas.transit import TripPlanRequest, TripPlanResponse

router = APIRouter(prefix="/api/plan", tags=["Journey Planner"])

@router.post("", response_model=TripPlanResponse)
def plan_journey(request: TripPlanRequest):
    """
    Plan a transit journey between origin and destination coordinates.
    Returns multi-leg routes (Bus, Metro, Walk), transfer points, polyline geometry,
    and Indian transit fare estimates (standard and female concessions).
    """
    try:
        router_engine = get_router()
        return router_engine.plan_trip(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Journey planning failed: {str(e)}")
