"""
Journey planning endpoint.
Computes multi-leg itineraries with transfers, walking connections, and fare estimates.
"""

from fastapi import APIRouter, HTTPException
from backend.app.routing import get_router
from backend.app.schemas.transit import TripPlanRequest, TripPlanResponse
from backend.app.ml.delay_predictor import get_delay_predictor

router = APIRouter(prefix="/api/plan", tags=["Journey Planner"])

@router.post("", response_model=TripPlanResponse)
def plan_journey(request: TripPlanRequest):
    """
    Plan a transit journey between origin and destination coordinates.
    Returns multi-leg routes (Bus, Metro, Suburban Rail, Walk), transfer points, polyline geometry,
    Indian transit fare estimates, and AI arrival delay predictions based on weather and Chennai corridor risks.
    """
    try:
        router_engine = get_router()
        resp = router_engine.plan_trip(request)

        predictor = get_delay_predictor()
        weather = request.weather or "clear"

        for itin in resp.itineraries:
            itin.weather_condition = weather
            total_delay = 0
            monsoon_alert = None

            for leg in itin.legs:
                if leg.route_id:
                    # Determine route type: 1=Metro, 2=Rail, 3=Bus
                    r_type = 3
                    if leg.mode == "METRO":
                        r_type = 1
                    elif leg.mode in ["SUBURBAN_RAIL", "RAIL"]:
                        r_type = 2

                    pred = predictor.predict(
                        route_id=leg.route_id,
                        route_type=r_type,
                        departure_time=leg.departure_time,
                        weather=weather,
                    )

                    leg.predicted_delay_minutes = pred["predicted_delay_minutes"]
                    leg.weather_risk = pred["risk_level"]
                    leg.advisory_en = pred["advisory_en"]
                    leg.advisory_ta = pred["advisory_ta"]
                    total_delay += pred["predicted_delay_minutes"]

                    if pred["is_waterlogging_prone"] and weather == "monsoon":
                        monsoon_alert = pred["advisory_en"]

            itin.predicted_delay_minutes = total_delay
            itin.monsoon_warning = monsoon_alert

            # Evaluate Wheelchair Accessibility
            # CMRL Metro stations are 100% accessible with dual elevators, level boarding, and tactile pavers
            all_legs_accessible = True
            has_metro = False
            for leg in itin.legs:
                if leg.mode == "METRO":
                    leg.is_wheelchair_accessible = True
                    leg.accessibility_notes = "Elevators, escalators & level platform boarding"
                    has_metro = True
                elif leg.mode in ("AUTO", "TAXI"):
                    leg.is_wheelchair_accessible = True
                    leg.accessibility_notes = "Curb-to-curb direct vehicle transfer"
                elif leg.mode == "WALK":
                    leg.is_wheelchair_accessible = leg.distance_meters <= 800
                    leg.accessibility_notes = "Paved street pedestrian access"
                elif leg.mode == "BUS":
                    # MTC AC / modern low-floor buses (e.g. 29C, 18A)
                    is_lowfloor = any(k in (leg.route_short_name or "") for k in ("29C", "18A", "MTC"))
                    leg.is_wheelchair_accessible = is_lowfloor
                    leg.accessibility_notes = "Low-floor boarding entrance" if is_lowfloor else "High-step entry (assistance advised)"
                else:
                    leg.is_wheelchair_accessible = True

                if not leg.is_wheelchair_accessible:
                    all_legs_accessible = False

            itin.is_wheelchair_accessible = all_legs_accessible
            if has_metro and all_legs_accessible:
                itin.accessibility_notes = "100% Step-Free Route (CMRL Elevators & Station Ramps)"
            elif all_legs_accessible:
                itin.accessibility_notes = "Wheelchair Accessible Journey"
            else:
                itin.accessibility_notes = "Standard Transit Access (Steps on bus/rail)"

        # If user explicitly requested wheelchair-accessible routes, prioritize accessible itineraries first
        if request.wheelchair_accessible:
            resp.itineraries.sort(
                key=lambda it: (0 if it.is_wheelchair_accessible else 1, it.duration_minutes)
            )

        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Journey planning failed: {str(e)}")
