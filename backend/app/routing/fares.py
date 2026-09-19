"""
Indian Transit Fare Calculation Module.
Implements Chennai MTC stage-based bus fares, CMRL distance slab metro fares,
smartcard discounts, and the Tamil Nadu 'Vidiyal Payanam' free bus travel scheme for women.
"""

import json
import math
import os
from typing import Dict, List, Optional
from backend.app.schemas.transit import FareBreakdown, TotalFare

DEFAULT_CONFIG_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "fares_config.json")
)

# Fallback in-memory config if JSON file not found
FALLBACK_CONFIG = {
    "city": "Chennai",
    "currency": "INR",
    "currency_symbol": "₹",
    "agencies": {
        "MTC": {
            "name": "Metropolitan Transport Corporation",
            "mode": "bus",
            "pricing_model": "stage_based",
            "stage_distance_km": 2.0,
            "services": {
                "ordinary": {
                    "name": "Ordinary (White Board)",
                    "min_fare": 5.0,
                    "stages": [
                        {"stage": 1, "fare": 5.0},
                        {"stage": 2, "fare": 6.0},
                        {"stage": 3, "fare": 7.0},
                        {"stage": 4, "fare": 8.0},
                        {"stage": 5, "fare": 9.0},
                        {"stage": 6, "fare": 10.0},
                        {"stage": 7, "fare": 11.0},
                        {"stage": 8, "fare": 12.0},
                        {"stage": 9, "fare": 13.0},
                        {"stage": 10, "fare": 14.0},
                        {"stage": 15, "fare": 18.0},
                        {"stage": 20, "fare": 20.0},
                        {"stage": 28, "fare": 23.0},
                    ],
                    "concessions": {"women_free": True, "scheme_name": "Vidiyal Payanam"},
                },
                "express": {"multiplier": 1.5, "addon": 0.5},
                "deluxe": {"multiplier": 2.0, "addon": 1.0},
            },
        },
        "CMRL": {
            "name": "Chennai Metro Rail Limited",
            "mode": "metro",
            "pricing_model": "distance_slab",
            "slabs": [
                {"min_km": 0.0, "max_km": 2.0, "token_fare": 10.0, "card_discount_pct": 20.0},
                {"min_km": 2.0, "max_km": 4.0, "token_fare": 20.0, "card_discount_pct": 20.0},
                {"min_km": 4.0, "max_km": 6.0, "token_fare": 30.0, "card_discount_pct": 20.0},
                {"min_km": 6.0, "max_km": 9.0, "token_fare": 40.0, "card_discount_pct": 20.0},
                {"min_km": 9.0, "max_km": 999.0, "token_fare": 50.0, "card_discount_pct": 20.0},
            ],
            "smartcard_discount_pct": 20.0,
        },
    },
}

class FareCalculator:
    def __init__(self, config_path: str = DEFAULT_CONFIG_PATH):
        self.config = FALLBACK_CONFIG
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    self.config = json.load(f)
            except Exception as e:
                print(f"Warning: Failed to load fare config from {config_path}: {e}")

    def calculate_leg_fare(
        self,
        agency_id: str,
        route_type: int,
        distance_meters: float,
        service_type: str = "ordinary",
        is_female: bool = False,
    ) -> Optional[FareBreakdown]:
        """
        Calculate the fare for a single transit leg.
        route_type: 1=Metro, 2=Rail/Suburban, 3=Bus
        """
        if route_type not in (1, 2, 3):
            return None

        distance_km = max(0.1, distance_meters / 1000.0)

        # Suburban Rail Fare (Southern Railway - SR)
        if route_type == 2 or "SR" in agency_id.upper():
            sr_cfg = self.config.get("agencies", {}).get("SR", {})
            token_fare = 10.0
            card_discount_pct = 3.0

            for slab in sr_cfg.get("slabs", []):
                if slab["min_km"] <= distance_km < slab["max_km"]:
                    token_fare = float(slab["token_fare"])
                    card_discount_pct = float(slab.get("card_discount_pct", 3.0))
                    break

            discounted = token_fare * (1.0 - card_discount_pct / 100.0)

            return FareBreakdown(
                agency_id="SR",
                mode="suburban_rail",
                service_type="suburban_emu",
                distance_km=round(distance_km, 2),
                fare_amount=token_fare,
                discounted_amount=discounted,
                scheme_applied=None,
                currency="INR",
                currency_symbol="₹",
            )

        # Metro Fare (CMRL)
        if route_type == 1 or "CMRL" in agency_id.upper():
            metro_cfg = self.config.get("agencies", {}).get("CMRL", FALLBACK_CONFIG["agencies"]["CMRL"])
            token_fare = 50.0
            card_discount_pct = 20.0

            for slab in metro_cfg.get("slabs", []):
                if slab["min_km"] <= distance_km < slab["max_km"]:
                    token_fare = float(slab["token_fare"])
                    card_discount_pct = float(slab.get("card_discount_pct", 20.0))
                    break

            discounted = token_fare * (1.0 - card_discount_pct / 100.0)

            return FareBreakdown(
                agency_id="CMRL",
                mode="metro",
                service_type="metro",
                distance_km=round(distance_km, 2),
                fare_amount=token_fare,
                discounted_amount=discounted,
                scheme_applied=None,
                currency="INR",
                currency_symbol="₹",
            )

        # Bus Fare (MTC)
        mtc_cfg = self.config.get("agencies", {}).get("MTC", FALLBACK_CONFIG["agencies"]["MTC"])
        stage_dist = mtc_cfg.get("stage_distance_km", 2.0)
        stages = max(1, math.ceil(distance_km / stage_dist))

        # Determine ordinary fare from stages table
        services = mtc_cfg.get("services", {})
        ord_cfg = services.get("ordinary", {})
        stages_table = ord_cfg.get("stages", [])

        ord_fare = 5.0
        for entry in stages_table:
            if stages <= entry["stage"]:
                ord_fare = float(entry["fare"])
                break
        else:
            if stages_table:
                ord_fare = float(stages_table[-1]["fare"])

        # Service multiplier
        final_fare = ord_fare
        applied_service = service_type.lower()

        if applied_service == "express":
            exp_cfg = services.get("express", {})
            mult = exp_cfg.get("multiplier", 1.5)
            addon = exp_cfg.get("addon", 0.5)
            final_fare = round((ord_fare * mult) + addon)
        elif applied_service == "deluxe":
            del_cfg = services.get("deluxe", {})
            mult = del_cfg.get("multiplier", 2.0)
            addon = del_cfg.get("addon", 1.0)
            final_fare = round((ord_fare * mult) + addon)

        # Concessions (Vidiyal Payanam - free bus travel for women on ordinary)
        scheme_applied = None
        if is_female and applied_service == "ordinary":
            final_fare = 0.0
            scheme_applied = "Vidiyal Payanam (Free Travel for Women)"

        return FareBreakdown(
            agency_id="MTC",
            mode="bus",
            service_type=applied_service,
            distance_km=round(distance_km, 2),
            fare_amount=final_fare,
            discounted_amount=final_fare,
            scheme_applied=scheme_applied,
            currency="INR",
            currency_symbol="₹",
        )

    def calculate_total_fare(self, leg_fares: List[FareBreakdown]) -> TotalFare:
        """Aggregate leg fares into cash total, smartcard total, and women total."""
        cash_sum = 0.0
        smartcard_sum = 0.0
        women_sum = 0.0

        for f in leg_fares:
            cash_sum += f.fare_amount
            smartcard_sum += f.discounted_amount if f.discounted_amount is not None else f.fare_amount

            # Female passenger: free on MTC ordinary buses
            if f.mode == "bus" and f.service_type == "ordinary":
                women_sum += 0.0
            else:
                women_sum += f.discounted_amount if f.discounted_amount is not None else f.fare_amount

        return TotalFare(
            cash_total=round(cash_sum, 2),
            smartcard_total=round(smartcard_sum, 2),
            women_fare_total=round(women_sum, 2),
            currency="INR",
            currency_symbol="₹",
            breakdown=leg_fares,
        )

# Global singleton instance
fare_calculator = FareCalculator()
