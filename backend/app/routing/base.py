"""
Abstract Base Class for Transit Routers.
Defines common interface for RAPTOR and OpenTripPlanner (OTP) connectors.
"""

from abc import ABC, abstractmethod
from typing import Optional
from backend.app.schemas.transit import TripPlanRequest, TripPlanResponse

class BaseTransitRouter(ABC):
    @abstractmethod
    def plan_trip(self, request: TripPlanRequest) -> TripPlanResponse:
        """Calculate trip plan between origin and destination."""
        pass
