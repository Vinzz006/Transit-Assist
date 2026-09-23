"""
Pydantic schemas for Singara Chennai & NCMC Digital Transit Wallet and QR Ticketing.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

class WalletCard(BaseModel):
    card_id: str
    card_number: str  # e.g. "6082 1900 4582 7129"
    masked_number: str  # e.g. "•••• •••• •••• 7129"
    card_type: str = "Singara Chennai NCMC RuPay"
    cardholder_name: str = "COMMUTER / சென்னை பயணி"
    balance: float
    currency: str = "INR"
    expiry_date: str = "12/30"
    is_active: bool = True

class TopupRequest(BaseModel):
    amount: float = Field(..., gt=0, le=5000, description="Top-up amount in INR")
    payment_method: str = "UPI"  # "UPI", "GPAY", "PHONEPE", "PAYTM", "NETBANKING"
    upi_id: Optional[str] = "commuter@oksbi"

class TicketRequest(BaseModel):
    itinerary_id: Optional[str] = None
    origin_name: str
    destination_name: str
    route_short_name: str = "CMRL Metro"
    mode: str = "METRO"  # "METRO", "BUS", "SUBURBAN_RAIL", "MULTIMODAL"
    fare_amount: float
    is_female_concession: bool = False

class TransitQRPass(BaseModel):
    ticket_id: str
    qr_data_token: str
    origin_name: str
    destination_name: str
    route_short_name: str
    mode: str
    fare_amount: float
    is_female_concession: bool = False
    issued_at: str
    valid_until: str
    validity_minutes: int = 30
    status: str = "ACTIVE"  # "ACTIVE", "USED", "EXPIRED"

class DeductFareRequest(BaseModel):
    amount: float = Field(..., ge=0)
    description: str
    mode: str = "TRANSIT"
    route_short_name: Optional[str] = None

class TransactionItem(BaseModel):
    id: str
    type: str  # "TOPUP", "FARE_PAYMENT", "FREE_PASS"
    amount: float
    description: str
    mode: Optional[str] = None
    route_short_name: Optional[str] = None
    timestamp: str
    balance_after: float
