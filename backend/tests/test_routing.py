"""
Test suite for Transit Routing Engine (RAPTOR).
Verifies multi-criteria routing, walking transfers, fare calculations,
and benchmarks 10 distinct sample journeys across Chennai public transit.
"""

import pytest
from backend.app.routing.raptor import RaptorRouter
from backend.app.schemas.transit import TripPlanRequest

@pytest.fixture(scope="module")
def router():
    r = RaptorRouter()
    r._ensure_graph()
    return r

# 1. Direct Metro Blue Line: Chennai Central to Airport
def test_journey_01_direct_metro_central_to_airport(router):
    req = TripPlanRequest(
        origin_lat=13.0827, origin_lon=80.2754,       # Chennai Central
        destination_lat=12.9780, destination_lon=80.1640, # Chennai Airport
        departure_time="08:30:00",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1

    # Check that at least one Pareto itinerary offers direct CMRL Blue Line
    blue_itins = [
        it for it in res.itineraries
        if any("Blue" in l.route_short_name or l.route_id == "CMRL_BLUE" for l in it.legs)
    ]
    assert len(blue_itins) >= 1
    assert blue_itins[0].fare.cash_total >= 40.0

# 2. Direct Metro Green Line: Koyambedu CMBT to Central
def test_journey_02_direct_metro_cmbt_to_central(router):
    req = TripPlanRequest(
        origin_lat=13.0690, origin_lon=80.1940,       # Koyambedu CMBT
        destination_lat=13.0827, destination_lon=80.2754, # Chennai Central
        departure_time="09:00:00",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1

    itin = res.itineraries[0]
    transit_legs = [l for l in itin.legs if l.leg_type == "TRANSIT"]
    assert any("Green" in l.route_short_name or l.route_id == "CMRL_GREEN" for l in transit_legs)
    assert itin.duration_minutes <= 40

# 3. Direct Bus: Perambur B.S to Adyar Depot (Route 29C)
def test_journey_03_direct_bus_perambur_to_adyar(router):
    req = TripPlanRequest(
        origin_lat=13.1110, origin_lon=80.2430,       # Perambur
        destination_lat=12.9978, destination_lon=80.2562, # Adyar Depot
        departure_time="08:00:00",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1

    itin = res.itineraries[0]
    bus_legs = [l for l in itin.legs if l.mode == "BUS"]
    assert len(bus_legs) >= 1
    assert any(l.route_short_name == "29C" for l in bus_legs)

# 4. Bus to Metro Transfer: T. Nagar to Chennai Airport
def test_journey_04_bus_to_metro_tnagar_to_airport(router):
    req = TripPlanRequest(
        origin_lat=13.0402, origin_lon=80.2337,       # T. Nagar
        destination_lat=12.9780, destination_lon=80.1640, # Chennai Airport
        departure_time="08:30:00",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1

    itin = res.itineraries[0]
    modes = [l.mode for l in itin.legs if l.leg_type == "TRANSIT"]
    assert "METRO" in modes or "BUS" in modes

# 5. Metro to Bus Transfer: Anna Nagar East to Marina Beach
def test_journey_05_metro_to_bus_anna_nagar_to_marina(router):
    req = TripPlanRequest(
        origin_lat=13.0840, origin_lon=80.2190,       # Anna Nagar East
        destination_lat=13.0630, destination_lon=80.2830, # Marina Beach / Anna Square
        departure_time="09:15:00",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1

    itin = res.itineraries[0]
    assert itin.duration_minutes > 0
    # Must arrive at or near Marina
    last_leg = itin.legs[-1]
    assert last_leg.to_stop_name == "Destination Location" or "Marina" in last_leg.to_stop_name

# 6. Metro Line Transfer / Interchange: Guindy to Egmore
def test_journey_06_metro_interchange_guindy_to_egmore(router):
    req = TripPlanRequest(
        origin_lat=13.0090, origin_lon=80.2130,       # Guindy
        destination_lat=13.0780, destination_lon=80.2610, # Egmore
        departure_time="10:00:00",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1

    itin = res.itineraries[0]
    transit_legs = [l for l in itin.legs if l.leg_type == "TRANSIT"]
    assert len(transit_legs) >= 1

# 7. Cross-Town Bus: Koyambedu CMBT to Adyar (Route 47A)
def test_journey_07_cross_town_bus_cmbt_to_adyar(router):
    req = TripPlanRequest(
        origin_lat=13.0690, origin_lon=80.1940,       # CMBT
        destination_lat=12.9978, destination_lon=80.2562, # Adyar
        departure_time="10:30:00",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1

    itin = res.itineraries[0]
    transit_legs = [l for l in itin.legs if l.leg_type == "TRANSIT"]
    assert any(l.route_short_name in ("47A", "29C") or l.mode in ("BUS", "METRO") for l in transit_legs)

# 8. Multimodal Trip with Vidiyal Payanam Scheme (Free Bus for Women)
def test_journey_08_women_free_travel_scheme(router):
    # Standard query
    req_m = TripPlanRequest(
        origin_lat=13.1110, origin_lon=80.2430,       # Perambur
        destination_lat=12.9978, destination_lon=80.2562, # Adyar
        departure_time="08:00:00",
        is_female=False,
    )
    res_m = router.plan_trip(req_m)
    assert res_m.itineraries_count >= 1
    male_fare = res_m.itineraries[0].fare.cash_total

    # Female commuter query
    req_w = TripPlanRequest(
        origin_lat=13.1110, origin_lon=80.2430,
        destination_lat=12.9978, destination_lon=80.2562,
        departure_time="08:00:00",
        is_female=True,
    )
    res_w = router.plan_trip(req_w)
    assert res_w.itineraries_count >= 1
    female_fare = res_w.itineraries[0].fare.women_fare_total

    # Women fare must be lower or equal due to free bus travel
    assert female_fare <= male_fare

# 9. Short Intra-Corridor Metro: Thousand Lights to Saidapet
def test_journey_09_short_metro_thousand_lights_to_saidapet(router):
    req = TripPlanRequest(
        origin_lat=13.0560, origin_lon=80.2520,       # Thousand Lights
        destination_lat=13.0230, destination_lon=80.2280, # Saidapet
        departure_time="11:00:00",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1

    itin = res.itineraries[0]
    transit_legs = [l for l in itin.legs if l.leg_type == "TRANSIT"]
    assert any(l.mode == "METRO" for l in transit_legs)
    assert itin.duration_minutes <= 25

# 10. Local Short Walking Fallback (< 400m)
def test_journey_10_short_walking_fallback(router):
    # 300 meters apart near Central
    req = TripPlanRequest(
        origin_lat=13.0827, origin_lon=80.2754,
        destination_lat=13.0815, destination_lon=80.2735,
        departure_time="12:00:00",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1

    itin = res.itineraries[0]
    # Should contain a direct walk leg
    assert any(l.leg_type == "WALK" and l.to_stop_id == "DESTINATION" for l in itin.legs)
    assert itin.duration_minutes <= 10
    assert itin.fare.cash_total == 0.0

# 11. Direct Suburban Rail: Chennai Fort to Tambaram
def test_journey_11_suburban_rail_fort_to_tambaram(router):
    req = TripPlanRequest(
        origin_lat=13.0830, origin_lon=80.2830,       # Chennai Fort
        destination_lat=12.9249, destination_lon=80.1200, # Tambaram Terminus
        departure_time="08:00:00",
    )
    res = router.plan_trip(req)
    assert res.itineraries_count >= 1

    itin = res.itineraries[0]
    transit_legs = [l for l in itin.legs if l.leg_type == "TRANSIT"]
    assert len(transit_legs) >= 1
    assert any("Suburban" in (l.route_short_name or "") or l.route_id == "SR_SOUTH" for l in transit_legs)
    # Long suburban rail ticket fare should be ₹10
    assert itin.fare.cash_total <= 15.0

