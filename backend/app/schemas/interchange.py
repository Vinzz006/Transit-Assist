"""
Pydantic schemas for Phase 15:
Station Interchange Wayfinding Guide, Platform Directories, and First/Last-Mile Feeder Networks (MTC Small Buses & Chennai Share-Autos).
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class PlatformInfo(BaseModel):
    platform_id: str
    platform_number: str
    mode: str  # "METRO", "SUBURBAN_RAIL", "MAINLINE_TRAIN", "BUS"
    level: str  # "UNDERGROUND_L2", "UNDERGROUND_L1", "GROUND", "ELEVATED_L1", "ELEVATED_L2"
    service_direction: str  # e.g. "Platform 1: Down towards Airport / St. Thomas Mount"
    service_direction_ta: str
    accessible: bool = True
    has_lift: bool = True
    has_escalator: bool = True

class ExitGateInfo(BaseModel):
    gate_id: str
    gate_code: str  # e.g. "Gate 1 (A1)"
    name_en: str
    name_ta: str
    leading_to: List[str]  # e.g. ["Poonamallee High Road", "RGGGH Hospital", "Park Station Subway"]
    leading_to_ta: List[str]
    has_wheelchair_ramp: bool = True
    nearby_feeder_stand: Optional[str] = None

class AmenityInfo(BaseModel):
    category: str  # "LIFT", "ESCALATOR", "RESTROOM", "WATER", "CLOAKROOM", "WHEELCHAIR", "ATM", "TICKETING"
    name_en: str
    name_ta: str
    location_description: str
    location_description_ta: str
    is_operational: bool = True

class FeederServiceInfo(BaseModel):
    service_id: str
    service_type: str  # "MTC_SMALL_BUS", "SHARE_AUTO", "METRO_FEEDER_SHUTTLE"
    route_number: str  # e.g. "S15" or "SH-GND-01"
    destination_en: str
    destination_ta: str
    via_en: str
    via_ta: str
    frequency_minutes: int
    fare_inr: float
    operating_hours: str  # e.g. "06:00 - 22:30"
    boarding_gate_code: str  # e.g. "Gate 3"
    vehicle_capacity: str  # e.g. "7-Seater Share Auto" or "24-Seater Minibus"

class InterchangeHubSummary(BaseModel):
    hub_id: str
    name_en: str
    name_ta: str
    modes: List[str]  # ["METRO", "SUBURBAN_RAIL", "BUS"]
    lat: float
    lon: float
    total_platforms: int
    total_exits: int
    has_share_auto_stand: bool
    has_small_bus_feeder: bool
    is_step_free: bool

class InterchangeHubDetail(BaseModel):
    hub_id: str
    name_en: str
    name_ta: str
    subtitle_en: str
    subtitle_ta: str
    lat: float
    lon: float
    modes: List[str]
    levels: List[str]
    platforms: List[PlatformInfo]
    exit_gates: List[ExitGateInfo]
    amenities: List[AmenityInfo]
    feeders: List[FeederServiceInfo]
    connects_to_stop_ids: List[str]

class TransferStep(BaseModel):
    step_number: int
    instruction_en: str
    instruction_ta: str
    distance_meters: int
    duration_seconds: int
    level_change: Optional[str] = None  # e.g. "Take elevator from L-2 to Ground Concourse"
    is_step_free: bool = True
    signage_clue: str  # e.g. "Follow yellow suburban rail floor decals"

class TransferGuideRequest(BaseModel):
    hub_id: str
    origin_platform_id: str
    destination_platform_id: str
    wheelchair_only: bool = False

class TransferGuideResponse(BaseModel):
    hub_id: str
    origin_platform_name: str
    destination_platform_name: str
    total_walking_distance_meters: int
    estimated_walk_duration_minutes: float
    is_fully_step_free: bool
    has_elevator_option: bool
    steps: List[TransferStep]
    tips_en: List[str]
    tips_ta: List[str]

class FeederRecommendationRequest(BaseModel):
    hub_id: str
    destination_query: str
    max_fare: Optional[float] = None

class FeederRecommendationResponse(BaseModel):
    hub_id: str
    destination_matched: str
    recommended_feeders: List[FeederServiceInfo]
    fastest_option: Optional[FeederServiceInfo] = None
    cheapest_option: Optional[FeederServiceInfo] = None
