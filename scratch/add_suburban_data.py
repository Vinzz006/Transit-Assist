#!/usr/bin/env python3
"""
Add Southern Railway Suburban (Beach - Tambaram) and MRTS (Beach - Velachery)
trips, stop times, and shapes to data/sample/.
"""

import os

SAMPLE_DIR = os.path.abspath("data/sample")

# Stop definitions
STOPS = {
    "ST_FORT": (13.0830, 80.2830),
    "ST_EGMORE": (13.0780, 80.2610),
    "ST_MAMBALAM": (13.0360, 80.2295),
    "ST_GUINDY_SUB": (13.0085, 80.2135),
    "ST_AIRPORT": (12.9780, 80.1640),
    "ST_TAMBARAM": (12.9249, 80.1200),
    "ST_CHEPAUK": (13.0645, 80.2815),
    "ST_MARINA": (13.0630, 80.2830),
    "ST_KASTURBA_NAGAR": (13.0065, 80.2520),
    "ST_VELACHERY": (12.9750, 80.2210),
}

# Routes specification
ROUTES = [
    {
        "route_id": "SR_SOUTH",
        "headsign_0": "Tambaram EMU Local",
        "headsign_1": "Chennai Beach EMU Local",
        "stops_0": ["ST_FORT", "ST_EGMORE", "ST_MAMBALAM", "ST_GUINDY_SUB", "ST_AIRPORT", "ST_TAMBARAM"],
        "offsets_0": [0, 4, 12, 18, 26, 36], # cumulative minutes
    },
    {
        "route_id": "SR_MRTS",
        "headsign_0": "Velachery MRTS Local",
        "headsign_1": "Chennai Beach MRTS Local",
        "stops_0": ["ST_FORT", "ST_CHEPAUK", "ST_MARINA", "ST_KASTURBA_NAGAR", "ST_VELACHERY"],
        "offsets_0": [0, 6, 10, 20, 28], # cumulative minutes
    }
]

def fmt(secs):
    h = secs // 3600
    m = (secs % 3600) // 60
    s = secs % 60
    return f"{h:02d}:{m:02d}:{s:02d}"

def main():
    new_trips = []
    new_stop_times = []
    new_shapes = []

    for r in ROUTES:
        r_id = r["route_id"]
        # Direction 0
        stops_0 = r["stops_0"]
        offsets_0 = r["offsets_0"]
        shape_0 = f"SHP_{r_id}_0"

        # Direction 1 (reversed)
        stops_1 = list(reversed(stops_0))
        total_time = offsets_0[-1]
        offsets_1 = [total_time - o for o in reversed(offsets_0)]
        shape_1 = f"SHP_{r_id}_1"

        # Shapes
        seq = 1
        for s_id in stops_0:
            lat, lon = STOPS[s_id]
            new_shapes.append(f"{shape_0},{lat:.6f},{lon:.6f},{seq}")
            seq += 1

        seq = 1
        for s_id in stops_1:
            lat, lon = STOPS[s_id]
            new_shapes.append(f"{shape_1},{lat:.6f},{lon:.6f},{seq}")
            seq += 1

        # Every 15 minutes from 05:00 to 22:45
        trip_num = 1
        for start_sec in range(5 * 3600, 23 * 3600, 15 * 60):
            # Direction 0
            t_id_0 = f"TRIP_{r_id}_0_{trip_num:04d}"
            new_trips.append(f"{r_id},SVC_ALL,{t_id_0},{r['headsign_0']},0,{shape_0}")
            for st_seq, (st_id, off) in enumerate(zip(stops_0, offsets_0), start=1):
                dep_sec = start_sec + off * 60
                arr_sec = dep_sec
                new_stop_times.append(f"{t_id_0},{fmt(arr_sec)},{fmt(dep_sec)},{st_id},{st_seq}")

            # Direction 1
            t_id_1 = f"TRIP_{r_id}_1_{trip_num:04d}"
            new_trips.append(f"{r_id},SVC_ALL,{t_id_1},{r['headsign_1']},1,{shape_1}")
            for st_seq, (st_id, off) in enumerate(zip(stops_1, offsets_1), start=1):
                dep_sec = start_sec + off * 60
                arr_sec = dep_sec
                new_stop_times.append(f"{t_id_1},{fmt(arr_sec)},{fmt(dep_sec)},{st_id},{st_seq}")

            trip_num += 1

    # Append to files
    trips_path = os.path.join(SAMPLE_DIR, "trips.txt")
    with open(trips_path, "a", encoding="utf-8") as f:
        for line in new_trips:
            f.write(line + "\n")
    print(f"Added {len(new_trips)} suburban trips to {trips_path}")

    st_path = os.path.join(SAMPLE_DIR, "stop_times.txt")
    with open(st_path, "a", encoding="utf-8") as f:
        for line in new_stop_times:
            f.write(line + "\n")
    print(f"Added {len(new_stop_times)} stop times to {st_path}")

    sh_path = os.path.join(SAMPLE_DIR, "shapes.txt")
    with open(sh_path, "a", encoding="utf-8") as f:
        for line in new_shapes:
            f.write(line + "\n")
    print(f"Added {len(new_shapes)} shape points to {sh_path}")

if __name__ == "__main__":
    main()
