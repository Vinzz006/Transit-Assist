import os
import tempfile
import csv
import pytest
from data.clean_gtfs import GTFSCleaner, parse_time_to_seconds, format_seconds_to_time

def test_time_parsing():
    assert parse_time_to_seconds("08:30:00") == 8 * 3600 + 30 * 60
    assert parse_time_to_seconds("25:15:00") == 25 * 3600 + 15 * 60
    assert parse_time_to_seconds("invalid") is None
    assert format_seconds_to_time(3665) == "01:01:05"

def test_cleaner_detects_and_fixes_anomalies():
    with tempfile.TemporaryDirectory() as tmp_in, tempfile.TemporaryDirectory() as tmp_out:
        # Create dirty agency
        with open(os.path.join(tmp_in, "agency.txt"), "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["agency_id", "agency_name", "agency_url", "agency_timezone"])
            writer.writeheader()
            writer.writerow({"agency_id": "MTC", "agency_name": "MTC Chennai", "agency_url": "https://mtcbus.tn.gov.in", "agency_timezone": "Asia/Kolkata"})

        # Create stops with duplicate ID and out-of-bounds coordinates
        with open(os.path.join(tmp_in, "stops.txt"), "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["stop_id", "stop_name", "stop_lat", "stop_lon"])
            writer.writeheader()
            writer.writerow({"stop_id": "S1", "stop_name": "Central", "stop_lat": "13.0827", "stop_lon": "80.2754"})
            writer.writerow({"stop_id": "S1", "stop_name": "Central Duplicate", "stop_lat": "13.0827", "stop_lon": "80.2754"}) # duplicate
            writer.writerow({"stop_id": "S2", "stop_name": "Airport", "stop_lat": "12.9780", "stop_lon": "80.1640"})
            writer.writerow({"stop_id": "S_OUT", "stop_name": "Antarctica Stop", "stop_lat": "-80.000", "stop_lon": "0.000"}) # out of bounds

        # Create routes
        with open(os.path.join(tmp_in, "routes.txt"), "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["route_id", "agency_id", "route_short_name", "route_long_name", "route_type"])
            writer.writeheader()
            writer.writerow({"route_id": "R1", "agency_id": "MTC", "route_short_name": "18A", "route_long_name": "High Court - Airport", "route_type": "3"})

        # Create trips (including an orphan trip pointing to non-existent route)
        with open(os.path.join(tmp_in, "trips.txt"), "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["route_id", "service_id", "trip_id"])
            writer.writeheader()
            writer.writerow({"route_id": "R1", "service_id": "SVC1", "trip_id": "T1"})
            writer.writerow({"route_id": "NON_EXISTENT_ROUTE", "service_id": "SVC1", "trip_id": "T_ORPHAN"})

        # Create stop times with non-chronological order and orphan stop reference
        with open(os.path.join(tmp_in, "stop_times.txt"), "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"])
            writer.writeheader()
            writer.writerow({"trip_id": "T1", "arrival_time": "08:15:00", "departure_time": "08:15:00", "stop_id": "S1", "stop_sequence": "1"})
            # S2 has arrival earlier than S1 departure - violation!
            writer.writerow({"trip_id": "T1", "arrival_time": "08:10:00", "departure_time": "08:12:00", "stop_id": "S2", "stop_sequence": "2"})
            # Orphan stop
            writer.writerow({"trip_id": "T1", "arrival_time": "08:30:00", "departure_time": "08:30:00", "stop_id": "GHOST_STOP", "stop_sequence": "3"})

        cleaner = GTFSCleaner()
        report = cleaner.clean_feed(tmp_in, tmp_out)

        assert report.total_agencies == 1
        assert report.duplicate_stops_removed == 1
        assert report.orphan_trips_removed >= 1
        assert report.out_of_bounds_stops_flagged >= 1
        assert report.time_order_violations_fixed >= 1
        assert report.orphan_stop_times_removed >= 1

        # Check cleaned output
        with open(os.path.join(tmp_out, "stops.txt"), encoding="utf-8") as f:
            cleaned_stops = list(csv.DictReader(f))
            assert len(cleaned_stops) == 3 # S1, S2, S_OUT (retained with bounds warning)
            ids = [s["stop_id"] for s in cleaned_stops]
            assert ids.count("S1") == 1 # Deduplicated!

        with open(os.path.join(tmp_out, "stop_times.txt"), encoding="utf-8") as f:
            cleaned_st = list(csv.DictReader(f))
            assert len(cleaned_st) == 2 # S1 and S2 (GHOST_STOP removed)
            # Verify chronological fix
            assert cleaned_st[1]["arrival_time"] >= cleaned_st[0]["departure_time"]
