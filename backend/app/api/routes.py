"""
Transit routes endpoint.
Provides route listings, ordered stop sequences, and map polylines.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import Route, Trip, StopTime, Stop, ShapePoint
from backend.app.schemas.transit import RouteSummary, StopBase

router = APIRouter(prefix="/api/routes", tags=["Routes"])

@router.get("", response_model=List[RouteSummary])
def list_routes(db: Session = Depends(get_db)):
    """List all available bus and metro routes in the transit network."""
    routes = db.query(Route).all()
    return [
        RouteSummary(
            route_id=r.route_id,
            agency_id=r.agency_id,
            route_short_name=r.route_short_name,
            route_long_name=r.route_long_name,
            route_type=r.route_type,
            route_color=r.route_color or "0066CC",
            route_text_color=r.route_text_color or "FFFFFF",
        )
        for r in routes
    ]

@router.get("/{route_id}", response_model=Dict[str, Any])
def get_route_details(route_id: str, db: Session = Depends(get_db)):
    """
    Get detailed route information, ordered stop sequence, and map polyline.
    """
    route = db.query(Route).filter(Route.route_id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail=f"Route '{route_id}' not found.")

    # Find a representative trip for direction 0 and direction 1
    trips_dir0 = db.query(Trip).filter(Trip.route_id == route_id, Trip.direction_id == 0).first()
    trips_dir1 = db.query(Trip).filter(Trip.route_id == route_id, Trip.direction_id == 1).first()

    def get_stops_for_trip(trip: Trip) -> List[Dict[str, Any]]:
        if not trip:
            return []
        st_rows = (
            db.query(StopTime, Stop)
            .join(Stop, Stop.stop_id == StopTime.stop_id)
            .filter(StopTime.trip_id == trip.trip_id)
            .order_by(StopTime.stop_sequence)
            .all()
        )
        return [
            {
                "stop_id": s.stop_id,
                "stop_code": s.stop_code,
                "stop_name": s.stop_name,
                "stop_name_en": s.stop_name_en,
                "stop_name_ta": s.stop_name_ta,
                "stop_lat": s.stop_lat,
                "stop_lon": s.stop_lon,
                "sequence": st.stop_sequence,
                "arrival_time": st.arrival_time,
                "departure_time": st.departure_time,
            }
            for st, s in st_rows
        ]

    stops_fwd = get_stops_for_trip(trips_dir0)
    stops_rev = get_stops_for_trip(trips_dir1)

    # Get polyline coordinates
    polyline = []
    shape_id = trips_dir0.shape_id if trips_dir0 else None
    if shape_id:
        shapes = (
            db.query(ShapePoint)
            .filter(ShapePoint.shape_id == shape_id)
            .order_by(ShapePoint.shape_pt_sequence)
            .all()
        )
        polyline = [[sp.shape_pt_lat, sp.shape_pt_lon] for sp in shapes]

    if not polyline and stops_fwd:
        polyline = [[s["stop_lat"], s["stop_lon"]] for s in stops_fwd]

    return {
        "route_id": route.route_id,
        "agency_id": route.agency_id,
        "route_short_name": route.route_short_name,
        "route_long_name": route.route_long_name,
        "route_type": route.route_type,
        "mode": "METRO" if route.route_type == 1 else "SUBURBAN_RAIL" if route.route_type == 2 else "BUS",
        "route_color": route.route_color or "0066CC",
        "route_text_color": route.route_text_color or "FFFFFF",
        "polyline": polyline,
        "direction_0": {
            "headsign": trips_dir0.trip_headsign if trips_dir0 else "",
            "stops_count": len(stops_fwd),
            "stops": stops_fwd,
        },
        "direction_1": {
            "headsign": trips_dir1.trip_headsign if trips_dir1 else "",
            "stops_count": len(stops_rev),
            "stops": stops_rev,
        },
    }
