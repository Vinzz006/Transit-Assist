#!/usr/bin/env python3
"""
Generate comprehensive, realistic GTFS trips.txt and stop_times.txt
for the curated sample Chennai transit network.
"""

import csv
import os

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "sample")

ROUTES_CONFIG = [
    {
        "route_id": "CMRL_BLUE",
        "headsign_0": "Chennai International Airport",
        "headsign_1": "Puratchi Thalaivar Dr. MGR Central",
        "stops": [
            ("ST_CENTRAL", 0),
            ("ST_GOVT_ESTATE", 3),
            ("ST_LIC", 5),
            ("ST_1000_LIGHTS", 8),
            ("ST_AG_DMS", 11),
            ("ST_TEYNAMPET", 13),
            ("ST_NANDANAM", 15),
            ("ST_SAIDAPET", 18),
            ("ST_GUINDY", 22),
            ("ST_AIRPORT", 30),
        ],
        "start_time_min": 6 * 60,       # 06:00
        "end_time_min": 22 * 60 + 30,    # 22:30
        "interval_min": 10,
    },
    {
        "route_id": "CMRL_GREEN",
        "headsign_0": "Koyambedu CMBT",
        "headsign_1": "Puratchi Thalaivar Dr. MGR Central",
        "stops": [
            ("ST_CENTRAL", 0),
            ("ST_EGMORE", 3),
            ("ST_NEHRU_PARK", 6),
            ("ST_KILPAUK", 9),
            ("ST_SHENOY_NAGAR", 12),
            ("ST_ANNA_NAGAR_E", 15),
            ("ST_TIRUMANGALAM", 18),
            ("ST_CMBT", 22),
        ],
        "start_time_min": 6 * 60,
        "end_time_min": 22 * 60 + 30,
        "interval_min": 10,
    },
    {
        "route_id": "MTC_29C",
        "headsign_0": "Besant Nagar",
        "headsign_1": "Perambur B.S",
        "stops": [
            ("ST_PERAMBUR", 0),
            ("ST_CENTRAL", 15),
            ("ST_LIC", 25),
            ("ST_AG_DMS", 35),
            ("ST_ADYAR", 50),
            ("ST_BESANT_NAGAR", 60),
        ],
        "start_time_min": 6 * 60 + 15,
        "end_time_min": 22 * 60,
        "interval_min": 15,
    },
    {
        "route_id": "MTC_18A",
        "headsign_0": "Chennai Airport / Chromepet",
        "headsign_1": "High Court",
        "stops": [
            ("ST_HIGH_COURT", 0),
            ("ST_CENTRAL", 10),
            ("ST_LIC", 20),
            ("ST_1000_LIGHTS", 28),
            ("ST_TNAGAR", 40),
            ("ST_SAIDAPET", 50),
            ("ST_GUINDY", 60),
            ("ST_AIRPORT", 75),
        ],
        "start_time_min": 6 * 60 + 5,
        "end_time_min": 22 * 60 + 15,
        "interval_min": 15,
    },
    {
        "route_id": "MTC_47A",
        "headsign_0": "Adyar Depot via CMBT",
        "headsign_1": "Koyambedu CMBT",
        "stops": [
            ("ST_CMBT", 0),
            ("ST_VADAPALANI", 12),
            ("ST_TNAGAR", 28),
            ("ST_NANDANAM", 38),
            ("ST_ADYAR", 55),
        ],
        "start_time_min": 6 * 60 + 20,
        "end_time_min": 21 * 60 + 40,
        "interval_min": 20,
    },
    {
        "route_id": "MTC_23C",
        "headsign_0": "Besant Nagar via Marina Beach",
        "headsign_1": "Chennai Central",
        "stops": [
            ("ST_CENTRAL", 0),
            ("ST_GOVT_ESTATE", 8),
            ("ST_MARINA", 18),
            ("ST_ADYAR", 35),
            ("ST_BESANT_NAGAR", 45),
        ],
        "start_time_min": 6 * 60 + 10,
        "end_time_min": 22 * 60 + 10,
        "interval_min": 20,
    },
]

def format_time(minutes_from_midnight: int) -> str:
    h = (minutes_from_midnight // 60) % 24
    m = minutes_from_midnight % 60
    return f"{h:02d}:{m:02d}:00"

def generate():
    trips_rows = []
    stoptimes_rows = []

    trip_counter = 1

    for rcfg in ROUTES_CONFIG:
        route_id = rcfg["route_id"]
        stops_fwd = rcfg["stops"]
        stops_rev = []
        total_time_fwd = stops_fwd[-1][1]
        for s_id, t_offset in reversed(stops_fwd):
            stops_rev.append((s_id, total_time_fwd - t_offset))

        for direction, stops_list, headsign in [
            (0, stops_fwd, rcfg["headsign_0"]),
            (1, stops_rev, rcfg["headsign_1"]),
        ]:
            curr_time = rcfg["start_time_min"]
            while curr_time <= rcfg["end_time_min"]:
                trip_id = f"TRIP_{route_id}_{direction}_{trip_counter:04d}"
                trips_rows.append({
                    "route_id": route_id,
                    "service_id": "SVC_ALL",
                    "trip_id": trip_id,
                    "trip_headsign": headsign,
                    "direction_id": direction,
                })

                for seq, (stop_id, offset_min) in enumerate(stops_list, start=1):
                    stop_time_min = curr_time + offset_min
                    t_str = format_time(stop_time_min)
                    stoptimes_rows.append({
                        "trip_id": trip_id,
                        "arrival_time": t_str,
                        "departure_time": t_str,
                        "stop_id": stop_id,
                        "stop_sequence": seq,
                    })

                trip_counter += 1
                curr_time += rcfg["interval_min"]

    # Write trips.txt
    trips_path = os.path.join(SAMPLE_DIR, "trips.txt")
    with open(trips_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["route_id", "service_id", "trip_id", "trip_headsign", "direction_id"])
        writer.writeheader()
        writer.writerows(trips_rows)

    # Write stop_times.txt
    stoptimes_path = os.path.join(SAMPLE_DIR, "stop_times.txt")
    with open(stoptimes_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"])
        writer.writeheader()
        writer.writerows(stoptimes_rows)

    print(f"Generated {len(trips_rows)} trips and {len(stoptimes_rows)} stop times in {SAMPLE_DIR}")

if __name__ == "__main__":
    generate()
