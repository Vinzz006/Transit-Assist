import pytest
from backend.app.routing.fares import FareCalculator

@pytest.fixture
def calculator():
    return FareCalculator()

def test_bus_ordinary_fares(calculator):
    # 1.5 km -> 1 stage -> ₹5
    f1 = calculator.calculate_leg_fare("MTC", 3, 1500, "ordinary")
    assert f1.fare_amount == 5.0
    assert f1.mode == "bus"

    # 9.5 km -> 5 stages -> ₹9
    f2 = calculator.calculate_leg_fare("MTC", 3, 9500, "ordinary")
    assert f2.fare_amount == 9.0

    # 50 km -> 25 stages (>20 stages) -> ₹23
    f3 = calculator.calculate_leg_fare("MTC", 3, 50000, "ordinary")
    assert f3.fare_amount == 23.0

def test_bus_concessions_women_free(calculator):
    # Standard male passenger pays ₹5
    m_fare = calculator.calculate_leg_fare("MTC", 3, 1500, "ordinary", is_female=False)
    assert m_fare.fare_amount == 5.0

    # Female passenger pays ₹0 under Vidiyal Payanam
    w_fare = calculator.calculate_leg_fare("MTC", 3, 1500, "ordinary", is_female=True)
    assert w_fare.fare_amount == 0.0
    assert "Vidiyal Payanam" in w_fare.scheme_applied

def test_bus_service_multipliers(calculator):
    # Ordinary 1 stage = 5
    # Express = (5 * 1.5) + 0.5 = 8.0
    exp = calculator.calculate_leg_fare("MTC", 3, 1500, "express")
    assert exp.fare_amount == 8.0

    # Deluxe = (5 * 2.0) + 1.0 = 11.0
    dlx = calculator.calculate_leg_fare("MTC", 3, 1500, "deluxe")
    assert dlx.fare_amount == 11.0

def test_metro_slab_fares(calculator):
    # 0-2 km slab -> ₹10 (token), ₹8 (card)
    m1 = calculator.calculate_leg_fare("CMRL", 1, 1500)
    assert m1.fare_amount == 10.0
    assert m1.discounted_amount == 8.0
    assert m1.mode == "metro"

    # 4-6 km slab -> ₹30 (token), ₹24 (card)
    m2 = calculator.calculate_leg_fare("CMRL", 1, 5000)
    assert m2.fare_amount == 30.0
    assert m2.discounted_amount == 24.0

    # >9 km slab -> ₹50 (token), ₹40 (card)
    m3 = calculator.calculate_leg_fare("CMRL", 1, 15000)
    assert m3.fare_amount == 50.0
    assert m3.discounted_amount == 40.0

def test_total_fare_aggregation(calculator):
    leg1 = calculator.calculate_leg_fare("MTC", 3, 3000, "ordinary")  # ₹6
    leg2 = calculator.calculate_leg_fare("CMRL", 1, 15000)            # ₹50 token / ₹40 card

    total = calculator.calculate_total_fare([leg1, leg2])
    assert total.cash_total == 56.0
    assert total.smartcard_total == 46.0
    # Women fare: ₹0 bus + ₹40 metro = ₹40
    assert total.women_fare_total == 40.0

def test_suburban_rail_fares(calculator):
    # Short trip: 5km (<20km) -> ₹5 token
    sr1 = calculator.calculate_leg_fare("SR", 2, 5000)
    assert sr1 is not None
    assert sr1.fare_amount == 5.0
    assert sr1.mode == "suburban_rail"

    # Longer trip: 28km (20-45km) -> ₹10 token
    sr2 = calculator.calculate_leg_fare("SR", 2, 28000)
    assert sr2.fare_amount == 10.0
    assert round(sr2.discounted_amount, 2) == 9.70

