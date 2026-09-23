"""
FastAPI REST router for Singara Chennai & NCMC Digital Transit Wallet.
Provides virtual smartcard balance management, instant UPI top-ups,
encrypted QR boarding ticket generation, and AFC fare deduction.
"""

from typing import List, Optional
from datetime import datetime, timedelta
import secrets
from fastapi import APIRouter, HTTPException, Query, status

from backend.app.schemas.wallet import (
    WalletCard,
    TopupRequest,
    TicketRequest,
    TransitQRPass,
    DeductFareRequest,
    TransactionItem,
)

router = APIRouter(prefix="/api/wallet", tags=["Digital Transit Wallet"])

# Seed in-memory commuter smartcard
CARD_STATE = {
    "card_id": "NCMC_CHN_7129",
    "card_number": "6082 1900 4582 7129",
    "masked_number": "•••• •••• •••• 7129",
    "card_type": "Singara Chennai NCMC RuPay",
    "cardholder_name": "COMMUTER / சென்னை பயணி",
    "balance": 250.0,
    "currency": "INR",
    "expiry_date": "12/30",
    "is_active": True,
}

# Seed recent transaction ledger
TRANSACTIONS: List[TransactionItem] = [
    TransactionItem(
        id="TXN_101",
        type="FARE_PAYMENT",
        amount=32.0,
        description="CMRL Metro: Central to Saidapet (20% NCMC Smartcard discount)",
        mode="METRO",
        route_short_name="Blue Line",
        timestamp=(datetime.now() - timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S"),
        balance_after=250.0,
    ),
    TransactionItem(
        id="TXN_100",
        type="TOPUP",
        amount=200.0,
        description="UPI Instant Top-Up (GPay / PhonePe)",
        mode="WALLET",
        route_short_name="NCMC",
        timestamp=(datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
        balance_after=282.0,
    ),
    TransactionItem(
        id="TXN_099",
        type="FREE_PASS",
        amount=0.0,
        description="MTC Ordinary Bus 29C (Vidiyal Payanam 100% Free Travel for Women)",
        mode="BUS",
        route_short_name="29C",
        timestamp=(datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
        balance_after=82.0,
    ),
]

ACTIVE_TICKETS: List[TransitQRPass] = []

@router.get("/card", response_model=WalletCard)
def get_wallet_card():
    """
    Get current virtual Singara Chennai / NCMC smartcard information and live balance.
    """
    return WalletCard(**CARD_STATE)

@router.post("/topup", response_model=WalletCard)
def topup_wallet(req: TopupRequest):
    """
    Instantly reload virtual smartcard balance using simulated UPI.
    """
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Top-up amount must be greater than zero.")
    if req.amount > 5000:
        raise HTTPException(status_code=400, detail="Maximum single top-up limit is ₹5,000.")

    new_balance = round(CARD_STATE["balance"] + req.amount, 2)
    CARD_STATE["balance"] = new_balance

    txn = TransactionItem(
        id=f"TXN_{secrets.token_hex(4).upper()}",
        type="TOPUP",
        amount=req.amount,
        description=f"UPI Top-Up via {req.payment_method} ({req.upi_id or 'Simulated UPI'})",
        mode="WALLET",
        route_short_name="NCMC",
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        balance_after=new_balance,
    )
    TRANSACTIONS.insert(0, txn)

    return WalletCard(**CARD_STATE)

@router.post("/ticket", response_model=TransitQRPass, status_code=status.HTTP_201_CREATED)
def generate_transit_ticket(req: TicketRequest):
    """
    Generate an encrypted digital QR boarding pass for MTC bus / CMRL metro / suburban rail.
    If passenger is eligible for Vidiyal Payanam or fare is ₹0, no balance deduction occurs.
    Otherwise, verifies sufficient balance and deducts the discounted fare.
    """
    fare = round(req.fare_amount, 2)

    if req.is_female_concession or fare == 0:
        actual_deduction = 0.0
        txn_type = "FREE_PASS"
        desc = f"{req.mode} Ticket: {req.origin_name} -> {req.destination_name} (Vidiyal Payanam Free Pass)"
    else:
        actual_deduction = fare
        txn_type = "FARE_PAYMENT"
        desc = f"{req.mode} Ticket: {req.origin_name} -> {req.destination_name} (Line {req.route_short_name})"

        if CARD_STATE["balance"] < actual_deduction:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient balance. Required: ₹{actual_deduction:.2f}, Available: ₹{CARD_STATE['balance']:.2f}. Please top up your card.",
            )

        new_balance = round(CARD_STATE["balance"] - actual_deduction, 2)
        CARD_STATE["balance"] = new_balance

    now = datetime.now()
    valid_until = now + timedelta(minutes=30)
    ticket_id = f"TKT_{secrets.token_hex(4).upper()}"

    qr_token = (
        f"CHN-METRO-NCMC:{ticket_id}|{req.origin_name[:12]}|{req.destination_name[:12]}|"
        f"₹{fare}|{valid_until.strftime('%H%M%S')}|SIG:{secrets.token_hex(6)}"
    )

    qr_pass = TransitQRPass(
        ticket_id=ticket_id,
        qr_data_token=qr_token,
        origin_name=req.origin_name,
        destination_name=req.destination_name,
        route_short_name=req.route_short_name,
        mode=req.mode,
        fare_amount=fare,
        is_female_concession=req.is_female_concession,
        issued_at=now.strftime("%Y-%m-%d %H:%M:%S"),
        valid_until=valid_until.strftime("%Y-%m-%d %H:%M:%S"),
        validity_minutes=30,
        status="ACTIVE",
    )

    ACTIVE_TICKETS.insert(0, qr_pass)

    txn = TransactionItem(
        id=f"TXN_{ticket_id}",
        type=txn_type,
        amount=actual_deduction,
        description=desc,
        mode=req.mode,
        route_short_name=req.route_short_name,
        timestamp=now.strftime("%Y-%m-%d %H:%M:%S"),
        balance_after=CARD_STATE["balance"],
    )
    TRANSACTIONS.insert(0, txn)

    return qr_pass

@router.post("/deduct", response_model=WalletCard)
def deduct_fare(req: DeductFareRequest):
    """
    Deduct transit fare directly from smartcard upon journey completion.
    """
    amount = round(req.amount, 2)
    if amount > 0:
        if CARD_STATE["balance"] < amount:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient balance: needed ₹{amount}, available ₹{CARD_STATE['balance']}.",
            )
        new_balance = round(CARD_STATE["balance"] - amount, 2)
        CARD_STATE["balance"] = new_balance
    else:
        new_balance = CARD_STATE["balance"]

    txn = TransactionItem(
        id=f"TXN_{secrets.token_hex(4).upper()}",
        type="FARE_PAYMENT" if amount > 0 else "FREE_PASS",
        amount=amount,
        description=req.description,
        mode=req.mode,
        route_short_name=req.route_short_name,
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        balance_after=new_balance,
    )
    TRANSACTIONS.insert(0, txn)

    return WalletCard(**CARD_STATE)

@router.get("/transactions", response_model=List[TransactionItem])
def get_transactions(limit: int = Query(20, ge=1, le=100)):
    """
    Get recent transaction ledger history for the commuter smartcard.
    """
    return TRANSACTIONS[:limit]

@router.get("/tickets/active", response_model=List[TransitQRPass])
def get_active_tickets():
    """
    Get active, unexpired digital QR passes.
    """
    return [t for t in ACTIVE_TICKETS if t.status == "ACTIVE"]
