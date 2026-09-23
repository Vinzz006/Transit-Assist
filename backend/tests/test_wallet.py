"""
Unit and integration test suite for Phase 13:
Singara Chennai & NCMC Digital Transit Wallet, QR Ticketing, and Balance Management.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_get_wallet_card():
    res = client.get("/api/wallet/card")
    assert res.status_code == 200
    data = res.json()
    assert "card_id" in data
    assert "masked_number" in data
    assert data["currency"] == "INR"
    assert data["balance"] >= 0
    assert data["is_active"] is True

def test_topup_wallet():
    # 1. Check current balance
    initial = client.get("/api/wallet/card").json()["balance"]

    # 2. Top-up ₹100
    res = client.post("/api/wallet/topup", json={
        "amount": 100.0,
        "payment_method": "UPI_GPAY",
        "upi_id": "commuter@oksbi"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["balance"] == initial + 100.0

    # 3. Verify topup appears in transaction ledger
    txns = client.get("/api/wallet/transactions").json()
    assert len(txns) > 0
    assert txns[0]["type"] == "TOPUP"
    assert txns[0]["amount"] == 100.0

def test_generate_transit_ticket():
    initial_balance = client.get("/api/wallet/card").json()["balance"]

    # Generate a Metro ticket for ₹32
    res = client.post("/api/wallet/ticket", json={
        "origin_name": "Chennai Central",
        "destination_name": "Chennai Airport",
        "route_short_name": "Blue Line",
        "mode": "METRO",
        "fare_amount": 32.0,
        "is_female_concession": False
    })
    assert res.status_code == 201
    ticket = res.json()
    assert "ticket_id" in ticket
    assert "qr_data_token" in ticket
    assert ticket["status"] == "ACTIVE"
    assert ticket["fare_amount"] == 32.0
    assert ticket["validity_minutes"] == 30

    # Check balance was deducted
    after_balance = client.get("/api/wallet/card").json()["balance"]
    assert round(after_balance, 2) == round(initial_balance - 32.0, 2)

def test_vidiyal_payanam_free_pass():
    initial_balance = client.get("/api/wallet/card").json()["balance"]

    # Generate a free Vidiyal Payanam bus pass
    res = client.post("/api/wallet/ticket", json={
        "origin_name": "T. Nagar",
        "destination_name": "Adyar",
        "route_short_name": "29C",
        "mode": "BUS",
        "fare_amount": 0.0,
        "is_female_concession": True
    })
    assert res.status_code == 201
    ticket = res.json()
    assert ticket["is_female_concession"] is True
    assert ticket["fare_amount"] == 0.0

    # Balance must remain unchanged
    after_balance = client.get("/api/wallet/card").json()["balance"]
    assert after_balance == initial_balance

def test_deduct_fare():
    initial = client.get("/api/wallet/card").json()["balance"]
    res = client.post("/api/wallet/deduct", json={
        "amount": 10.0,
        "description": "Suburban Rail Beach to Egmore",
        "mode": "SUBURBAN_RAIL",
        "route_short_name": "EMU"
    })
    assert res.status_code == 200
    assert round(res.json()["balance"], 2) == round(initial - 10.0, 2)

def test_insufficient_balance_error():
    # Attempt to buy a ticket exceeding balance
    current_balance = client.get("/api/wallet/card").json()["balance"]
    res = client.post("/api/wallet/ticket", json={
        "origin_name": "Chennai",
        "destination_name": "Bengaluru",
        "route_short_name": "Express",
        "mode": "RAIL",
        "fare_amount": current_balance + 10000.0,
        "is_female_concession": False
    })
    assert res.status_code == 400
    assert "Insufficient balance" in res.json()["detail"]
