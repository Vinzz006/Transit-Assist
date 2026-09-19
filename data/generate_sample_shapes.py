#!/usr/bin/env python3
"""
Generate smooth shapes.txt for sample transit corridors in Chennai.
"""

import csv
import os

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "sample")

def generate_shapes():
    stops = {}
    with open(os.path.join(SAMPLE_DIR, "stops.txt"), encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            stops[r["stop_id"]] = (float(r["stop_lat"]), float(r["stop_lon"]))

    # Read unique routes and trips to determine stop order
    route_trips = {}
    with open(os.path.join(SAMPLE_DIR, "trips.txt"), encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            key = (r["route_id"], r["direction_id"])
            if key not in route_trips:
                route_trips[key] = r["trip_id"]

    trip_stops = {}
    with open(os.path.join(SAMPLE_DIR, "stop_times.txt"), encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            trip_id = r["trip_id"]
            if trip_id not in trip_stops:
                trip_stops[trip_id] = []
            trip_stops[trip_id].append((int(r["stop_sequence"]), r["stop_id"]))

    shapes_rows = []
    trips_to_shape = {}

    for (route_id, direction_id), trip_id in route_trips.items():
        shape_id = f"SHP_{route_id}_{direction_id}"
        trips_to_shape[(route_id, direction_id)] = shape_id
        ordered_stops = sorted(trip_stops[trip_id], key=lambda x: x[0])

        seq = 1
        for idx in range(len(ordered_stops)):
            stop_id = ordered_stops[idx][1]
            lat, lon = stops[stop_id]

            if idx > 0:
                prev_stop_id = ordered_stops[idx - 1][1]
                p_lat, p_lon = stops[prev_stop_id]
                # Interpolate 2 midpoint steps for smooth curve
                for frac in (0.33, 0.66):
                    mid_lat = p_lat + frac * (lat - p_lat)
                    mid_lon = p_lon + frac * (lon - p_lon)
                    shapes_rows.append({
                        "shape_id": shape_id,
                        "shape_pt_lat": f"{mid_lat:.6f}",
                        "shape_pt_lon": f"{mid_lon:.6f}",
                        "shape_pt_sequence": seq,
                    })
                    seq += 1

            shapes_rows.append({
                "shape_id": shape_id,
                "shape_pt_lat": f"{lat:.6f}",
                "shape_pt_lon": f"{lon:.6f}",
                "shape_pt_sequence": seq,
            })
            seq += 1

    shapes_path = os.path.join(SAMPLE_DIR, "shapes.txt")
    with open(shapes_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence"])
        writer.writeheader()
        writer.writerows(shapes_rows)

    # Now update trips.txt to include shape_id
    updated_trips = []
    with open(os.path.join(SAMPLE_DIR, "trips.txt"), encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            key = (r["route_id"], r["direction_id"])
            r["shape_id"] = trips_to_shape.get(key, "")
            updated_trips.append(r)

    with open(os.path.join(SAMPLE_DIR, "trips.txt"), "w", newline="", encoding="utf-8") as f:
        fieldnames = ["route_id", "service_id", "trip_id", "trip_headsign", "direction_id", "shape_id"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated_trips)

    print(f"Generated {len(shapes_rows)} shape points and updated trips.txt with shape_ids.")

if __name__ == "__main__":
    generate_shapes()
