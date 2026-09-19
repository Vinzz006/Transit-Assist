"""
Transit routing package.
Exposes router instance based on ROUTING_ENGINE env variable (default: raptor).
"""

import os
from backend.app.routing.base import BaseTransitRouter
from backend.app.routing.raptor import raptor_router
from backend.app.routing.otp_client import OtpRouter

def get_router() -> BaseTransitRouter:
    engine_type = os.getenv("ROUTING_ENGINE", "raptor").lower()
    if engine_type == "otp":
        return OtpRouter()
    return raptor_router
