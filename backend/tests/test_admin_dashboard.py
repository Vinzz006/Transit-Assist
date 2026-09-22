"""
Unit and integration test suite for Phase 12:
Admin Transit Operations Center, Network Health Metrics, and Incident Broadcasting.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_admin_metrics():
    res = client.get("/api/admin/metrics")
    assert res.status_code == 200
    data = res.json()
    assert data["city"] == "Chennai"
    assert data["total_stops"] >= 20
    assert data["total_routes"] >= 5
    assert data["active_vehicles_total"] >= 1
    assert data["overall_otp_pct"] > 80.0
    assert data["metro_otp_pct"] >= 95.0
    assert data["network_status"] in ("OPTIMAL", "INCIDENT", "WEATHER_DEGRADED")

def test_admin_get_incidents():
    res = client.get("/api/admin/incidents")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "title_en" in data[0]
    assert "severity" in data[0]

def test_admin_broadcast_and_resolve_incident():
    # 1. Broadcast new incident
    payload = {
        "route_id": "CMRL_BLUE",
        "title_en": "Temporary Platform Screening Maintenance at Guindy",
        "title_ta": "கிண்டியில் தளம் பராமரிப்பு",
        "severity": "WARNING",
        "description_en": "Entry via Gate B advised. Trains operating at 6 min frequency.",
        "description_ta": "நுழைவாயில் பி வழியாக செல்லவும்.",
    }
    post_res = client.post("/api/admin/incidents", json=payload)
    assert post_res.status_code == 201
    incident = post_res.json()
    inc_id = incident["id"]
    assert incident["route_id"] == "CMRL_BLUE"
    assert incident["is_active"] is True
    assert "Gate B" in incident["description_en"]

    # 2. Verify it shows up in active incidents list
    get_res = client.get("/api/admin/incidents")
    assert get_res.status_code == 200
    ids = [inc["id"] for inc in get_res.json()]
    assert inc_id in ids

    # 3. Resolve the incident
    del_res = client.delete(f"/api/admin/incidents/{inc_id}")
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["status"] == "resolved"
    assert del_data["is_active"] is False

    # 4. Verify no longer in active incidents list
    get_active = client.get("/api/admin/incidents?active_only=true")
    active_ids = [inc["id"] for inc in get_active.json()]
    assert inc_id not in active_ids

def test_admin_get_reports():
    res = client.get("/api/admin/reports")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
