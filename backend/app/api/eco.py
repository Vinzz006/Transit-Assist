"""
FastAPI REST router for Phase 14:
Eco-Transit Carbon & Fuel Savings Engine and Multi-Day Commute Pass Optimizer.
"""

from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException, status
from pydantic import BaseModel, Field

from backend.app.schemas.eco import (
    EcoTripComparison,
    ModeEcoDetail,
    MonthlyPassOption,
    CommuteOptimizerRequest,
    CommuteOptimizerResponse,
    GreenCommuterProfile,
)

router = APIRouter(prefix="/api/eco", tags=["Eco-Transit & Pass Optimizer"])

CHENNAI_PETROL_PRICE = 100.75  # INR per liter

# Standard vehicle emission factors (ARAI / BEE India benchmarks)
EMISSIONS_G_PER_KM = {
    "PETROL_CAR": 140.0,
    "TWO_WHEELER": 65.0,
    "AUTO_RICKSHAW": 90.0,
    "APP_CAB": 130.0,
    "METRO": 6.0,
    "BUS": 18.0,
    "SUBURBAN_RAIL": 8.0,
    "AVERAGE_TRANSIT": 12.0,
}

# Fuel efficiency (km per liter)
KM_PER_LITER = {
    "PETROL_CAR": 10.0,  # Chennai city traffic
    "TWO_WHEELER": 45.0,
}

class CompareRequest(BaseModel):
    distance_km: float = Field(..., gt=0, le=120)
    transit_fare: float = Field(..., ge=0)
    transit_mode: str = "METRO"  # "METRO", "BUS", "SUBURBAN_RAIL", "MULTIMODAL"

@router.post("/compare", response_model=EcoTripComparison)
def compare_trip_eco_metrics(
    req: Optional[CompareRequest] = None,
    distance_km: Optional[float] = Query(None),
    transit_fare: Optional[float] = Query(None, alias="fare_inr"),
    transit_mode: Optional[str] = Query(None),
):
    """
    Compute comparative carbon emissions, fuel consumption, and monetary costs
    for public transit vs private car, two-wheeler, auto-rickshaw, and cab.
    """
    dist = req.distance_km if req else (distance_km if distance_km is not None else 10.0)
    t_fare = req.transit_fare if req else (transit_fare if transit_fare is not None else 25.0)
    t_mode = req.transit_mode if req else (transit_mode or "METRO")

    # Emission rates
    t_rate = (
        EMISSIONS_G_PER_KM["METRO"]
        if t_mode == "METRO"
        else EMISSIONS_G_PER_KM["BUS"]
        if t_mode == "BUS"
        else EMISSIONS_G_PER_KM["SUBURBAN_RAIL"]
        if t_mode == "SUBURBAN_RAIL"
        else EMISSIONS_G_PER_KM["AVERAGE_TRANSIT"]
    )

    t_co2_kg = round((dist * t_rate) / 1000.0, 3)
    car_co2_kg = round((dist * EMISSIONS_G_PER_KM["PETROL_CAR"]) / 1000.0, 3)
    bike_co2_kg = round((dist * EMISSIONS_G_PER_KM["TWO_WHEELER"]) / 1000.0, 3)

    # Monetary costs
    car_liters = dist / KM_PER_LITER["PETROL_CAR"]
    car_cost = round(car_liters * CHENNAI_PETROL_PRICE, 2)

    bike_liters = dist / KM_PER_LITER["TWO_WHEELER"]
    bike_cost = round(bike_liters * CHENNAI_PETROL_PRICE, 2)

    # Auto rickshaw (TN govt meter: ₹25 base 1.8km, then ₹12/km)
    auto_cost = round(25.0 + max(0.0, dist - 1.8) * 12.0, 2)

    # Cab (Base ₹100 4km, then ₹18/km)
    cab_cost = round(100.0 + max(0.0, dist - 4.0) * 18.0, 2)

    # Net savings vs private car
    net_co2_saved = round(max(0.0, car_co2_kg - t_co2_kg), 3)
    fuel_saved_liters = round(car_liters, 2)
    fuel_cost_saved = round(max(0.0, car_cost - t_fare), 2)

    # Tree-day equivalent (mature neem/banyan tree absorbs ~55g CO2/day)
    tree_days = round((net_co2_saved * 1000.0) / 55.0, 1)

    breakdown = [
        ModeEcoDetail(
            mode="TRANSIT",
            name=f"Public Transit ({t_mode})",
            co2_grams=round(dist * t_rate, 1),
            cost_inr=t_fare,
            fuel_liters=0.0,
        ),
        ModeEcoDetail(
            mode="TWO_WHEELER",
            name="Two-Wheeler (Scooter/Bike)",
            co2_grams=round(dist * EMISSIONS_G_PER_KM["TWO_WHEELER"], 1),
            cost_inr=bike_cost,
            fuel_liters=round(bike_liters, 2),
        ),
        ModeEcoDetail(
            mode="AUTO_RICKSHAW",
            name="Auto-Rickshaw (Meter)",
            co2_grams=round(dist * EMISSIONS_G_PER_KM["AUTO_RICKSHAW"], 1),
            cost_inr=auto_cost,
            fuel_liters=round(dist / 14.0, 2),
        ),
        ModeEcoDetail(
            mode="PETROL_CAR",
            name="Private Petrol Car",
            co2_grams=round(dist * EMISSIONS_G_PER_KM["PETROL_CAR"], 1),
            cost_inr=car_cost,
            fuel_liters=round(car_liters, 2),
        ),
        ModeEcoDetail(
            mode="APP_CAB",
            name="App Taxi / Cab",
            co2_grams=round(dist * EMISSIONS_G_PER_KM["APP_CAB"], 1),
            cost_inr=cab_cost,
            fuel_liters=round(dist / 11.0, 2),
        ),
    ]

    return EcoTripComparison(
        distance_km=dist,
        transit_mode=t_mode,
        transit_co2_kg=t_co2_kg,
        transit_cost_inr=t_fare,
        car_co2_kg=car_co2_kg,
        car_cost_inr=car_cost,
        bike_co2_kg=bike_co2_kg,
        bike_cost_inr=bike_cost,
        auto_cost_inr=auto_cost,
        cab_cost_inr=cab_cost,
        net_co2_saved_kg=net_co2_saved,
        fuel_saved_liters=fuel_saved_liters,
        fuel_cost_saved_inr=fuel_cost_saved,
        tree_days_equivalent=tree_days,
        petrol_price_benchmark=CHENNAI_PETROL_PRICE,
        modes_breakdown=breakdown,
    )

@router.post("/optimizer", response_model=CommuteOptimizerResponse)
def optimize_monthly_commute_passes(req: CommuteOptimizerRequest):
    """
    Analyze monthly commute frequency and evaluate the optimal pass/smartcard combination
    to maximize savings over single cash tokens and private car petrol costs.
    """
    total_trips = req.working_days_per_month * req.trips_per_day
    total_km = round(total_trips * req.one_way_distance_km, 1)

    # 1. Base cost: cash tokens
    cost_cash = round(total_trips * req.one_way_fare_cash, 2)

    # 2. Smartcard cost (20% discount on metro, or 0 if female on ordinary bus)
    smartcard_rate = req.one_way_fare_smartcard if req.one_way_fare_smartcard is not None else round(req.one_way_fare_cash * 0.8, 2)
    if req.is_female and req.primary_mode == "BUS":
        cost_smartcard = 0.0
    else:
        cost_smartcard = round(total_trips * smartcard_rate, 2)

    # 3. Driving cost
    cost_car = round((total_km / KM_PER_LITER["PETROL_CAR"]) * CHENNAI_PETROL_PRICE, 2)
    cost_bike = round((total_km / KM_PER_LITER["TWO_WHEELER"]) * CHENNAI_PETROL_PRICE, 2)

    # 4. Pass options catalog
    options: List[MonthlyPassOption] = []

    # Option A: Singara Chennai NCMC Smartcard
    opt_ncmc = MonthlyPassOption(
        pass_id="PASS_NCMC",
        name_en="Singara Chennai NCMC Smartcard (Pay-As-You-Go)",
        name_ta="சிங்கார சென்னை NCMC ஸ்மார்ட் கார்டு",
        agency="NCMC",
        price_inr=cost_smartcard,
        period="MONTHLY",
        description_en="Automatic 20% discount on every CMRL Metro trip and seamless tapping across MTC buses.",
        description_ta="ஒவ்வொரு மெட்ரோ பயணத்திற்கும் 20% நேரடி தள்ளுபடி மற்றும் பேருந்துகளில் எளிதான பயணம்.",
        monthly_savings_inr=round(cost_cash - cost_smartcard, 2),
    )
    options.append(opt_ncmc)

    # Option B: MTC Monthly Bus Pass (₹1,000 unlimited)
    if req.primary_mode in ("BUS", "MULTIMODAL"):
        mtc_price = 0.0 if req.is_female else 1000.0
        opt_mtc = MonthlyPassOption(
            pass_id="PASS_MTC_MONTHLY",
            name_en="MTC Monthly Unlimited Bus Pass (Gold Pass)",
            name_ta="MTC மாதாந்திர வரம்பற்ற பேருந்து பாஸ்",
            agency="MTC",
            price_inr=mtc_price,
            period="MONTHLY",
            description_en="Unlimited travel across all MTC Ordinary & Express city buses for 30 days.",
            description_ta="30 நாட்களுக்கு அனைத்து மாநகரப் பேருந்துகளிலும் வரம்பற்ற பயணம்.",
            monthly_savings_inr=round(cost_cash - mtc_price, 2),
        )
        options.append(opt_mtc)

    # Option C: CMRL 30-Trip Monthly Pass
    if req.primary_mode in ("METRO", "MULTIMODAL"):
        cmrl_pass_price = round(min(cost_smartcard, total_trips * req.one_way_fare_cash * 0.75), 2)
        opt_cmrl = MonthlyPassOption(
            pass_id="PASS_CMRL_TRIP",
            name_en="CMRL Metro Monthly Frequent Rider Pass",
            name_ta="சென்னை மெட்ரோ மாதாந்திர சிறப்பு பாஸ்",
            agency="CMRL",
            price_inr=cmrl_pass_price,
            period="MONTHLY",
            description_en="Special concession for daily commuters with maximum 25% slab discount.",
            description_ta="தினசரி மெட்ரோ பயணிகளுக்கு 25% வரை கட்டணச் சலுகை.",
            monthly_savings_inr=round(cost_cash - cmrl_pass_price, 2),
        )
        options.append(opt_cmrl)

    # Option D: Suburban Rail Monthly Season Ticket (MST)
    if req.primary_mode in ("SUBURBAN_RAIL", "MULTIMODAL"):
        mst_price = round(req.one_way_fare_cash * 15.0, 2)  # Indian Railways standard: 15 single journeys
        opt_mst = MonthlyPassOption(
            pass_id="PASS_SR_MST",
            name_en="Southern Railway Suburban Monthly Season Ticket (MST)",
            name_ta="தெற்கு ரயில்வே மாதாந்திர சீசன் டிக்கெட் (MST)",
            agency="SR",
            price_inr=mst_price,
            period="MONTHLY",
            description_en="Unlimited local EMU travel between designated stations for only 15 single journey fares!",
            description_ta="வெறும் 15 பயணங்களின் கட்டணத்தில் மாதம் முழுவதும் வரம்பற்ற ரயில் பயணம்!",
            monthly_savings_inr=round(cost_cash - mst_price, 2),
        )
        options.append(opt_mst)

    # Find best recommended pass (lowest monthly cost)
    best_pass = min(options, key=lambda p: p.price_inr)
    best_pass.recommended = True

    max_savings_vs_cash = max(0.0, round(cost_cash - best_pass.price_inr, 2))
    max_savings_vs_car = max(0.0, round(cost_car - best_pass.price_inr, 2))
    annual_savings = round(max_savings_vs_car * 12.0, 2)

    # Environmental monthly impact
    monthly_co2_car = (total_km * EMISSIONS_G_PER_KM["PETROL_CAR"]) / 1000.0
    monthly_co2_transit = (total_km * EMISSIONS_G_PER_KM["AVERAGE_TRANSIT"]) / 1000.0
    net_monthly_co2 = round(max(0.0, monthly_co2_car - monthly_co2_transit), 2)
    trees_equiv = round((net_monthly_co2 * 1000.0) / 55.0, 1)

    return CommuteOptimizerResponse(
        total_trips_monthly=total_trips,
        total_monthly_km=total_km,
        cost_cash_tokens=cost_cash,
        cost_smartcard=cost_smartcard,
        cost_private_car=cost_car,
        cost_two_wheeler=cost_bike,
        best_pass=best_pass,
        monthly_passes_evaluated=options,
        max_savings_vs_cash=max_savings_vs_cash,
        max_savings_vs_car=max_savings_vs_car,
        annual_savings_potential=annual_savings,
        monthly_co2_avoided_kg=net_monthly_co2,
        monthly_tree_equivalent=trees_equiv,
    )

@router.get("/profile", response_model=GreenCommuterProfile)
def get_green_commuter_profile():
    """
    Get commuter's cumulative green transit achievements, lifetime CO2 saved,
    and urban tree milestones.
    """
    return GreenCommuterProfile(
        commuter_level="SILVER_MARINA",
        badge_title_en="Marina Eco Pioneer",
        badge_title_ta="மெரினா பசுமை முன்னோடி",
        lifetime_co2_saved_kg=28.4,
        lifetime_fuel_saved_liters=20.3,
        lifetime_rupees_saved=2045.0,
        urban_trees_equivalent=5.2,
        cleaner_air_points=480,
    )
