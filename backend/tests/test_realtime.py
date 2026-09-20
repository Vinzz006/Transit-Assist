"""
Unit and integration tests for Real-Time Vehicle Tracking and GTFS-RT Feeds.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.main import app
from backend.app.db.database import get_db, Base
from backend.app.db.models import TransitReport
from backend.app.realtime.simulator import VehicleTracker, calculate_bearing, haversine_distance

client = TestClient(app)

def test_haversine_and_bearing():
    # Chennai Central (13.0827, 80.2754) to Chennai Airport (12.9856, 80.1636)
    dist = haversine_distance(13.0827, 80.2754, 12.9856, 80.1636)
    assert 14000 < dist < 18000  # ~16 km

    bearing = calculate_bearing(13.0827, 80.2754, 12.9856, 80.1636)
    # Airport is South-West of Central (~220 degrees)
    assert 200 <= bearing <= 250

def test_realtime_vehicles_api():
    # Query at 08:30:00 morning peak
    resp = client.get("/api/realtime/vehicles?time=08:30:00")
    assert resp.status_code == 200
    vehicles = resp.json()
    assert isinstance(vehicles, list)
    assert len(vehicles) > 0

    first = vehicles[0]
    assert "vehicle_id" in first
    assert "trip_id" in first
    assert "latitude" in first
    assert "longitude" in first
    assert "bearing" in first
    assert 0.0 <= first["bearing"] <= 360.0
    assert "speed_kmh" in first
    assert "current_status" in first
    assert first["current_status"] in ["IN_TRANSIT_TO", "STOPPED_AT"]
    assert "occupancy_status" in first
    assert "timestamp" in first

def test_realtime_vehicles_route_filter():
    resp = client.get("/api/realtime/vehicles?time=08:30:00&route_id=CMRL_BLUE")
    assert resp.status_code == 200
    vehicles = resp.json()
    assert len(vehicles) > 0
    for v in vehicles:
        assert v["route_id"] == "CMRL_BLUE"
        assert v["route_type"] == 1

def test_realtime_vehicles_mode_filter():
    resp_bus = client.get("/api/realtime/vehicles?time=08:30:00&route_type=3")
    assert resp_bus.status_code == 200
    bus_vehicles = resp_bus.json()
    for v in bus_vehicles:
        assert v["route_type"] == 3

    resp_rail = client.get("/api/realtime/vehicles?time=08:30:00&route_type=2")
    assert resp_rail.status_code == 200
    rail_vehicles = resp_rail.json()
    for v in rail_vehicles:
        assert v["route_type"] == 2

def test_realtime_trip_updates_api():
    resp = client.get("/api/realtime/trip-updates?time=08:30:00")
    assert resp.status_code == 200
    updates = resp.json()
    assert isinstance(updates, list)
    if len(updates) > 0:
        first = updates[0]
        assert "trip_id" in first
        assert "delay_seconds" in first
        assert "stop_time_updates" in first

def test_realtime_gtfs_rt_feed():
    resp = client.get("/api/realtime/gtfs-rt?time=08:30:00")
    assert resp.status_code == 200
    feed = resp.json()
    assert "header" in feed
    assert feed["header"]["gtfs_realtime_version"] == "2.0"
    assert "entity" in feed
    assert len(feed["entity"]) > 0

    # Verify at least one vehicle position entity
    vp_entities = [e for e in feed["entity"] if e.get("vehicle") is not None]
    assert len(vp_entities) > 0
    vp = vp_entities[0]["vehicle"]
    assert "position" in vp
    assert "latitude" in vp["position"]
    assert "longitude" in vp["position"]
    assert "bearing" in vp["position"]
