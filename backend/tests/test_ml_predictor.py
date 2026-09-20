"""
Unit and integration tests for Predictive AI Arrival Delay & Monsoon Intelligence.
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.ml.delay_predictor import DelayPredictor, get_delay_predictor

client = TestClient(app)

def test_metro_delay_immunity():
    predictor = get_delay_predictor()
    # CMRL Blue line Metro during peak and clear weather
    pred_clear = predictor.predict("CMRL_BLUE", route_type=1, departure_time="08:30:00", weather="clear")
    assert pred_clear["predicted_delay_minutes"] <= 1
    assert pred_clear["risk_level"] == "LOW"
    assert pred_clear["confidence_score"] >= 0.90

    # Even during severe monsoon flood, Metro maintains near-zero delay
    pred_monsoon = predictor.predict("CMRL_BLUE", route_type=1, departure_time="08:30:00", weather="monsoon")
    assert pred_monsoon["predicted_delay_minutes"] <= 2
    assert pred_monsoon["risk_level"] == "LOW"

def test_bus_monsoon_waterlogging_sensitivity():
    predictor = get_delay_predictor()
    # Bus 11G on Velachery corridor (waterlogging hotspot)
    pred_clear = predictor.predict("MTC_11G", route_type=3, departure_time="08:30:00", weather="clear")
    pred_monsoon = predictor.predict("MTC_11G", route_type=3, departure_time="08:30:00", weather="monsoon")

    # Monsoon delay should be substantially higher than clear weather delay
    assert pred_monsoon["predicted_delay_minutes"] > pred_clear["predicted_delay_minutes"]
    assert pred_monsoon["risk_level"] == "HIGH"
    assert pred_monsoon["is_waterlogging_prone"] is True
    assert "Velachery" in pred_monsoon["corridor_name"]
    assert "மழைநீர்" in pred_monsoon["advisory_ta"]

def test_suburban_rail_predict():
    predictor = get_delay_predictor()
    pred = predictor.predict("SR_SOUTH", route_type=2, departure_time="08:30:00", weather="rain")
    assert pred["route_type"] == 2
    assert "advisory_en" in pred
    assert "advisory_ta" in pred

def test_api_predict_delay():
    resp = client.get("/api/predict/delay?route_id=CMRL_BLUE&weather=clear")
    assert resp.status_code == 200
    data = resp.json()
    assert data["route_id"] == "CMRL_BLUE"
    assert data["mode"] == "Metro"
    assert data["risk_level"] == "LOW"
    assert "advisory_en" in data
    assert "advisory_ta" in data

def test_api_predict_corridors():
    resp = client.get("/api/predict/corridors?weather=monsoon")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_corridors_count"] >= 4
    assert len(data["corridors"]) >= 4

    velachery = next((c for c in data["corridors"] if c["corridor_id"] == "velachery"), None)
    assert velachery is not None
    assert velachery["waterlogging_risk"] == "SEVERE"
    assert velachery["monsoon_delay_min"] >= 15

def test_plan_with_weather_predictions():
    # Chennai Central to Airport with monsoon alert
    req = {
        "origin_lat": 13.0827,
        "origin_lon": 80.2754,
        "destination_lat": 12.9856,
        "destination_lon": 80.1636,
        "departure_time": "08:30:00",
        "weather": "monsoon",
    }
    resp = client.post("/api/plan", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert data["itineraries_count"] > 0
    first_itin = data["itineraries"][0]
    assert first_itin["weather_condition"] == "monsoon"
    assert "predicted_delay_minutes" in first_itin

    # Check legs
    for leg in first_itin["legs"]:
        if leg["leg_type"] == "TRANSIT":
            assert "predicted_delay_minutes" in leg
            assert "weather_risk" in leg
            assert "advisory_en" in leg
