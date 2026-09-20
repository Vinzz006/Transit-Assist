"""
Pydantic schemas for AI Predictive Arrival Delay and Chennai Corridor Risk.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class DelayPredictionRequest(BaseModel):
    route_id: str
    route_type: int = 3  # 1=Metro, 2=Rail, 3=Bus
    stop_id: Optional[str] = None
    departure_time: Optional[str] = "08:30:00"
    weather: Optional[str] = "clear"  # "clear", "rain", "monsoon"

class DelayPredictionResponse(BaseModel):
    route_id: str
    route_short_name: str
    mode: str
    weather: str
    predicted_delay_minutes: int
    confidence_score: float  # 0.0 to 1.0
    risk_level: str  # "LOW", "MODERATE", "HIGH"
    corridor_name: Optional[str] = None
    is_waterlogging_prone: bool = False
    advisory_en: str
    advisory_ta: str

class CorridorRiskItem(BaseModel):
    corridor_id: str
    name_en: str
    name_ta: str
    routes: List[str]
    waterlogging_risk: str  # "NONE", "MODERATE", "SEVERE"
    typical_peak_delay_min: int
    monsoon_delay_min: int
    advice_en: str
    advice_ta: str

class CorridorSummaryResponse(BaseModel):
    weather: str
    active_corridors_count: int
    corridors: List[CorridorRiskItem]
