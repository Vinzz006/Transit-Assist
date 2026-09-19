#!/usr/bin/env python3
"""
Dual-Mode Transit Data Ingestion Pipeline.

Usage:
  python data/pipeline.py --feed sample   # Fast, offline-ready curated Chennai corridors
  python data/pipeline.py --feed full     # Ingest full MTC + CMRL dataset (~5,600 stops)
"""

import argparse
import csv
import io
import os
import re
import sys
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
import urllib.request
import zipfile
from typing import Dict, List, Optional, Tuple

# Ensure project root is in sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.app.db.database import Base, engine, SessionLocal
from backend.app.db.models import Agency, Stop, Route, Trip, StopTime, ShapePoint
from data.clean_gtfs import GTFSCleaner, parse_time_to_seconds

SAMPLE_DIR = os.path.join(BASE_DIR, "data", "sample")
CLEANED_DIR = os.path.join(BASE_DIR, "data", "cleaned")
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")

FULL_UNIFIED_URL = "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/chennai-unified-gtfs.zip"
CMRL_ZIP_URL = "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl-gtfs.zip"

def extract_bilingual_names(full_name: str) -> Tuple[str, str]:
    """
    Split name like 'Chennai Central (சென்னை சென்ட்ரல்)'
    into ('Chennai Central', 'சென்னை சென்ட்ரல்').
    """
    if not full_name:
        return "", ""
    # Look for parentheses containing Tamil characters (\u0B80-\u0BFF)
    match = re.search(r"^(.*?)\s*\(([\u0B80-\u0BFF\s\.\,\-]+)\)\s*$", full_name)
    if match:
        return match.group(1).strip(), match.group(2).strip()

    # Check if string contains Tamil script
    has_tamil = bool(re.search(r"[\u0B80-\u0BFF]", full_name))
    if has_tamil:
        # Check for Latin
        has_latin = bool(re.search(r"[A-Za-z]", full_name))
        if not has_latin:
            return "", full_name.strip()

    return full_name.strip(), ""

def download_full_feeds(target_dir: str) -> str:
    """Download full Chennai GTFS feeds if not already present."""
    os.makedirs(target_dir, exist_ok=True)
    unified_zip = os.path.join(target_dir, "chennai-unified-gtfs.zip")
    if not os.path.exists(unified_zip):
        print(f"Downloading unified Chennai GTFS from {FULL_UNIFIED_URL}...")
        req = urllib.request.Request(FULL_UNIFIED_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp, open(unified_zip, "wb") as out_f:
            out_f.write(resp.read())
        print(f"Downloaded {os.path.getsize(unified_zip)} bytes to {unified_zip}")
    return unified_zip

def ingest_gtfs_directory(source_dir: str):
    """Read cleaned GTFS csv files and bulk-insert into the database."""
    print(f"Initializing database tables at {engine.url}...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()

    try:
        # 1. Ingest Agency
        agencies_file = os.path.join(source_dir, "agency.txt")
        agency_objs = []
        if os.path.exists(agencies_file):
            with open(agencies_file, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    agency_objs.append(Agency(
                        agency_id=row["agency_id"].strip(),
                        agency_name=row.get("agency_name", "").strip(),
                        agency_url=row.get("agency_url", "").strip(),
                        agency_timezone=row.get("agency_timezone", "Asia/Kolkata").strip(),
                        agency_lang=row.get("agency_lang", "en").strip(),
                    ))
            session.bulk_save_objects(agency_objs)
            session.commit()
            print(f"Loaded {len(agency_objs)} agencies.")

        # 2. Ingest Stops
        stops_file = os.path.join(source_dir, "stops.txt")
        stop_objs = []
        if os.path.exists(stops_file):
            with open(stops_file, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    s_name = row.get("stop_name", "").strip()
                    en_name, ta_name = extract_bilingual_names(s_name)
                    stop_objs.append(Stop(
                        stop_id=row["stop_id"].strip(),
                        stop_code=row.get("stop_code", "").strip(),
                        stop_name=s_name,
                        stop_name_en=en_name or s_name,
                        stop_name_ta=ta_name or "",
                        stop_desc=row.get("stop_desc", "").strip(),
                        stop_lat=float(row["stop_lat"]),
                        stop_lon=float(row["stop_lon"]),
                        zone_id=row.get("zone_id", "").strip(),
                        location_type=int(row.get("location_type", 0) or 0),
                    ))
            session.bulk_save_objects(stop_objs)
            session.commit()
            print(f"Loaded {len(stop_objs)} stops.")

        # 3. Ingest Routes
        routes_file = os.path.join(source_dir, "routes.txt")
        route_objs = []
        if os.path.exists(routes_file):
            with open(routes_file, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    route_objs.append(Route(
                        route_id=row["route_id"].strip(),
                        agency_id=row["agency_id"].strip(),
                        route_short_name=row.get("route_short_name", "").strip(),
                        route_long_name=row.get("route_long_name", "").strip(),
                        route_type=int(row.get("route_type", 3) or 3),
                        route_color=row.get("route_color", "0066CC").strip(),
                        route_text_color=row.get("route_text_color", "FFFFFF").strip(),
                    ))
            session.bulk_save_objects(route_objs)
            session.commit()
            print(f"Loaded {len(route_objs)} routes.")

        # 4. Ingest Trips
        trips_file = os.path.join(source_dir, "trips.txt")
        trip_objs = []
        if os.path.exists(trips_file):
            with open(trips_file, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    trip_objs.append(Trip(
                        trip_id=row["trip_id"].strip(),
                        route_id=row["route_id"].strip(),
                        service_id=row.get("service_id", "SVC_ALL").strip(),
                        trip_headsign=row.get("trip_headsign", "").strip(),
                        direction_id=int(row.get("direction_id", 0) or 0),
                        shape_id=row.get("shape_id", "").strip() or None,
                    ))
            session.bulk_save_objects(trip_objs)
            session.commit()
            print(f"Loaded {len(trip_objs)} trips.")

        # 5. Ingest StopTimes in chunks
        stoptimes_file = os.path.join(source_dir, "stop_times.txt")
        if os.path.exists(stoptimes_file):
            chunk_size = 5000
            chunk = []
            total_stoptimes = 0
            with open(stoptimes_file, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    arr_sec = parse_time_to_seconds(row["arrival_time"]) or 0
                    dep_sec = parse_time_to_seconds(row["departure_time"]) or 0
                    chunk.append(StopTime(
                        trip_id=row["trip_id"].strip(),
                        stop_id=row["stop_id"].strip(),
                        arrival_time=row["arrival_time"].strip(),
                        departure_time=row["departure_time"].strip(),
                        arrival_seconds=arr_sec,
                        departure_seconds=dep_sec,
                        stop_sequence=int(row["stop_sequence"]),
                    ))
                    if len(chunk) >= chunk_size:
                        session.bulk_save_objects(chunk)
                        session.commit()
                        total_stoptimes += len(chunk)
                        chunk = []
                if chunk:
                    session.bulk_save_objects(chunk)
                    session.commit()
                    total_stoptimes += len(chunk)
            print(f"Loaded {total_stoptimes} stop times.")

        # 6. Ingest Shapes if present
        shapes_file = os.path.join(source_dir, "shapes.txt")
        if os.path.exists(shapes_file):
            shape_objs = []
            with open(shapes_file, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    shape_objs.append(ShapePoint(
                        shape_id=row["shape_id"].strip(),
                        shape_pt_lat=float(row["shape_pt_lat"]),
                        shape_pt_lon=float(row["shape_pt_lon"]),
                        shape_pt_sequence=int(row["shape_pt_sequence"]),
                    ))
            session.bulk_save_objects(shape_objs)
            session.commit()
            print(f"Loaded {len(shape_objs)} shape points.")

    finally:
        session.close()

def main():
    parser = argparse.ArgumentParser(description="Transit Assist India Data Ingestion Pipeline")
    parser.add_argument(
        "--feed",
        choices=["sample", "full"],
        default="sample",
        help="Feed to ingest: 'sample' (fast, curated) or 'full' (full MTC + CMRL dataset)",
    )
    args = parser.parse_args()

    cleaner = GTFSCleaner()

    if args.feed == "sample":
        out_clean = os.path.join(CLEANED_DIR, "sample")
        print(f"Cleaning sample feed from {SAMPLE_DIR} into {out_clean}...")
        report = cleaner.clean_feed(SAMPLE_DIR, out_clean)
        print(f"Sample cleaning done. Ingesting into database...")
        ingest_gtfs_directory(out_clean)
    else:
        raw_zip = download_full_feeds(RAW_DIR)
        out_clean = os.path.join(CLEANED_DIR, "full")
        print(f"Cleaning full feed from {raw_zip} into {out_clean}...")
        report = cleaner.clean_feed(raw_zip, out_clean)
        print(f"Full feed cleaning done. Ingesting into database...")
        ingest_gtfs_directory(out_clean)

    print("\n[OK] Data pipeline execution finished successfully.")

if __name__ == "__main__":
    main()
