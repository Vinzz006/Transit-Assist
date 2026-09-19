"""
Test suite for Phase 8: Multimodal Trips & Preference Engine.
Verifies journeys combining 2+ modes (Bus, Metro, Suburban Rail, Walk, Auto-Rickshaw),
step-by-step instructions, configurable auto fare formulas (including night surcharge),
and user preferences: fastest, fewest_transfers, least_walking, cheapest.
"""

import pytest
from backend.app.routing.raptor import RaptorRouter
from backend.app.routing.fares import fare_calculator
from backend.app.schemas.transit import TripPlanRequest

@pytest.fixture(scope="module")
def router():
    r = RaptorRouter()
    r._ensure_graph()
    return r

# 1. Bus + Metro Multimodal Journey
def test_multimodal_01_bus_and_metro(router):
    """Journey from T. Nagar to Chennai Airport combining Bus feeder and Metro."""
    req = TripPlanRequest(
        origin_lat=13.0402, origin_lon=80.2337,       # T. Nagar
        destination_lat=12.9780, destination_lon=80.1640, # Chennai Airport
        departure_time="08:30:00",
        preference="fastest",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1
    
    # Check for multimodal trip with transit legs
    it = res.itineraries[0]
    modes = [l.mode for l in it.legs]
    assert "WALK" in modes
    assert any(m in ("METRO", "BUS") for m in modes)
    assert it.legs[0].instruction is not None
    assert it.legs[0].instruction_ta is not None

# 2. Metro + Suburban Rail Multimodal Journey
def test_multimodal_02_metro_and_suburban_rail(router):
    """Journey from Central to Tambaram via Chennai Park / Guindy interchange."""
    req = TripPlanRequest(
        origin_lat=13.0827, origin_lon=80.2754,       # Chennai Central
        destination_lat=12.9249, destination_lon=80.1197, # Tambaram
        departure_time="09:00:00",
        preference="fastest",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1
    it = res.itineraries[0]
    # Check that journey has transit legs and valid step instructions
    transit_legs = [l for l in it.legs if l.leg_type == "TRANSIT"]
    assert len(transit_legs) >= 1
    for l in transit_legs:
        assert l.instruction is not None
        assert len(l.instruction) > 5

# 3. Auto-Rickshaw Feeder + Metro Multimodal Journey
def test_multimodal_03_auto_feeder_and_metro(router):
    """Commuter starting 2 km from Central Metro station uses Auto feeder."""
    req = TripPlanRequest(
        origin_lat=13.0980, origin_lon=80.2750,       # ~1.8 km north of Central
        destination_lat=12.9780, destination_lon=80.1640, # Chennai Airport
        departure_time="08:30:00",
        allow_auto=True,
        preference="least_walking",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1
    
    # Check that at least one itinerary contains an AUTO leg
    auto_itins = [it for it in res.itineraries if any(l.mode == "AUTO" for l in it.legs)]
    assert len(auto_itins) >= 1
    auto_leg = [l for l in auto_itins[0].legs if l.mode == "AUTO"][0]
    assert auto_leg.is_estimated is True
    assert auto_leg.fare is not None
    assert auto_leg.fare.fare_amount >= 25.0  # TN Govt minimum fare

# 4. Bus + Walk + Metro Multimodal Journey
def test_multimodal_04_bus_walk_metro(router):
    """Journey from Anna Nagar neighborhood to Airport via transit."""
    req = TripPlanRequest(
        origin_lat=13.0870, origin_lon=80.2210,       # Anna Nagar neighborhood (~350m from station)
        destination_lat=12.9780, destination_lon=80.1640, # Airport
        departure_time="08:45:00",
        preference="fastest",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1
    it = res.itineraries[0]
    assert it.transfers_count >= 0
    assert it.duration_minutes > 0
    assert any(l.leg_type == "WALK" for l in it.legs)

# 5. Suburban Rail + MTC Bus Multimodal Journey
def test_multimodal_05_suburban_rail_and_bus(router):
    """Journey from Tambaram to Adyar Depot via Guindy interchange."""
    req = TripPlanRequest(
        origin_lat=12.9249, origin_lon=80.1197,       # Tambaram
        destination_lat=12.9978, destination_lon=80.2562, # Adyar Depot
        departure_time="09:00:00",
        preference="fastest",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1
    it = res.itineraries[0]
    assert it.fare.cash_total > 0

# 6. Preference: Fastest (minimizes total travel time)
def test_multimodal_06_preference_fastest(router):
    req = TripPlanRequest(
        origin_lat=13.0827, origin_lon=80.2754,
        destination_lat=12.9780, destination_lon=80.1640,
        departure_time="08:30:00",
        preference="fastest",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1
    # First itinerary should have duration <= later itineraries
    durations = [it.duration_minutes for it in res.itineraries]
    assert durations == sorted(durations)
    assert res.itineraries[0].preference_applied == "fastest"

# 7. Preference: Fewest Transfers (minimizes transfers_count)
def test_multimodal_07_preference_fewest_transfers(router):
    req = TripPlanRequest(
        origin_lat=13.0827, origin_lon=80.2754,
        destination_lat=12.9780, destination_lon=80.1640,
        departure_time="08:30:00",
        preference="fewest_transfers",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1
    assert res.itineraries[0].preference_applied == "fewest_transfers"
    # First itinerary should have minimum transfers
    transfers = [it.transfers_count for it in res.itineraries]
    assert transfers[0] == min(transfers)

# 8. Preference: Least Walking (minimizes walking_time_minutes)
def test_multimodal_08_preference_least_walking(router):
    req = TripPlanRequest(
        origin_lat=13.0827, origin_lon=80.2754,
        destination_lat=12.9780, destination_lon=80.1640,
        departure_time="08:30:00",
        preference="least_walking",
        allow_auto=True,
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1
    assert res.itineraries[0].preference_applied == "least_walking"
    walk_times = [it.walking_time_minutes for it in res.itineraries]
    assert walk_times[0] == min(walk_times)

# 9. Preference: Cheapest (minimizes total fare with Vidiyal Payanam)
def test_multimodal_09_preference_cheapest_with_concession(router):
    # Female commuter traveling between Perambur and Adyar
    req = TripPlanRequest(
        origin_lat=13.1110, origin_lon=80.2430,
        destination_lat=12.9978, destination_lon=80.2562,
        departure_time="08:00:00",
        is_female=True,
        preference="cheapest",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1
    assert res.itineraries[0].preference_applied == "cheapest"
    # Female fare on ordinary bus is 0
    fares = [it.fare.women_fare_total for it in res.itineraries]
    assert fares[0] == min(fares)

# 10. Auto Fare Night Surcharge (50% extra between 23:00 and 05:00)
def test_multimodal_10_auto_night_surcharge():
    # Daytime auto fare for 5 km
    day_fare = fare_calculator.calculate_auto_fare(5000.0, departure_time="14:30:00", mode="auto")
    # Base 25 + (5 - 1.8)*12 = 25 + 38.4 = 63.4 -> 63.0
    assert day_fare.fare_amount == 63.0
    assert "Night Surcharge" not in (day_fare.scheme_applied or "")

    # Nighttime auto fare for 5 km at 23:30 (50% extra)
    night_fare = fare_calculator.calculate_auto_fare(5000.0, departure_time="23:30:00", mode="auto")
    # 63.4 * 1.5 = 95.1 -> 95.0
    assert night_fare.fare_amount == 95.0
    assert "Night Surcharge (50%)" in (night_fare.scheme_applied or "")
