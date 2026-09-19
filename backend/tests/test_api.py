"""
Integration test suite for FastAPI Transit Assist India endpoints.
Tests /health, /stops, /stops/nearby, /arrivals, /plan, and /routes.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert data["city"] == "Chennai"
    assert data["total_stops"] >= 20
    assert data["total_routes"] >= 5

def test_search_stops_english(client):
    res = client.get("/api/stops", params={"q": "Central"})
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert any("Central" in s["stop_name"] for s in data)

def test_search_stops_tamil(client):
    # Search with Tamil script
    res = client.get("/api/stops", params={"q": "சென்ட்ரல்"})
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert any("Central" in s["stop_name"] for s in data)

def test_search_stops_airport(client):
    res = client.get("/api/stops", params={"q": "Airport"})
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert any("Airport" in s["stop_name"] or "விமான" in s["stop_name"] for s in data)

def test_nearby_stops(client):
    # Location near Chennai Central
    res = client.get(
        "/api/stops/nearby",
        params={"lat": 13.0827, "lon": 80.2754, "radius_meters": 1000},
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    # Closest stop should be Central itself with distance < 100 meters
    first_stop = data[0]
    assert first_stop["stop_id"] == "ST_CENTRAL"
    assert first_stop["distance_meters"] <= 100.0

def test_get_stop_detail(client):
    res = client.get("/api/stops/ST_CENTRAL")
    assert res.status_code == 200
    data = res.json()
    assert data["stop_id"] == "ST_CENTRAL"
    assert "Central" in data["stop_name"]
    assert data["routes_count"] >= 1

    # 404 check
    res_404 = client.get("/api/stops/NON_EXISTENT_STOP_ID")
    assert res_404.status_code == 404

def test_get_arrivals(client):
    res = client.get("/api/arrivals", params={"stop_id": "ST_CENTRAL", "time": "08:30:00"})
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    first_arr = data[0]
    assert "trip_id" in first_arr
    assert "route_short_name" in first_arr
    assert "eta_minutes" in first_arr
    assert first_arr["eta_minutes"] >= 0

def test_plan_journey_api(client):
    payload = {
        "origin_lat": 13.0827,
        "origin_lon": 80.2754,
        "destination_lat": 12.9780,
        "destination_lon": 80.1640,
        "departure_time": "08:30:00",
        "is_female": False,
    }
    res = client.post("/api/plan", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["itineraries_count"] >= 1
    first_itin = data["itineraries"][0]
    assert len(first_itin["legs"]) >= 1
    assert "fare" in first_itin
    assert first_itin["fare"]["cash_total"] > 0

def test_list_routes(client):
    res = client.get("/api/routes")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 5
    short_names = [r["route_short_name"] for r in data]
    assert "Blue Line" in short_names
    assert "Green Line" in short_names
    assert "29C" in short_names

def test_get_route_detail(client):
    res = client.get("/api/routes/CMRL_BLUE")
    assert res.status_code == 200
    data = res.json()
    assert data["route_id"] == "CMRL_BLUE"
    assert data["mode"] == "METRO"
    assert len(data["direction_0"]["stops"]) >= 8
    assert len(data["polyline"]) >= 8

def test_openapi_docs_endpoint(client):
    res = client.get("/docs")
    assert res.status_code == 200
    openapi_res = client.get("/openapi.json")
    assert openapi_res.status_code == 200
    openapi_data = openapi_res.json()
    assert openapi_data["info"]["title"] == "Transit Assist India API"

def test_crowdsourced_reports_api(client):
    # Submit report
    post_res = client.post(
        "/api/reports",
        json={
            "route_id": "CMRL_BLUE",
            "crowd_level": "moderate",
            "delay_minutes": 3,
            "comment": "Crowd picking up at Guindy",
        },
    )
    assert post_res.status_code == 201
    rep = post_res.json()
    assert rep["route_id"] == "CMRL_BLUE"
    assert rep["crowd_level"] == "moderate"

    # Query summary
    summary_res = client.get("/api/reports/summary/CMRL_BLUE")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["route_id"] == "CMRL_BLUE"
    assert summary["total_reports"] >= 1
    assert summary["crowd_level"] in ("low", "moderate", "packed")

