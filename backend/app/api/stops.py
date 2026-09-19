"""
Stop search and spatial proximity endpoints.
Supports bilingual search (English + Tamil) and nearby stop discovery.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.db.database import get_db
from backend.app.db.models import Stop, StopTime, Trip, Route
from backend.app.routing.raptor import haversine_distance
from backend.app.schemas.transit import StopBase, StopDetail

router = APIRouter(prefix="/api/stops", tags=["Stops"])

@router.get("", response_model=List[StopDetail])
def search_stops(
    q: Optional[str] = Query(None, description="Search query in English or Tamil"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Search stops with prefix/substring matching across English and Tamil names.
    If 'q' is omitted, returns the first 'limit' stops.
    """
    query = db.query(Stop)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Stop.stop_name.ilike(term),
                Stop.stop_name_en.ilike(term),
                Stop.stop_name_ta.ilike(term),
                Stop.stop_code.ilike(term),
                Stop.stop_id.ilike(term),
            )
        )

    stops = query.limit(limit).all()

    # Enrich with distinct routes count
    results = []
    for s in stops:
        routes_count = (
            db.query(Route.route_id)
            .join(Trip, Trip.route_id == Route.route_id)
            .join(StopTime, StopTime.trip_id == Trip.trip_id)
            .filter(StopTime.stop_id == s.stop_id)
            .distinct()
            .count()
        )
        results.append(
            StopDetail(
                stop_id=s.stop_id,
                stop_code=s.stop_code,
                stop_name=s.stop_name,
                stop_name_en=s.stop_name_en,
                stop_name_ta=s.stop_name_ta,
                stop_desc=s.stop_desc,
                stop_lat=s.stop_lat,
                stop_lon=s.stop_lon,
                zone_id=s.zone_id,
                location_type=s.location_type,
                routes_count=routes_count,
            )
        )

    return results

@router.get("/nearby", response_model=List[StopBase])
def get_nearby_stops(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    radius_meters: float = Query(1500.0, ge=100, le=10000, description="Search radius in meters"),
    limit: int = Query(15, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Find nearby transit stops within a geographic radius, ordered by distance.
    """
    # Pre-filter using bounding box (~0.01 deg approx 1.1 km)
    deg_delta = (radius_meters / 1000.0) * 0.01
    candidates = (
        db.query(Stop)
        .filter(
            Stop.stop_lat.between(lat - deg_delta, lat + deg_delta),
            Stop.stop_lon.between(lon - deg_delta, lon + deg_delta),
        )
        .all()
    )

    # Compute accurate Haversine distance
    matched = []
    for s in candidates:
        dist = haversine_distance(lat, lon, s.stop_lat, s.stop_lon)
        if dist <= radius_meters:
            matched.append((s, dist))

    matched.sort(key=lambda x: x[1])

    results = []
    for s, dist in matched[:limit]:
        results.append(
            StopBase(
                stop_id=s.stop_id,
                stop_code=s.stop_code,
                stop_name=s.stop_name,
                stop_name_en=s.stop_name_en,
                stop_name_ta=s.stop_name_ta,
                stop_lat=s.stop_lat,
                stop_lon=s.stop_lon,
                distance_meters=round(dist, 1),
            )
        )

    return results

@router.get("/{stop_id}", response_model=StopDetail)
def get_stop_detail(stop_id: str, db: Session = Depends(get_db)):
    """Retrieve full details for a specific stop."""
    s = db.query(Stop).filter(Stop.stop_id == stop_id).first()
    if not s:
        raise HTTPException(status_code=404, detail=f"Stop with ID '{stop_id}' not found.")

    routes_count = (
        db.query(Route.route_id)
        .join(Trip, Trip.route_id == Route.route_id)
        .join(StopTime, StopTime.trip_id == Trip.trip_id)
        .filter(StopTime.stop_id == s.stop_id)
        .distinct()
        .count()
    )

    return StopDetail(
        stop_id=s.stop_id,
        stop_code=s.stop_code,
        stop_name=s.stop_name,
        stop_name_en=s.stop_name_en,
        stop_name_ta=s.stop_name_ta,
        stop_desc=s.stop_desc,
        stop_lat=s.stop_lat,
        stop_lon=s.stop_lon,
        zone_id=s.zone_id,
        location_type=s.location_type,
        routes_count=routes_count,
    )
