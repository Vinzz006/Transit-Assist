"""
Unit & integration tests for Phase 11:
Station Accessibility Directory and Wheelchair Step-Free Route Planning.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_get_all_accessible_stations():
    res = client.get("/api/accessibility/stations")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 5
    central = next((s for s in data if s["stop_id"] == "ST_CENTRAL"), None)
    assert central is not None
    assert central["has_elevators"] is True
    assert central["has_wheelchair_ramp"] is True
    assert central["has_tactile_paths"] is True
    assert central["elevator_count"] >= 4
    assert central["accessibility_level"] == "FULL"

def test_filter_accessible_stations_by_mode():
    res = client.get("/api/accessibility/stations?mode=METRO")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 3
    for s in data:
        assert s["mode"] == "METRO"
        assert s["has_elevators"] is True

def test_get_station_accessibility_detail():
    res = client.get("/api/accessibility/stations/ST_AIRPORT")
    assert res.status_code == 200
    data = res.json()
    assert data["stop_id"] == "ST_AIRPORT"
    assert "விமான" in data["station_name_ta"]
    assert data["has_elevators"] is True
    assert data["accessibility_level"] == "FULL"

def test_wheelchair_accessible_trip_planning():
    # Plan journey with wheelchair_accessible flag
    req = {
        "origin_lat": 13.0827,
        "origin_lon": 80.2754,
        "destination_lat": 12.9780,
        "destination_lon": 80.1640,
        "departure_time": "08:30:00",
        "wheelchair_accessible": True,
    }
    res = client.post("/api/plan", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["itineraries_count"] > 0
    first_itin = data["itineraries"][0]
    # Check that the accessibility flags are populated
    assert "is_wheelchair_accessible" in first_itin
    assert "accessibility_notes" in first_itin
    # If the first route is CMRL Metro, it should be marked accessible
    for leg in first_itin["legs"]:
        if leg["mode"] == "METRO":
            assert leg["is_wheelchair_accessible"] is True
            assert "Elevators" in leg["accessibility_notes"]
