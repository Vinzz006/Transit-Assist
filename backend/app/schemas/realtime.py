"""
Pydantic schemas for Real-time Vehicle Tracking and GTFS-RT feeds.
Compliant with GTFS-Realtime 2.0 specifications.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class VehiclePositionItem(BaseModel):
    vehicle_id: str
    trip_id: str
    route_id: str
    route_short_name: str
    route_long_name: str
    route_type: int  # 1=Metro, 2=Rail, 3=Bus
    agency_id: str
    latitude: float
    longitude: float
    bearing: float  # 0 to 360 degrees
    speed_kmh: float
    current_status: str  # "IN_TRANSIT_TO", "STOPPED_AT", "INCOMING_AT"
    current_stop_id: Optional[str] = None
    current_stop_name: Optional[str] = None
    current_stop_sequence: int = 1
    next_stop_id: Optional[str] = None
    next_stop_name: Optional[str] = None
    delay_seconds: int = 0
    delay_minutes: int = 0
    occupancy_status: str = "MANY_SEATS_AVAILABLE"  # "MANY_SEATS_AVAILABLE", "FEW_SEATS_AVAILABLE", "STANDING_ROOM_ONLY", "FULL"
    timestamp: int

class StopTimeUpdateItem(BaseModel):
    stop_sequence: int
    stop_id: str
    stop_name: str
    arrival_time: str
    departure_time: str
    arrival_delay: int = 0
    departure_delay: int = 0

class TripUpdateItem(BaseModel):
    trip_id: str
    route_id: str
    route_short_name: str
    delay_seconds: int = 0
    delay_minutes: int = 0
    stop_time_updates: List[StopTimeUpdateItem] = []
    timestamp: int

class GTFSRTFeedHeader(BaseModel):
    gtfs_realtime_version: str = "2.0"
    incrementality: str = "FULL_DATASET"
    timestamp: int

class GTFSRTFeedEntity(BaseModel):
    id: str
    is_deleted: bool = False
    vehicle: Optional[Dict[str, Any]] = None
    trip_update: Optional[Dict[str, Any]] = None

class GTFSRTFeedMessage(BaseModel):
    header: GTFSRTFeedHeader
    entity: List[GTFSRTFeedEntity]
