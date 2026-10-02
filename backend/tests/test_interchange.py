"""
Unit and integration test suite for Phase 15:
Station Interchange Wayfinding Guide, Platform Directories, and First/Last-Mile Feeder Networks (MTC Small Buses & Chennai Share-Autos).
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_list_interchange_hubs():
    res = client.get("/api/interchange/hubs")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 4
    hub_ids = [h["hub_id"] for h in data]
    assert "HUB_CENTRAL" in hub_ids
    assert "HUB_GUINDY" in hub_ids
    assert "HUB_AIRPORT" in hub_ids
    assert "HUB_TAMBARAM" in hub_ids
    
    # Verify structure of first hub
    first = data[0]
    assert "name_en" in first
    assert "name_ta" in first
    assert "modes" in first
    assert first["total_platforms"] > 0
    assert first["total_exits"] > 0
    assert first["is_step_free"] is True

def test_get_hub_detail():
    res = client.get("/api/interchange/hubs/HUB_CENTRAL")
    assert res.status_code == 200
    data = res.json()
    assert data["hub_id"] == "HUB_CENTRAL"
    assert "Puratchi Thalaivar" in data["name_en"]
    assert "UNDERGROUND_L2" in data["levels"]
    assert len(data["platforms"]) >= 5
    assert len(data["exit_gates"]) >= 4
    assert len(data["amenities"]) >= 3
    assert len(data["feeders"]) >= 3

    # Check Metro and Suburban platforms
    modes = [p["mode"] for p in data["platforms"]]
    assert "METRO" in modes
    assert "SUBURBAN_RAIL" in modes

def test_hub_not_found():
    res = client.get("/api/interchange/hubs/HUB_NON_EXISTENT")
    assert res.status_code == 404

def test_transfer_guide_generation():
    res = client.post("/api/interchange/transfer-guide", json={
        "hub_id": "HUB_CENTRAL",
        "origin_platform_id": "CEN_MTR_P1",
        "destination_platform_id": "CEN_SUB_MMC11",
        "wheelchair_only": False
    })
    assert res.status_code == 200
    data = res.json()
    assert data["hub_id"] == "HUB_CENTRAL"
    assert "Metro" in data["origin_platform_name"]
    assert "Suburban" in data["destination_platform_name"]
    assert data["total_walking_distance_meters"] > 100
    assert data["estimated_walk_duration_minutes"] > 1.0
    assert len(data["steps"]) >= 4
    assert len(data["tips_en"]) >= 2

def test_transfer_guide_wheelchair_mode():
    res = client.post("/api/interchange/transfer-guide", json={
        "hub_id": "HUB_GUINDY",
        "origin_platform_id": "GND_MTR_P1",
        "destination_platform_id": "GND_SUB_P1",
        "wheelchair_only": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_fully_step_free"] is True
    # Verify elevator mention in steps
    step_texts = " ".join([s["instruction_en"] for s in data["steps"]]).lower()
    assert "elevator" in step_texts or "lift" in step_texts

def test_list_station_feeders():
    # All feeders
    res = client.get("/api/interchange/feeders")
    assert res.status_code == 200
    all_feeders = res.json()
    assert len(all_feeders) >= 8

    # Feeders for Guindy
    res_guindy = client.get("/api/interchange/feeders?hub_id=HUB_GUINDY")
    assert res_guindy.status_code == 200
    guindy_feeders = res_guindy.json()
    types = [f["service_type"] for f in guindy_feeders]
    assert "SHARE_AUTO" in types
    assert "MTC_SMALL_BUS" in types

def test_recommend_first_last_mile_feeder():
    # Search for Madipakkam from Guindy
    res = client.post("/api/interchange/feeder-recommend", json={
        "hub_id": "HUB_GUINDY",
        "destination_query": "Madipakkam"
    })
    assert res.status_code == 200
    data = res.json()
    assert len(data["recommended_feeders"]) >= 1
    assert "Madipakkam" in data["recommended_feeders"][0]["destination_en"]
    assert data["fastest_option"] is not None
    assert data["cheapest_option"] is not None

def test_feature_flag_config():
    res = client.get("/api/config/features")
    assert res.status_code == 200
    data = res.json()
    assert "station_interchanges" in data["features"]
    assert data["features"]["station_interchanges"] is True
