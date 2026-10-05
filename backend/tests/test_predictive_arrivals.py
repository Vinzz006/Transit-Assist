"""
Tests for Phase 15: Predictive Arrivals & Delay Estimation.
Verifies statistical rolling average delay calculation, confidence scoring,
feature flag toggling, and empirical superiority over raw timetable schedules.
"""

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.config import settings
from backend.app.ml.predictive_arrivals import (
    get_predictive_arrivals_engine,
    get_time_bucket,
    TIME_BUCKETS,
)
from backend.app.ml.evaluate_predictions import run_evaluation

client = TestClient(app)

def test_time_buckets():
    """Verify seconds of day are mapped to correct commute traffic buckets."""
    assert get_time_bucket(30600) == "morning_peak"   # 08:30:00
    assert get_time_bucket(45000) == "midday_slack"    # 12:30:00
    assert get_time_bucket(63000) == "evening_peak"    # 17:30:00
    assert get_time_bucket(75600) == "night_offpeak"   # 21:00:00
    assert get_time_bucket(7200) == "night_offpeak"    # 02:00:00
    assert get_time_bucket(21600) == "early_morning"   # 06:00:00

def test_predictive_arrivals_evaluation_beats_schedule():
    """
    Acceptance Criterion:
    'predictions measurably beat raw schedule on held-out historical data; UI never presents a guess as fact'
    """
    res = run_evaluation()
    assert res["status"] == "success"
    metrics = res["metrics"]
    assert metrics["hypothesis_verified"] is True
    assert metrics["predictive_model_mae_minutes"] < metrics["schedule_baseline_mae_minutes"]
    # Model should achieve >40% error reduction over raw schedule
    assert metrics["mae_improvement_percent"] > 40.0
    assert len(res["samples"]) >= 10

def test_arrivals_api_predictive_fields():
    """Verify GET /api/arrivals returns enriched Phase 15 predictive fields."""
    response = client.get("/api/arrivals?stop_id=ST_CENTRAL&limit=5&time=08:30:00")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0

    first = data[0]
    assert "departure_time" in first
    assert "scheduled_departure_time" in first
    assert "predicted_departure_time" in first
    assert "predicted_delay_minutes" in first
    assert "confidence_level" in first
    assert first["confidence_level"] in ["HIGH", "MEDIUM", "LOW"]
    assert "confidence_score" in first
    assert 0.0 <= first["confidence_score"] <= 1.0
    assert "data_basis" in first
    assert len(first["data_basis"]) > 5
    assert first["is_predicted"] is True

def test_arrivals_api_fallback_to_raw_schedule_when_disabled():
    """Verify predictive=false explicitly falls back to raw schedule baseline."""
    response = client.get("/api/arrivals?stop_id=ST_CENTRAL&limit=5&time=08:30:00&predictive=false")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0

    first = data[0]
    assert first["is_predicted"] is False
    assert first["predicted_delay_minutes"] == 0
    assert first["departure_time"] == first["scheduled_departure_time"]
    assert "Raw timetable schedule" in first["data_basis"]

def test_arrivals_evaluation_endpoint():
    """Verify GET /api/arrivals/evaluation returns valid benchmark metrics."""
    response = client.get("/api/arrivals/evaluation")
    assert response.status_code == 200
    data = response.json()
    assert data["metrics"]["hypothesis_verified"] is True
    assert data["metrics"]["mae_improvement_percent"] > 40.0

def test_predict_arrivals_evaluation_endpoint():
    """Verify GET /api/predict/arrivals/evaluation returns valid benchmark metrics."""
    response = client.get("/api/predict/arrivals/evaluation")
    assert response.status_code == 200
    data = response.json()
    assert data["metrics"]["hypothesis_verified"] is True

def test_feature_flag_active_in_config():
    """Verify predictive_arrivals flag is returned by /api/config/features."""
    response = client.get("/api/config/features")
    assert response.status_code == 200
    data = response.json()
    assert "predictive_arrivals" in data["features"]
    assert data["features"]["predictive_arrivals"] is True
