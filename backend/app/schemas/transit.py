"""
Pydantic schemas for Transit Assist India.
Typed models for Stops, Routes, Itineraries, Transit Legs, and Fares.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class StopBase(BaseModel):
    stop_id: str
    stop_code: Optional[str] = None
    stop_name: str
    stop_name_en: Optional[str] = None
    stop_name_ta: Optional[str] = None
    stop_lat: float
    stop_lon: float
    distance_meters: Optional[float] = None

class StopDetail(StopBase):
    stop_desc: Optional[str] = None
    zone_id: Optional[str] = None
    location_type: int = 0
    routes_count: Optional[int] = 0

class RouteSummary(BaseModel):
    route_id: str
    agency_id: str
    route_short_name: str
    route_long_name: str
    route_type: int
    route_color: str
    route_text_color: str

class NextArrival(BaseModel):
    trip_id: str
    route_id: str
    route_short_name: str
    route_long_name: str
    route_type: int  # 1=Metro, 3=Bus
    route_color: str
    headsign: Optional[str] = None
    departure_time: str
    departure_seconds: int
    eta_minutes: int
    is_realtime: bool = False

class FareBreakdown(BaseModel):
    agency_id: str
    mode: str  # "bus" or "metro"
    service_type: str  # "ordinary", "express", "deluxe", "metro"
    distance_km: float
    fare_amount: float
    discounted_amount: Optional[float] = None  # smartcard/QR discount
    scheme_applied: Optional[str] = None  # e.g. "Vidiyal Payanam"
    currency: str = "INR"
    currency_symbol: str = "₹"

class TotalFare(BaseModel):
    cash_total: float
    smartcard_total: float
    women_fare_total: float
    currency: str = "INR"
    currency_symbol: str = "₹"
    breakdown: List[FareBreakdown]

class TransitLeg(BaseModel):
    leg_type: str  # "WALK", "TRANSIT", "AUTO", "TAXI"
    mode: str  # "WALK", "BUS", "METRO", "SUBURBAN_RAIL", "AUTO", "TAXI"
    route_id: Optional[str] = None
    route_short_name: Optional[str] = None
    route_long_name: Optional[str] = None
    route_color: Optional[str] = None
    route_text_color: Optional[str] = None
    headsign: Optional[str] = None
    from_stop_id: str
    from_stop_name: str
    from_stop_lat: float
    from_stop_lon: float
    to_stop_id: str
    to_stop_name: str
    to_stop_lat: float
    to_stop_lon: float
    departure_time: str
    arrival_time: str
    duration_minutes: int
    distance_meters: float
    intermediate_stops_count: int = 0
    intermediate_stops: List[StopBase] = []
    polyline: List[List[float]] = []  # [[lat, lon], ...]
    fare: Optional[FareBreakdown] = None
    instruction: Optional[str] = None
    instruction_ta: Optional[str] = None
    is_estimated: bool = False

class Itinerary(BaseModel):
    itinerary_id: str
    departure_time: str
    arrival_time: str
    duration_minutes: int
    walking_time_minutes: int
    transit_time_minutes: int
    auto_time_minutes: int = 0
    transfers_count: int
    legs: List[TransitLeg]
    fare: TotalFare
    preference_applied: Optional[str] = "fastest"

class TripPlanRequest(BaseModel):
    origin_lat: float = Field(..., ge=-90, le=90)
    origin_lon: float = Field(..., ge=-180, le=180)
    destination_lat: float = Field(..., ge=-90, le=90)
    destination_lon: float = Field(..., ge=-180, le=180)
    departure_time: Optional[str] = None  # HH:MM:SS format, default current time
    is_female: bool = False
    max_transfers: int = 3
    walk_speed_mps: float = 1.2
    preference: str = "fastest"  # "fastest", "fewest_transfers", "least_walking", "cheapest"
    allow_auto: bool = True

class TripPlanResponse(BaseModel):
    origin: Dict[str, Any]
    destination: Dict[str, Any]
    query_time: str
    itineraries_count: int
    itineraries: List[Itinerary]
