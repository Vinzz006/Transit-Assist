# Transit Assist India — Data Pipeline & GTFS Guide

This directory contains the transit dataset ingestion, cleaning, validation, and fare configuration for **Transit Assist India**.

---

## 1. Data Sources & Licensing

| Dataset | Provider / Source | Format | License | Notes |
|---|---|---|---|---|
| **Chennai Unified Transit (MTC + CMRL)** | UngalSoththu / ChennaiGTFS | GTFS (zip / csv) | ODbL / PDDL | Covers 5,625 stops, 728 bus routes, 44 metro stations (Blue & Green lines). |
| **Curated Sample Seed** | Transit Assist Project (`data/sample/`) | GTFS (csv) | CC0 Public Domain | High-density real Chennai corridors (Central, Airport, Koyambedu CMBT, Adyar, T. Nagar). |
| **OpenStreetMap Extract** | BBBike.org / Geofabrik | OSM PBF / XML | ODbL | Regional street grid for pedestrian transfer walking calculations. |

---

## 2. Directory Structure

```
data/
├── raw/                         # Downloaded raw external feeds
├── sample/                      # Curated sample GTFS seed (zero-network dev & CI)
│   ├── agency.txt               # MTC and CMRL agency details
│   ├── routes.txt               # Metro Blue/Green lines + MTC key bus routes
│   ├── stops.txt                # Bilingual stops (English + Tamil)
│   ├── trips.txt                # Daily scheduled trips
│   ├── stop_times.txt           # Chronological station arrivals/departures
│   ├── calendar.txt             # Service schedules
│   └── shapes.txt               # Route polylines
├── cleaned/                     # Normalized, validated feeds
│   ├── sample/
│   └── full/
├── clean_gtfs.py                # GTFS validation & cleaning engine
├── pipeline.py                  # Dual-mode loader (--feed sample | --feed full)
├── fares_config.json            # Configurable Indian fare tables & concessions
└── transit.db                   # SQLite database (when running outside Docker)
```

---

## 3. GTFS Cleaning & Validation (`clean_gtfs.py`)

The cleaner script performs the following critical checks:
1. **Coordinate Verification:** Ensures latitude is within `[12.40, 13.60]` and longitude within `[79.50, 80.60]` for the Chennai metropolitan area. Flagged out-of-bounds stops are logged.
2. **Duplicate Deduplication:** Deduplicates stops and routes with matching IDs while preserving the richest description and coordinate precision.
3. **Orphan Pruning:** Removes trips referencing non-existent routes and stop times referencing non-existent stops or trips.
4. **Time Order Repair:** Enforces strictly increasing chronological order for stop times (`arrival_time <= departure_time` and `stop_n.departure <= stop_{n+1}.arrival`).
5. **UTF-8 Normalization:** Strips unprintable control characters and normalizes Unicode Tamil script.

Run cleaning standalone:
```bash
python data/clean_gtfs.py data/sample data/cleaned/sample
```

---

## 4. Ingesting Data into the Database

The ingestion pipeline automatically creates tables and loads data:

### A. Fast Sample Feed (Recommended for Development & Testing)
Loads 25 key Chennai interchange stations with ~850 trips across the day:
```bash
python data/pipeline.py --feed sample
```

### B. Full Metropolitan Feed (Production City-Scale)
Downloads the ~9 MB unified MTC bus and CMRL metro GTFS feed from GitHub, cleans it, and loads all 5,600+ stops:
```bash
python data/pipeline.py --feed full
```

---

## 5. Indian Transit Fare Rules (`fares_config.json`)

Fare rules in Indian public transit differ fundamentally from flat-rate Western transit systems. This file configures:

- **MTC City Buses:**
  - Stage-based fare calculation (1 stage ≈ 2 km).
  - Ordinary (White Board): ₹5 to ₹23.
  - Express (Green Board): `(Ordinary × 1.5) + ₹0.50`.
  - Deluxe (Blue / LED): `(Ordinary × 2.0) + ₹1.00`.
  - **Vidiyal Payanam Scheme:** 100% free bus travel for female passengers on Ordinary services.
- **CMRL Metro:**
  - Distance slab fare:
    - 0 to 2 km: ₹10
    - 2 to 4 km: ₹20
    - 4 to 6 km: ₹30
    - 6 to 9 km: ₹40
    - >9 km: ₹50
  - Flat 20% discount on Smartcards, NCMC cards, and QR tickets.
