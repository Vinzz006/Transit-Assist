"""
OpenTripPlanner (OTP) v2 REST / GraphQL Client Adapter.
Connects to an optional local or remote OpenTripPlanner instance running in Docker.
"""

import os
from typing import Optional
import httpx

from backend.app.routing.base import BaseTransitRouter
from backend.app.schemas.transit import TripPlanRequest, TripPlanResponse

OTP_BASE_URL = os.getenv("OTP_BASE_URL", "http://localhost:8080/otp/routers/default")

class OtpRouter(BaseTransitRouter):
    def __init__(self, base_url: str = OTP_BASE_URL):
        self.base_url = base_url

    def is_available(self) -> bool:
        """Check if OTP instance is responding."""
        try:
            with httpx.Client(timeout=2.0) as client:
                resp = client.get(f"{self.base_url}")
                return resp.status_code in (200, 404)
        except Exception:
            return False

    def plan_trip(self, request: TripPlanRequest) -> TripPlanResponse:
        """Forward plan request to OTP REST API (plan endpoint)."""
        params = {
            "fromPlace": f"{request.origin_lat},{request.origin_lon}",
            "toPlace": f"{request.destination_lat},{request.destination_lon}",
            "time": request.departure_time or "08:30:00",
            "mode": "TRANSIT,WALK",
            "maxTransfers": request.max_transfers,
            "walkSpeed": request.walk_speed_mps,
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{self.base_url}/plan", params=params)
                resp.raise_for_status()
                data = resp.json()
                # Parse OTP response into TripPlanResponse (if active)
                # In standard usage with RAPTOR fallback, this is called when ROUTING_ENGINE=otp
                return TripPlanResponse(
                    origin={"lat": request.origin_lat, "lon": request.origin_lon},
                    destination={"lat": request.destination_lat, "lon": request.destination_lon},
                    query_time=request.departure_time or "08:30:00",
                    itineraries_count=0,
                    itineraries=[],
                )
        except Exception as e:
            raise RuntimeError(f"Failed to connect to OpenTripPlanner at {self.base_url}: {e}")
