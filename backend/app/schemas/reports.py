"""
Pydantic schemas for Crowdsourced Transit Reports (crowd levels & delays).
"""

from typing import Optional, List
from pydantic import BaseModel, Field

class ReportCreateRequest(BaseModel):
    route_id: str
    stop_id: Optional[str] = None
    crowd_level: str = Field(..., pattern="^(low|moderate|packed)$")
    delay_minutes: int = Field(0, ge=0, le=120)
    comment: Optional[str] = None

class ReportItem(BaseModel):
    id: int
    route_id: str
    stop_id: Optional[str] = None
    crowd_level: str
    delay_minutes: int
    comment: Optional[str] = None
    created_at: str

class RouteCrowdSummary(BaseModel):
    route_id: str
    total_reports: int
    crowd_level: str  # "low", "moderate", "packed"
    average_delay_minutes: float
    status_label: str  # "Seats Available", "Standing Room", "Heavily Crowded"
    latest_reports: List[ReportItem] = []
