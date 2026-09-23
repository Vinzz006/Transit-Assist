"""
Pydantic schemas for Phase 14: Eco-Transit Carbon & Fuel Savings Engine and Commute Pass Optimizer.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ModeEcoDetail(BaseModel):
    mode: str  # "TRANSIT", "PETROL_CAR", "TWO_WHEELER", "AUTO_RICKSHAW", "APP_CAB"
    name: str
    co2_grams: float
    cost_inr: float
    fuel_liters: float

class EcoTripComparison(BaseModel):
    distance_km: float
    transit_mode: str
    transit_co2_kg: float
    transit_cost_inr: float
    car_co2_kg: float
    car_cost_inr: float
    bike_co2_kg: float
    bike_cost_inr: float
    auto_cost_inr: float
    cab_cost_inr: float
    net_co2_saved_kg: float
    fuel_saved_liters: float
    fuel_cost_saved_inr: float
    tree_days_equivalent: float
    petrol_price_benchmark: float = 100.75  # Chennai petrol benchmark per liter
    modes_breakdown: List[ModeEcoDetail]

class MonthlyPassOption(BaseModel):
    pass_id: str
    name_en: str
    name_ta: str
    agency: str  # "MTC", "CMRL", "SR", "NCMC"
    price_inr: float
    period: str  # "MONTHLY", "DAILY_PASS", "TRIP_PASS"
    description_en: str
    description_ta: str
    recommended: bool = False
    monthly_savings_inr: float = 0.0

class CommuteOptimizerRequest(BaseModel):
    one_way_distance_km: float = Field(..., gt=0, le=100)
    one_way_fare_cash: float = Field(..., gt=0)
    one_way_fare_smartcard: Optional[float] = None
    working_days_per_month: int = Field(22, ge=1, le=31)
    trips_per_day: int = Field(2, ge=1, le=4)
    primary_mode: str = "METRO"  # "METRO", "BUS", "SUBURBAN_RAIL", "MULTIMODAL"
    is_female: bool = False

class CommuteOptimizerResponse(BaseModel):
    total_trips_monthly: int
    total_monthly_km: float
    cost_cash_tokens: float
    cost_smartcard: float
    cost_private_car: float
    cost_two_wheeler: float
    best_pass: MonthlyPassOption
    monthly_passes_evaluated: List[MonthlyPassOption]
    max_savings_vs_cash: float
    max_savings_vs_car: float
    annual_savings_potential: float
    monthly_co2_avoided_kg: float
    monthly_tree_equivalent: float

class GreenCommuterProfile(BaseModel):
    commuter_level: str  # "BRONZE_SEEDLING", "SILVER_MARINA", "GOLD_BANYAN"
    badge_title_en: str
    badge_title_ta: str
    lifetime_co2_saved_kg: float
    lifetime_fuel_saved_liters: float
    lifetime_rupees_saved: float
    urban_trees_equivalent: float
    cleaner_air_points: int
