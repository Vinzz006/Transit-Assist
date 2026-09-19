#!/usr/bin/env python3
"""
Transit Assist India — Demonstration Script
Showcases the core capabilities of the Chennai Transit Assistant:
1. Health & network metrics
2. Bilingual stop search (English + Tamil)
3. Spatial nearby stops search
4. Multi-modal journey planning with Indian fare calculations (MTC Bus + CMRL Metro)
5. Live scheduled arrivals
"""

import sys
import json
import urllib.request
import urllib.parse

# Ensure UTF-8 output on Windows terminals
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_URL = "http://localhost:8000"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "TransitAssistDemo/1.0"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def post(url, data):
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "TransitAssistDemo/1.0"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def main():
    print("=" * 68)
    print("      TRANSIT ASSIST INDIA — CHENNAI BUS & METRO ASSISTANT")
    print("=" * 68)
    print("Modes: MTC City Buses + CMRL Metro")
    print("Engine: In-Memory Multi-Criteria RAPTOR (0 external API costs)")
    print("Fares:  Stage-based Bus, Distance-slab Metro, Vidiyal Payanam Free")
    print()

    # 1. Health check
    print("[1/5] Checking Backend Health & Network Status...")
    try:
        health = get(f"{BASE_URL}/api/health")
        print(f"  Status:         {health.get('status', 'unknown')}")
        print(f"  City:           {health.get('city')}")
        print(f"  Modes:          {', '.join(health.get('modes', []))}")
        print(f"  Total Stops:    {health.get('total_stops')}")
        print(f"  Total Routes:   {health.get('total_routes')}")
    except Exception as e:
        print(f"  ERROR: Could not connect to {BASE_URL}: {e}")
        print("  Make sure the backend is running on port 8000.")
        sys.exit(1)
    print()

    # 2. Bilingual Search
    print("[2/5] Testing Bilingual Stop Autocomplete (English & Tamil)...")
    try:
        stops_en = get(f"{BASE_URL}/api/stops?query=Central&limit=2")
        print("  Query 'Central' (English):")
        for s in stops_en:
            print(f"   • {s['stop_name']} / {s.get('stop_name_ta', '')} [ID: {s['stop_id']}]")

        q_ta = urllib.parse.quote("விமான")
        stops_ta = get(f"{BASE_URL}/api/stops?query={q_ta}&limit=2")
        print("  Query 'விமான' (Airport in Tamil):")
        for s in stops_ta:
            print(f"   • {s['stop_name']} / {s.get('stop_name_ta', '')} [ID: {s['stop_id']}]")
    except Exception as e:
        print(f"  Error querying stops: {e}")
    print()

    # 3. Spatial Nearby Stops
    print("[3/5] Testing Spatial Geodesic Nearby Stops (Chennai Central)...")
    try:
        nearby = get(f"{BASE_URL}/api/stops/nearby?lat=13.0827&lon=80.2754&radius=1000&limit=3")
        for s in nearby:
            dist = round(s.get('distance_meters', 0))
            print(f"   • {s['stop_name']} ({dist}m away)")
    except Exception as e:
        print(f"  Error querying nearby stops: {e}")
    print()

    # 4. Multi-Leg Transit Planning & Indian Fares
    print("[4/5] Planning Journey: Chennai Central -> Chennai Airport (at 08:30 AM)...")
    plan_data = {
        "origin_lat": 13.0827,
        "origin_lon": 80.2754,
        "destination_lat": 12.9856,
        "destination_lon": 80.1636,
        "departure_time": "08:30:00",
        "is_female": False
    }
    try:
        plan = post(f"{BASE_URL}/api/plan", plan_data)
        itineraries = plan.get("itineraries", [])
        if itineraries:
            itin = itineraries[0]
            fare = itin.get("fare", {})
            print("  Best Multimodal Itinerary Found:")
            print(f"   Duration:       {itin.get('duration_minutes')} mins ({itin.get('departure_time')} -> {itin.get('arrival_time')})")
            print(f"   Transfers:      {itin.get('transfers_count')}")
            print(f"   Transit Time:   {itin.get('transit_time_minutes')} mins")
            print(f"   Walking Time:   {itin.get('walking_time_minutes')} mins")
            print(f"   Cash Token Fare: ₹{fare.get('cash_total')}")
            print(f"   Smartcard/QR:   ₹{fare.get('smartcard_total')} (20% digital discount)")
            print(f"   Vidiyal Payanam: ₹{fare.get('women_fare_total')} (Free on MTC ordinary buses)")
            print("  Step-by-step Navigation Legs:")
            for leg in itin.get("legs", []):
                mode = leg.get("mode")
                if mode == "WALK":
                    print(f"    [WALK]    {leg.get('from_stop_name')} -> {leg.get('to_stop_name')} ({leg.get('duration_minutes')} min, {round(leg.get('distance_meters', 0))}m)")
                else:
                    print(f"    [{mode:5}]   Line {leg.get('route_short_name')} ({leg.get('route_long_name')})")
                    print(f"              Board:  {leg.get('from_stop_name')} at {leg.get('departure_time')}")
                    print(f"              Alight: {leg.get('to_stop_name')} at {leg.get('arrival_time')} ({leg.get('intermediate_stops_count')} intermediate stops)")
                    if leg.get("fare"):
                        leg_fare = leg["fare"]
                        print(f"              Fare:   ₹{leg_fare.get('fare_amount')} ({leg_fare.get('mode')} - {leg_fare.get('service_type')})")
        else:
            print("  No itineraries found.")
    except Exception as e:
        print(f"  Error planning trip: {e}")
    print()

    # 5. Scheduled Arrivals
    print("[5/5] Checking Upcoming Scheduled Arrivals at Chennai Central...")
    try:
        arrivals = get(f"{BASE_URL}/api/arrivals?stop_id=ST_CENTRAL&limit=3")
        for arr in arrivals:
            print(f"   • Line {arr.get('route_short_name')} towards {arr.get('headsign')} at {arr.get('departure_time')} (in {arr.get('eta_minutes')} mins)")
    except Exception as e:
        print(f"  Error getting arrivals: {e}")
    print()

    print("=" * 68)
    print("  Demo Complete!")
    print("  Web App URL:       http://localhost:5174  (or http://localhost:3000 in Docker)")
    print("  FastAPI Docs:      http://localhost:8000/docs")
    print("=" * 68)

if __name__ == "__main__":
    main()
