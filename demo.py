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

BASE_URL = "http://127.0.0.1:8000"

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
    print("[1/7] Checking Backend Health & Network Status...")
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
    print("[2/7] Testing Bilingual Stop Autocomplete (English & Tamil)...")
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
    print("[3/7] Testing Spatial Geodesic Nearby Stops (Chennai Central)...")
    try:
        nearby = get(f"{BASE_URL}/api/stops/nearby?lat=13.0827&lon=80.2754&radius=1000&limit=3")
        for s in nearby:
            dist = round(s.get('distance_meters', 0))
            print(f"   • {s['stop_name']} ({dist}m away)")
    except Exception as e:
        print(f"  Error querying nearby stops: {e}")
    print()

    # 4. Multi-Leg Transit Planning & Indian Fares
    print("[4/7] Planning Journey: Chennai Central -> Chennai Airport (at 08:30 AM)...")
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
    print("[5/7] Checking Upcoming Scheduled Arrivals at Chennai Central...")
    try:
        arrivals = get(f"{BASE_URL}/api/arrivals?stop_id=ST_CENTRAL&limit=3")
        for arr in arrivals:
            print(f"   • Line {arr.get('route_short_name')} towards {arr.get('headsign')} at {arr.get('departure_time')} (in {arr.get('eta_minutes')} mins)")
    except Exception as e:
        print(f"  Error getting arrivals: {e}")
    print()

    # 6. Real-Time Vehicle Tracking & GTFS-RT
    print("[6/7] Testing Live Vehicle Tracking & GTFS-RT Feed (08:30 AM Peak)...")
    try:
        vehicles = get(f"{BASE_URL}/api/realtime/vehicles?time=08:30:00")
        print(f"  Active vehicles tracked: {len(vehicles)}")
        for v in vehicles[:4]:
            mode_name = "Metro" if v.get("route_type") == 1 else "Suburban" if v.get("route_type") == 2 else "Bus"
            status_desc = f"At {v.get('current_stop_name')}" if v.get("current_status") == "STOPPED_AT" else f"En route to {v.get('next_stop_name')}"
            print(f"   • [{mode_name:8}] Line {v.get('route_short_name'):<6} | {v.get('speed_kmh', 0)} km/h | Bearing {v.get('bearing')}° | {status_desc} | {v.get('occupancy_status')}")

        feed = get(f"{BASE_URL}/api/realtime/gtfs-rt?time=08:30:00")
        print(f"  GTFS-RT Feed Version: {feed.get('header', {}).get('gtfs_realtime_version')}, Entities: {len(feed.get('entity', []))}")
    except Exception as e:
        print(f"  Error querying real-time tracking: {e}")
    print()

    # 7. Predictive Delay & Monsoon Intelligence
    print("[7/9] Testing Predictive AI Delay & Monsoon Corridor Intelligence...")
    try:
        # Check Metro resilience during monsoon
        metro_pred = get(f"{BASE_URL}/api/predict/delay?route_id=CMRL_BLUE&weather=monsoon")
        print(f"  Metro Line {metro_pred.get('route_short_name')} during Monsoon:")
        print(f"   • Predicted Delay: +{metro_pred.get('predicted_delay_minutes')} mins | Risk: {metro_pred.get('risk_level')} | Confidence: {int(metro_pred.get('confidence_score', 0)*100)}%")
        print(f"   • Advisory (EN):   {metro_pred.get('advisory_en')}")

        # Check Bus flood risk on Velachery waterlogging corridor
        bus_pred = get(f"{BASE_URL}/api/predict/delay?route_id=MTC_11G&weather=monsoon")
        print(f"  MTC Bus Line {bus_pred.get('route_short_name')} on {bus_pred.get('corridor_name')} Corridor during Monsoon:")
        print(f"   • Predicted Delay: +{bus_pred.get('predicted_delay_minutes')} mins | Risk: {bus_pred.get('risk_level')} | Waterlogging Prone: {bus_pred.get('is_waterlogging_prone')}")
        print(f"   • Advisory (EN):   {bus_pred.get('advisory_en')}")
        print(f"   • Advisory (TA):   {bus_pred.get('advisory_ta')}")

        # Summary of active corridors
        corridors_resp = get(f"{BASE_URL}/api/predict/corridors?weather=monsoon")
        print(f"  Active Monitored Corridors ({corridors_resp.get('active_corridors_count')} monitored):")
        for c in corridors_resp.get("corridors", [])[:3]:
            print(f"   • {c.get('corridor_name')}: Peak delay +{c.get('monsoon_delay_min')}m | Flood Risk: {c.get('waterlogging_risk')}")
    except Exception as e:
        print(f"  Error querying predictive delay intelligence: {e}")
    print()

    # 8. Step-Free Accessibility & Station Facilities
    print("[8/9] Testing Step-Free Station Accessibility & Wheelchair Transit Routing...")
    try:
        stations = get(f"{BASE_URL}/api/accessibility/stations")
        print(f"  Monitored Accessible Hubs: {len(stations)} stations cataloged")
        for st in stations[:3]:
            print(f"   • {st.get('station_name')} ({st.get('mode')}): {st.get('accessibility_level')} Step-Free | Elevators: {st.get('elevator_count')} | Tactile Paths: {st.get('has_tactile_paths')}")

        # Wheelchair accessible plan query
        acc_plan = post(f"{BASE_URL}/api/plan", {
            "origin_lat": 13.0827,
            "origin_lon": 80.2754,
            "destination_lat": 12.9780,
            "destination_lon": 80.1640,
            "departure_time": "08:30:00",
            "wheelchair_accessible": True,
        })
        first_acc = acc_plan.get("itineraries", [])[0] if acc_plan.get("itineraries") else {}
        print(f"  Wheelchair Accessible Trip: {first_acc.get('duration_minutes')} mins | Step-free: {first_acc.get('is_wheelchair_accessible')} ({first_acc.get('accessibility_notes')})")
    except Exception as e:
        print(f"  Error querying station accessibility: {e}")
    print()

    # 9. Admin Transit Operations Center & Live Disruption Broadcasting
    print("[9/9] Testing Admin Transit Operations Center & Live Network Telemetry...")
    try:
        metrics = get(f"{BASE_URL}/api/admin/metrics")
        print(f"  Network Operational Status:  {metrics.get('network_status')} ({metrics.get('city')})")
        print(f"  Live Active Fleet:           {metrics.get('active_vehicles_total')} vehicles (Metro: {metrics.get('metro_active')}, Suburban: {metrics.get('suburban_active')}, Bus: {metrics.get('bus_active')})")
        print(f"  Network On-Time Performance: {metrics.get('overall_otp_pct')}% (Metro: {metrics.get('metro_otp_pct')}%, Suburban: {metrics.get('suburban_otp_pct')}%, Bus: {metrics.get('bus_otp_pct')}%)")
        print(f"  Monsoon Flood Risk Level:    {metrics.get('monsoon_flood_risk')}")

        # Broadcast test incident
        inc_broadcast = post(f"{BASE_URL}/api/admin/incidents", {
            "title": "Signal maintenance at Guindy",
            "description": "Suburban trains operating with 5-10 min delay; CMRL Metro running normally",
            "mode": "SUBURBAN_RAIL",
            "severity": "MEDIUM",
            "affected_corridor": "GST Road Corridor"
        })
        print(f"  Broadcasted Disruption:      [{inc_broadcast.get('severity')}] {inc_broadcast.get('title')} (ID: {inc_broadcast.get('id')})")

        incidents = get(f"{BASE_URL}/api/admin/incidents?active_only=true")
        print(f"  Active Broadcast Alerts:     {len(incidents)} disruption(s) live on commuter network")
    except Exception as e:
        print(f"  Error querying admin operations: {e}")
    print()

    # 10. Singara Chennai NCMC Transit Wallet & QR Boarding Pass
    print("[10/10] Testing Singara Chennai NCMC Digital Transit Wallet & QR Pass Ticketing...")
    try:
        card = get(f"{BASE_URL}/api/wallet/card")
        print(f"  Virtual Transit Smartcard:   {card.get('card_type')} [{card.get('masked_number')}]")
        print(f"  Initial Stored Balance:      ₹{card.get('balance'):.2f}")

        # Top-up ₹100 via UPI
        topup_res = post(f"{BASE_URL}/api/wallet/topup", {
            "amount": 100.0,
            "payment_method": "UPI_GPAY",
            "upi_id": "commuter@oksbi"
        })
        print(f"  Recharged via UPI (+₹100):   New Balance ₹{topup_res.get('balance'):.2f}")

        # Issue digital QR ticket for Central -> Airport
        ticket = post(f"{BASE_URL}/api/wallet/ticket", {
            "origin_name": "Chennai Central",
            "destination_name": "Chennai Airport",
            "route_short_name": "Blue Line",
            "mode": "METRO",
            "fare_amount": 32.0,
            "is_female_concession": False
        })
        print(f"  Generated Digital QR Pass:   Ticket ID {ticket.get('ticket_id')} [Valid for {ticket.get('validity_minutes')} mins]")
        print(f"  QR AFC Token:                {ticket.get('qr_data_token')[:38]}...")
        print(f"  Fare Deducted (20% discount): ₹{ticket.get('fare_amount')}")

        txns = get(f"{BASE_URL}/api/wallet/transactions?limit=3")
        print(f"  Recent Wallet Ledger Items:  {len(txns)} transaction(s) recorded")
        for tx in txns:
            sign = "+" if tx.get('type') == 'TOPUP' else "-"
            print(f"   • [{tx.get('timestamp')}] {tx.get('description')} ({sign}₹{tx.get('amount')}) -> Bal: ₹{tx.get('balance_after')}")
    except Exception as e:
        print(f"  Error querying digital wallet: {e}")
    print()

    print("=" * 68)
    print("  Demo Complete!")
    print("  Web App URL:       http://localhost:5173  (or http://localhost:3000 in Docker)")
    print("  FastAPI Docs:      http://localhost:8000/docs")
    print("=" * 68)

if __name__ == "__main__":
    main()
