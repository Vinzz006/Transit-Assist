"""
FastAPI REST router for Real-Time Vehicle Tracking & GTFS-RT Feeds.
Provides endpoints for active vehicle positions, live trip delays, and GTFS-RT feed messages.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.realtime.simulator import VehicleTracker, get_vehicle_tracker
from backend.app.schemas.realtime import (
    VehiclePositionItem,
    TripUpdateItem,
    GTFSRTFeedMessage,
)

router = APIRouter(prefix="/api/realtime", tags=["Real-time Tracking"])

@router.get("/vehicles", response_model=List[VehiclePositionItem])
def get_realtime_vehicles(
    time: Optional[str] = Query(None, description="Simulated query time in HH:MM:SS (defaults to current IST time)"),
    route_id: Optional[str] = Query(None, description="Filter by route ID (e.g. CMRL_BLUE, MTC_29C, SR_SOUTH)"),
    route_type: Optional[int] = Query(None, description="Filter by route type: 1=Metro, 2=Rail, 3=Bus"),
    agency_id: Optional[str] = Query(None, description="Filter by transit agency ID"),
    bounds: Optional[str] = Query(None, description="Bounding box min_lat,min_lon,max_lat,max_lon"),
    db: Session = Depends(get_db),
):
    """
    Get live real-time positions for all active vehicles across Chennai Bus, Metro, and Suburban Rail.
    Includes directional bearing (0-360 deg), ground speed, stop dwell status, and crowdsourced delays.
    """
    tracker = get_vehicle_tracker(db)
    vehicles = tracker.get_active_vehicles(
        time_str=time,
        route_id=route_id,
        route_type=route_type,
        agency_id=agency_id,
    )

    # Optional geographic bounding box filter
    if bounds:
        try:
            parts = [float(x.strip()) for x in bounds.split(",")]
            if len(parts) == 4:
                min_lat, min_lon, max_lat, max_lon = parts
                vehicles = [
                    v
                    for v in vehicles
                    if min_lat <= v.latitude <= max_lat and min_lon <= v.longitude <= max_lon
                ]
        except Exception:
            pass

    return vehicles

@router.get("/trip-updates", response_model=List[TripUpdateItem])
def get_trip_updates(
    time: Optional[str] = Query(None, description="Simulated query time in HH:MM:SS"),
    route_id: Optional[str] = Query(None, description="Filter by route ID"),
    db: Session = Depends(get_db),
):
    """
    Get live GTFS-RT Trip Updates with real-time arrival/departure delay offsets and stop sequences.
    """
    tracker = get_vehicle_tracker(db)
    return tracker.get_trip_updates(time_str=time, route_id=route_id)

@router.get("/gtfs-rt", response_model=GTFSRTFeedMessage)
def get_gtfs_rt_feed(
    time: Optional[str] = Query(None, description="Simulated query time in HH:MM:SS"),
    route_id: Optional[str] = Query(None, description="Filter by route ID"),
    db: Session = Depends(get_db),
):
    """
    Export official GTFS-RT 2.0 FeedMessage JSON containing both VehiclePositions and TripUpdates.
    """
    tracker = get_vehicle_tracker(db)
    return tracker.get_gtfs_rt_feed(time_str=time, route_id=route_id)
