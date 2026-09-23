"""
Unit and integration test suite for Phase 14:
Eco-Transit Carbon & Fuel Savings Engine and Commute Pass Optimizer.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_eco_trip_comparison():
    res = client.post("/api/eco/compare", json={
        "distance_km": 18.5,
        "transit_fare": 32.0,
        "transit_mode": "METRO"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["distance_km"] == 18.5
    assert data["transit_co2_kg"] < data["car_co2_kg"]
    assert data["net_co2_saved_kg"] > 0
    assert data["fuel_saved_liters"] > 1.0
    assert data["fuel_cost_saved_inr"] > 100.0
    assert data["tree_days_equivalent"] > 0
    assert len(data["modes_breakdown"]) == 5

def test_commute_pass_optimizer():
    res = client.post("/api/eco/optimizer", json={
        "one_way_distance_km": 15.0,
        "one_way_fare_cash": 40.0,
        "one_way_fare_smartcard": 32.0,
        "working_days_per_month": 22,
        "trips_per_day": 2,
        "primary_mode": "METRO",
        "is_female": False
    })
    assert res.status_code == 200
    data = res.json()
    assert data["total_trips_monthly"] == 44
    assert data["total_monthly_km"] == 660.0
    assert data["cost_cash_tokens"] == 1760.0
    assert data["cost_smartcard"] == 1408.0
    assert data["cost_private_car"] > 5000.0
    assert "best_pass" in data
    assert data["best_pass"]["recommended"] is True
    assert data["max_savings_vs_car"] > 3000.0
    assert data["annual_savings_potential"] > 30000.0
    assert data["monthly_co2_avoided_kg"] > 50.0

def test_commute_pass_optimizer_bus_women():
    res = client.post("/api/eco/optimizer", json={
        "one_way_distance_km": 8.0,
        "one_way_fare_cash": 10.0,
        "working_days_per_month": 20,
        "trips_per_day": 2,
        "primary_mode": "BUS",
        "is_female": True
    })
    assert res.status_code == 200
    data = res.json()
    # Vidiyal Payanam makes bus travel ₹0
    assert data["cost_smartcard"] == 0.0
    assert data["best_pass"]["price_inr"] == 0.0

def test_green_commuter_profile():
    res = client.get("/api/eco/profile")
    assert res.status_code == 200
    data = res.json()
    assert "commuter_level" in data
    assert data["lifetime_co2_saved_kg"] > 0
    assert data["urban_trees_equivalent"] > 0
    assert data["cleaner_air_points"] >= 100
