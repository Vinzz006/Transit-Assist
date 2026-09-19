"""
Central Application Configuration & Feature Flag Matrix.
Controls environment settings, database paths, and toggles for stretch features.
"""

import os
from typing import Dict
from pydantic import BaseModel, Field

def _get_bool_env(key: str, default: bool = True) -> bool:
    val = os.getenv(key)
    if val is None:
        return default
    return val.strip().lower() in ("true", "1", "yes", "on")

class AppSettings(BaseModel):
    # Core Application Settings
    app_name: str = "Transit Assist India"
    city: str = "Chennai"
    version: str = "1.2.0"
    debug: bool = Field(default_factory=lambda: _get_bool_env("DEBUG", False))

    # Feature Flags (Phases 8-14)
    enable_multimodal_preferences: bool = Field(
        default_factory=lambda: _get_bool_env("FEATURE_MULTIMODAL_PREFERENCES", True)
    )
    enable_auto_taxi_legs: bool = Field(
        default_factory=lambda: _get_bool_env("FEATURE_AUTO_TAXI_LEGS", True)
    )
    enable_safety_sos: bool = Field(
        default_factory=lambda: _get_bool_env("FEATURE_SAFETY_SOS", True)
    )
    enable_trip_sharing: bool = Field(
        default_factory=lambda: _get_bool_env("FEATURE_TRIP_SHARING", True)
    )
    enable_journey_alerts: bool = Field(
        default_factory=lambda: _get_bool_env("FEATURE_JOURNEY_ALERTS", True)
    )
    enable_web_push: bool = Field(
        default_factory=lambda: _get_bool_env("FEATURE_WEB_PUSH", True)
    )
    enable_crowd_reports: bool = Field(
        default_factory=lambda: _get_bool_env("FEATURE_CROWD_REPORTS", True)
    )
    enable_accessibility_modes: bool = Field(
        default_factory=lambda: _get_bool_env("FEATURE_ACCESSIBILITY_MODES", True)
    )
    enable_saved_places: bool = Field(
        default_factory=lambda: _get_bool_env("FEATURE_SAVED_PLACES", True)
    )
    enable_admin_dashboard: bool = Field(
        default_factory=lambda: _get_bool_env("FEATURE_ADMIN_DASHBOARD", True)
    )

    # Security Keys
    share_token_secret: str = Field(
        default_factory=lambda: os.getenv("SHARE_TOKEN_SECRET", "chennai-transit-secure-key-2024")
    )
    admin_api_key: str = Field(
        default_factory=lambda: os.getenv("ADMIN_API_KEY", "chennai-transit-admin-secret")
    )

    def get_feature_flags(self) -> Dict[str, bool]:
        """Return dict of active feature flags for client consumption."""
        return {
            "multimodal_preferences": self.enable_multimodal_preferences,
            "auto_taxi_legs": self.enable_auto_taxi_legs,
            "safety_sos": self.enable_safety_sos,
            "trip_sharing": self.enable_trip_sharing,
            "journey_alerts": self.enable_journey_alerts,
            "web_push": self.enable_web_push,
            "crowd_reports": self.enable_crowd_reports,
            "accessibility_modes": self.enable_accessibility_modes,
            "saved_places": self.enable_saved_places,
            "admin_dashboard": self.enable_admin_dashboard,
        }

settings = AppSettings()
