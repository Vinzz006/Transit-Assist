"""
Embedded RAPTOR (Round-bAsed Public Transit Optimized Router) in Python.
Computes multi-criteria Pareto-optimal journeys across Bus, Metro, and Walking.
"""

import math
import os
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple, Any

from backend.app.db.database import SessionLocal
from backend.app.db.models import Stop, Route, Trip, StopTime, ShapePoint
from backend.app.routing.base import BaseTransitRouter
from backend.app.routing.fares import fare_calculator
from backend.app.schemas.transit import (
    TripPlanRequest,
    TripPlanResponse,
    Itinerary,
    TransitLeg,
    StopBase,
    TotalFare,
)
from data.clean_gtfs import parse_time_to_seconds, format_seconds_to_time

# Earth radius in meters
EARTH_RADIUS_M = 6371000.0

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in meters."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_M * c

@dataclass
class StopData:
    stop_id: str
    stop_code: str
    stop_name: str
    stop_name_en: str
    stop_name_ta: str
    stop_lat: float
    stop_lon: float

@dataclass
class RouteData:
    route_id: str
    agency_id: str
    route_short_name: str
    route_long_name: str
    route_type: int
    route_color: str
    route_text_color: str

@dataclass
class TripData:
    trip_id: str
    route_id: str
    headsign: str
    shape_id: Optional[str]
    stop_times: List[Tuple[int, int]]  # [(arr_sec, dep_sec), ...] per stop index

@dataclass
class RoutePattern:
    pattern_id: int
    route_id: str
    stops: List[str]  # [stop_id_0, stop_id_1, ...]
    trips: List[TripData] = field(default_factory=list)

class TransitGraph:
    """In-memory transit network graph optimized for RAPTOR exploration."""
    def __init__(self):
        self.stops: Dict[str, StopData] = {}
        self.routes: Dict[str, RouteData] = {}
        self.patterns: List[RoutePattern] = []
        self.stop_to_patterns: Dict[str, List[Tuple[int, int]]] = {}  # stop_id -> [(pattern_idx, stop_pos)]
        self.footpaths: Dict[str, List[Tuple[str, float, int]]] = {}  # stop_id -> [(target_stop_id, dist_m, walk_sec)]
        self.shapes: Dict[str, List[List[float]]] = {}  # shape_id -> [[lat, lon], ...]
        self.is_loaded = False

    def load_from_db(self):
        session = SessionLocal()
        try:
            print("Loading TransitGraph into memory from database...")
            # 1. Load stops
            db_stops = session.query(Stop).all()
            for s in db_stops:
                self.stops[s.stop_id] = StopData(
                    stop_id=s.stop_id,
                    stop_code=s.stop_code or s.stop_id,
                    stop_name=s.stop_name,
                    stop_name_en=s.stop_name_en or s.stop_name,
                    stop_name_ta=s.stop_name_ta or "",
                    stop_lat=s.stop_lat,
                    stop_lon=s.stop_lon,
                )
                self.stop_to_patterns[s.stop_id] = []
                self.footpaths[s.stop_id] = []

            # 2. Load routes
            db_routes = session.query(Route).all()
            for r in db_routes:
                self.routes[r.route_id] = RouteData(
                    route_id=r.route_id,
                    agency_id=r.agency_id,
                    route_short_name=r.route_short_name,
                    route_long_name=r.route_long_name,
                    route_type=r.route_type,
                    route_color=r.route_color or "0066CC",
                    route_text_color=r.route_text_color or "FFFFFF",
                )

            # 3. Load shapes
            db_shapes = session.query(ShapePoint).order_by(ShapePoint.shape_id, ShapePoint.shape_pt_sequence).all()
            for sp in db_shapes:
                if sp.shape_id not in self.shapes:
                    self.shapes[sp.shape_id] = []
                self.shapes[sp.shape_id].append([sp.shape_pt_lat, sp.shape_pt_lon])

            # 4. Load trips and stop times
            db_trips = session.query(Trip).all()
            db_stoptimes = session.query(StopTime).order_by(StopTime.trip_id, StopTime.stop_sequence).all()

            trip_to_st = {}
            for st in db_stoptimes:
                if st.trip_id not in trip_to_st:
                    trip_to_st[st.trip_id] = []
                trip_to_st[st.trip_id].append((st.stop_id, st.arrival_seconds, st.departure_seconds))

            # Group trips into RAPTOR patterns (by route_id + exact stop_id sequence)
            pattern_map: Dict[Tuple[str, Tuple[str, ...]], int] = {}

            for t in db_trips:
                st_list = trip_to_st.get(t.trip_id, [])
                if len(st_list) < 2:
                    continue
                stop_seq = tuple(s[0] for s in st_list)
                key = (t.route_id, stop_seq)

                if key not in pattern_map:
                    p_idx = len(self.patterns)
                    pattern_map[key] = p_idx
                    self.patterns.append(RoutePattern(
                        pattern_id=p_idx,
                        route_id=t.route_id,
                        stops=list(stop_seq),
                    ))
                    # Link stops to this pattern
                    for pos, sid in enumerate(stop_seq):
                        if sid in self.stop_to_patterns:
                            self.stop_to_patterns[sid].append((p_idx, pos))

                p_idx = pattern_map[key]
                time_pairs = [(s[1], s[2]) for s in st_list]
                self.patterns[p_idx].trips.append(TripData(
                    trip_id=t.trip_id,
                    route_id=t.route_id,
                    headsign=t.trip_headsign or "",
                    shape_id=t.shape_id,
                    stop_times=time_pairs,
                ))

            # Sort trips in each pattern by departure time at the first stop
            for pat in self.patterns:
                pat.trips.sort(key=lambda tr: tr.stop_times[0][1])

            # 5. Build Footpaths / Walking transfers between nearby stops (within 600m)
            stop_list = list(self.stops.values())
            walk_speed = 1.2  # 1.2 m/s
            for i in range(len(stop_list)):
                s1 = stop_list[i]
                for j in range(i + 1, len(stop_list)):
                    s2 = stop_list[j]
                    # Fast lat/lon box pre-filter (~0.006 deg approx 650m)
                    if abs(s1.stop_lat - s2.stop_lat) < 0.006 and abs(s1.stop_lon - s2.stop_lon) < 0.006:
                        dist = haversine_distance(s1.stop_lat, s1.stop_lon, s2.stop_lat, s2.stop_lon)
                        if dist <= 600.0:
                            walk_sec = int(math.ceil(dist / walk_speed))
                            self.footpaths[s1.stop_id].append((s2.stop_id, dist, walk_sec))
                            self.footpaths[s2.stop_id].append((s1.stop_id, dist, walk_sec))

            self.is_loaded = True
            print(f"TransitGraph loaded: {len(self.stops)} stops, {len(self.routes)} routes, "
                  f"{len(self.patterns)} patterns, {sum(len(p.trips) for p in self.patterns)} trips.")
        finally:
            session.close()

# Global graph singleton
transit_graph = TransitGraph()

class RaptorRouter(BaseTransitRouter):
    def __init__(self, graph: Optional[TransitGraph] = None):
        self.graph = graph or transit_graph

    def _ensure_graph(self):
        if not self.graph.is_loaded:
            self.graph.load_from_db()

    def plan_trip(self, request: TripPlanRequest) -> TripPlanResponse:
        self._ensure_graph()

        dep_sec = parse_time_to_seconds(request.departure_time) if request.departure_time else None
        if dep_sec is None:
            # Default to 08:30:00 morning peak if not provided
            dep_sec = 8 * 3600 + 30 * 60

        walk_speed = max(0.5, request.walk_speed_mps)
        max_access_walk_dist = 1500.0  # 1.5 km maximum walking to/from transit
        max_rounds = min(5, request.max_transfers + 1)

        # 1. Check direct walk between origin and destination
        direct_walk_m = haversine_distance(
            request.origin_lat, request.origin_lon,
            request.destination_lat, request.destination_lon
        )

        itineraries: List[Itinerary] = []

        if direct_walk_m <= 2500.0:
            # Add direct walk itinerary
            walk_dur_sec = int(math.ceil(direct_walk_m / walk_speed))
            arr_sec = dep_sec + walk_dur_sec
            direct_leg = TransitLeg(
                leg_type="WALK",
                mode="WALK",
                from_stop_id="ORIGIN",
                from_stop_name="Origin Location",
                from_stop_lat=request.origin_lat,
                from_stop_lon=request.origin_lon,
                to_stop_id="DESTINATION",
                to_stop_name="Destination Location",
                to_stop_lat=request.destination_lat,
                to_stop_lon=request.destination_lon,
                departure_time=format_seconds_to_time(dep_sec),
                arrival_time=format_seconds_to_time(arr_sec),
                duration_minutes=int(math.ceil(walk_dur_sec / 60.0)),
                distance_meters=round(direct_walk_m, 1),
                intermediate_stops_count=0,
                intermediate_stops=[],
                polyline=[[request.origin_lat, request.origin_lon], [request.destination_lat, request.destination_lon]],
                fare=None,
            )
            itineraries.append(Itinerary(
                itinerary_id="ITIN_DIRECT_WALK",
                departure_time=format_seconds_to_time(dep_sec),
                arrival_time=format_seconds_to_time(arr_sec),
                duration_minutes=int(math.ceil(walk_dur_sec / 60.0)),
                walking_time_minutes=int(math.ceil(walk_dur_sec / 60.0)),
                transit_time_minutes=0,
                transfers_count=0,
                legs=[direct_leg],
                fare=TotalFare(
                    cash_total=0.0,
                    smartcard_total=0.0,
                    women_fare_total=0.0,
                    currency="INR",
                    currency_symbol="₹",
                    breakdown=[],
                ),
            ))

        # 2. Identify Access Stops (Origin -> Nearby Stops)
        origin_stops: Dict[str, Tuple[float, int]] = {}  # stop_id -> (dist_m, walk_sec)
        for s in self.graph.stops.values():
            d = haversine_distance(request.origin_lat, request.origin_lon, s.stop_lat, s.stop_lon)
            if d <= max_access_walk_dist:
                origin_stops[s.stop_id] = (d, int(math.ceil(d / walk_speed)))

        # 3. Identify Egress Stops (Nearby Stops -> Destination)
        dest_stops: Dict[str, Tuple[float, int]] = {}  # stop_id -> (dist_m, walk_sec)
        for s in self.graph.stops.values():
            d = haversine_distance(s.stop_lat, s.stop_lon, request.destination_lat, request.destination_lon)
            if d <= max_access_walk_dist:
                dest_stops[s.stop_id] = (d, int(math.ceil(d / walk_speed)))

        if not origin_stops or not dest_stops:
            # Fallback if no stops within walking distance
            return TripPlanResponse(
                origin={"lat": request.origin_lat, "lon": request.origin_lon},
                destination={"lat": request.destination_lat, "lon": request.destination_lon},
                query_time=format_seconds_to_time(dep_sec),
                itineraries_count=len(itineraries),
                itineraries=itineraries,
            )

        # 4. Initialize RAPTOR state tables
        # tau[k][stop_id] = earliest arrival time at stop_id with at most k transit legs
        INF = 10**9
        tau: List[Dict[str, int]] = [{} for _ in range(max_rounds + 1)]
        best_tau: Dict[str, int] = {s_id: INF for s_id in self.graph.stops}

        for k in range(max_rounds + 1):
            for s_id in self.graph.stops:
                tau[k][s_id] = INF

        # Backpointers: bp[k][stop_id] = info on how stop_id was reached in round k
        # Transit: ("TRANSIT", trip_obj, board_stop_id, board_time, alight_time, pattern_idx)
        # Footpath: ("FOOTPATH", from_stop_id, walk_sec, dist_m)
        # Origin access: ("ORIGIN", dist_m, walk_sec)
        bp: List[Dict[str, Any]] = [{} for _ in range(max_rounds + 1)]

        marked_stops: Set[str] = set()

        # Round 0: Origin walking access
        for s_id, (dist_m, walk_sec) in origin_stops.items():
            arr_t = dep_sec + walk_sec
            tau[0][s_id] = arr_t
            best_tau[s_id] = arr_t
            bp[0][s_id] = ("ORIGIN", dist_m, walk_sec)
            marked_stops.add(s_id)

        # Destination best arrival tracking: (arr_sec, round_k, alight_stop_id)
        best_dest_arr = INF
        dest_solutions: List[Tuple[int, int, str]] = []

        # Check if any origin stop directly reaches destination
        for s_id, (dist_m, walk_sec) in origin_stops.items():
            if s_id in dest_stops:
                e_dist, e_walk = dest_stops[s_id]
                total_t = tau[0][s_id] + e_walk
                if total_t < best_dest_arr:
                    best_dest_arr = total_t

        # 5. RAPTOR Rounds
        for k in range(1, max_rounds + 1):
            # Copy forward previous round's arrival times
            for s_id in self.graph.stops:
                tau[k][s_id] = tau[k - 1][s_id]

            # Step A: Identify routes serving marked stops
            routes_to_explore: Dict[int, int] = {}  # pattern_idx -> min_stop_pos_in_pattern
            for m_stop in marked_stops:
                for p_idx, pos in self.graph.stop_to_patterns.get(m_stop, []):
                    if p_idx not in routes_to_explore or pos < routes_to_explore[p_idx]:
                        routes_to_explore[p_idx] = pos

            marked_stops.clear()

            # Step B: Traverse each route
            for p_idx, start_pos in routes_to_explore.items():
                pattern = self.graph.patterns[p_idx]
                curr_trip: Optional[TripData] = None
                board_stop_id: Optional[str] = None
                board_pos: Optional[int] = None
                board_time: Optional[int] = None

                for pos in range(start_pos, len(pattern.stops)):
                    s_id = pattern.stops[pos]

                    # 1. Alight
                    if curr_trip is not None:
                        alight_time = curr_trip.stop_times[pos][0]
                        if alight_time < tau[k][s_id] and alight_time < best_tau[s_id]:
                            tau[k][s_id] = alight_time
                            best_tau[s_id] = alight_time
                            bp[k][s_id] = ("TRANSIT", curr_trip, board_stop_id, board_time, alight_time, p_idx)
                            marked_stops.add(s_id)

                    # 2. Board a better trip if previous round reached s_id before or at a trip departure
                    prev_arr = tau[k - 1][s_id]
                    if prev_arr < INF:
                        # Can we find a trip departing >= prev_arr that is earlier than curr_trip?
                        # Binary search or scan trips
                        for trip in pattern.trips:
                            dep_t = trip.stop_times[pos][1]
                            if dep_t >= prev_arr:
                                if curr_trip is None or dep_t < curr_trip.stop_times[pos][1]:
                                    curr_trip = trip
                                    board_stop_id = s_id
                                    board_pos = pos
                                    board_time = dep_t
                                break

            # Step C: Footpaths / Walking transfers
            transferred_stops: Dict[str, Tuple[str, int, float]] = {}  # target_s -> (from_s, walk_sec, dist_m)
            for m_stop in list(marked_stops):
                m_arr = tau[k][m_stop]
                for (t_stop, dist_m, walk_sec) in self.graph.footpaths.get(m_stop, []):
                    target_arr = m_arr + walk_sec
                    if target_arr < tau[k][t_stop] and target_arr < best_tau[t_stop]:
                        tau[k][t_stop] = target_arr
                        best_tau[t_stop] = target_arr
                        transferred_stops[t_stop] = (m_stop, walk_sec, dist_m)

            for t_stop, (from_s, walk_sec, dist_m) in transferred_stops.items():
                bp[k][t_stop] = ("FOOTPATH", from_s, walk_sec, dist_m)
                marked_stops.add(t_stop)

            # Step D: Check destination arrival
            for s_id, (e_dist, e_walk) in dest_stops.items():
                if tau[k][s_id] < INF:
                    cand_arr = tau[k][s_id] + e_walk
                    if cand_arr < best_dest_arr:
                        best_dest_arr = cand_arr
                        dest_solutions.append((cand_arr, k, s_id))

            if not marked_stops:
                break

        # 6. Reconstruct Itineraries from dest_solutions
        seen_signatures = set()

        for cand_arr, final_k, last_stop_id in sorted(dest_solutions, key=lambda x: (x[0], x[1])):
            legs: List[TransitLeg] = []

            # A. Final egress walk to destination
            e_dist, e_walk = dest_stops[last_stop_id]
            last_stop_data = self.graph.stops[last_stop_id]
            alight_sec = tau[final_k][last_stop_id]

            if e_dist > 5.0:  # Only add walk leg if > 5 meters
                legs.append(TransitLeg(
                    leg_type="WALK",
                    mode="WALK",
                    from_stop_id=last_stop_id,
                    from_stop_name=last_stop_data.stop_name,
                    from_stop_lat=last_stop_data.stop_lat,
                    from_stop_lon=last_stop_data.stop_lon,
                    to_stop_id="DESTINATION",
                    to_stop_name="Destination Location",
                    to_stop_lat=request.destination_lat,
                    to_stop_lon=request.destination_lon,
                    departure_time=format_seconds_to_time(alight_sec),
                    arrival_time=format_seconds_to_time(alight_sec + e_walk),
                    duration_minutes=max(1, int(math.ceil(e_walk / 60.0))),
                    distance_meters=round(e_dist, 1),
                    polyline=[[last_stop_data.stop_lat, last_stop_data.stop_lon],
                              [request.destination_lat, request.destination_lon]],
                    fare=None,
                ))

            # B. Trace back transit and walking legs
            curr_stop = last_stop_id
            curr_k = final_k
            valid_path = True

            while curr_k >= 0 and curr_stop:
                record = bp[curr_k].get(curr_stop)
                if not record:
                    break

                rec_type = record[0]

                if rec_type == "ORIGIN":
                    # Initial access walk from origin
                    dist_m, walk_sec = record[1], record[2]
                    s_data = self.graph.stops[curr_stop]
                    if dist_m > 5.0:
                        legs.append(TransitLeg(
                            leg_type="WALK",
                            mode="WALK",
                            from_stop_id="ORIGIN",
                            from_stop_name="Origin Location",
                            from_stop_lat=request.origin_lat,
                            from_stop_lon=request.origin_lon,
                            to_stop_id=curr_stop,
                            to_stop_name=s_data.stop_name,
                            to_stop_lat=s_data.stop_lat,
                            to_stop_lon=s_data.stop_lon,
                            departure_time=format_seconds_to_time(dep_sec),
                            arrival_time=format_seconds_to_time(dep_sec + walk_sec),
                            duration_minutes=max(1, int(math.ceil(walk_sec / 60.0))),
                            distance_meters=round(dist_m, 1),
                            polyline=[[request.origin_lat, request.origin_lon], [s_data.stop_lat, s_data.stop_lon]],
                            fare=None,
                        ))
                    break

                elif rec_type == "FOOTPATH":
                    # Transfer walking leg between stops
                    from_s, walk_sec, dist_m = record[1], record[2], record[3]
                    s1 = self.graph.stops[from_s]
                    s2 = self.graph.stops[curr_stop]
                    transfer_arr = tau[curr_k][curr_stop]
                    transfer_dep = transfer_arr - walk_sec

                    legs.append(TransitLeg(
                        leg_type="WALK",
                        mode="WALK",
                        from_stop_id=from_s,
                        from_stop_name=s1.stop_name,
                        from_stop_lat=s1.stop_lat,
                        from_stop_lon=s1.stop_lon,
                        to_stop_id=curr_stop,
                        to_stop_name=s2.stop_name,
                        to_stop_lat=s2.stop_lat,
                        to_stop_lon=s2.stop_lon,
                        departure_time=format_seconds_to_time(transfer_dep),
                        arrival_time=format_seconds_to_time(transfer_arr),
                        duration_minutes=max(1, int(math.ceil(walk_sec / 60.0))),
                        distance_meters=round(dist_m, 1),
                        polyline=[[s1.stop_lat, s1.stop_lon], [s2.stop_lat, s2.stop_lon]],
                        fare=None,
                    ))
                    curr_stop = from_s

                elif rec_type == "TRANSIT":
                    # Transit leg
                    trip, board_s, b_time, a_time, p_idx = record[1], record[2], record[3], record[4], record[5]
                    route = self.graph.routes[trip.route_id]
                    b_stop_data = self.graph.stops[board_s]
                    a_stop_data = self.graph.stops[curr_stop]

                    pattern = self.graph.patterns[p_idx]
                    p_stops = pattern.stops
                    b_idx = p_stops.index(board_s)
                    a_idx = p_stops.index(curr_stop)

                    # Intermediate stops
                    inter_stops: List[StopBase] = []
                    leg_polyline: List[List[float]] = []

                    # If shape_id exists and is cached, use it
                    if trip.shape_id and trip.shape_id in self.graph.shapes:
                        leg_polyline = self.graph.shapes[trip.shape_id]
                    else:
                        for idx in range(b_idx, a_idx + 1):
                            st_id = p_stops[idx]
                            s_info = self.graph.stops[st_id]
                            leg_polyline.append([s_info.stop_lat, s_info.stop_lon])

                    for idx in range(b_idx + 1, a_idx):
                        st_id = p_stops[idx]
                        s_info = self.graph.stops[st_id]
                        inter_stops.append(StopBase(
                            stop_id=s_info.stop_id,
                            stop_code=s_info.stop_code,
                            stop_name=s_info.stop_name,
                            stop_name_en=s_info.stop_name_en,
                            stop_name_ta=s_info.stop_name_ta,
                            stop_lat=s_info.stop_lat,
                            stop_lon=s_info.stop_lon,
                        ))

                    leg_dist_m = haversine_distance(
                        b_stop_data.stop_lat, b_stop_data.stop_lon,
                        a_stop_data.stop_lat, a_stop_data.stop_lon
                    )

                    mode_str = "METRO" if route.route_type in (1, 2) else "BUS"
                    leg_fare = fare_calculator.calculate_leg_fare(
                        agency_id=route.agency_id,
                        route_type=route.route_type,
                        distance_meters=leg_dist_m,
                        service_type="ordinary",
                        is_female=request.is_female,
                    )

                    legs.append(TransitLeg(
                        leg_type="TRANSIT",
                        mode=mode_str,
                        route_id=route.route_id,
                        route_short_name=route.route_short_name,
                        route_long_name=route.route_long_name,
                        route_color=route.route_color,
                        route_text_color=route.route_text_color,
                        headsign=trip.headsign,
                        from_stop_id=board_s,
                        from_stop_name=b_stop_data.stop_name,
                        from_stop_lat=b_stop_data.stop_lat,
                        from_stop_lon=b_stop_data.stop_lon,
                        to_stop_id=curr_stop,
                        to_stop_name=a_stop_data.stop_name,
                        to_stop_lat=a_stop_data.stop_lat,
                        to_stop_lon=a_stop_data.stop_lon,
                        departure_time=format_seconds_to_time(b_time),
                        arrival_time=format_seconds_to_time(a_time),
                        duration_minutes=max(1, int(math.ceil((a_time - b_time) / 60.0))),
                        distance_meters=round(leg_dist_m, 1),
                        intermediate_stops_count=len(inter_stops),
                        intermediate_stops=inter_stops,
                        polyline=leg_polyline,
                        fare=leg_fare,
                    ))

                    curr_stop = board_s
                    curr_k -= 1
                else:
                    break

            # Reverse legs so they are in chronological order (origin -> destination)
            legs.reverse()

            if not legs:
                continue

            # Unique path signature to eliminate identical duplicate journeys
            sig = tuple((l.mode, l.route_id, l.from_stop_id, l.to_stop_id, l.departure_time) for l in legs)
            if sig in seen_signatures:
                continue
            seen_signatures.add(sig)

            # Aggregate durations and fares
            first_dep_sec = parse_time_to_seconds(legs[0].departure_time) or dep_sec
            last_arr_sec = parse_time_to_seconds(legs[-1].arrival_time) or cand_arr

            total_dur_min = max(1, int(math.ceil((last_arr_sec - first_dep_sec) / 60.0)))
            walk_min = sum(l.duration_minutes for l in legs if l.leg_type == "WALK")
            transit_min = sum(l.duration_minutes for l in legs if l.leg_type == "TRANSIT")
            transfers = max(0, sum(1 for l in legs if l.leg_type == "TRANSIT") - 1)

            transit_fares = [l.fare for l in legs if l.fare is not None]
            total_fare_obj = fare_calculator.calculate_total_fare(transit_fares)

            itin_id = f"ITIN_{len(itineraries) + 1:02d}"
            itineraries.append(Itinerary(
                itinerary_id=itin_id,
                departure_time=format_seconds_to_time(first_dep_sec),
                arrival_time=format_seconds_to_time(last_arr_sec),
                duration_minutes=total_dur_min,
                walking_time_minutes=walk_min,
                transit_time_minutes=transit_min,
                transfers_count=transfers,
                legs=legs,
                fare=total_fare_obj,
            ))

            if len(itineraries) >= 4:
                break

        # Sort itineraries by arrival time and duration
        itineraries.sort(key=lambda it: (it.duration_minutes, it.transfers_count))

        return TripPlanResponse(
            origin={"lat": request.origin_lat, "lon": request.origin_lon},
            destination={"lat": request.destination_lat, "lon": request.destination_lon},
            query_time=format_seconds_to_time(dep_sec),
            itineraries_count=len(itineraries),
            itineraries=itineraries,
        )

# Global router instance
raptor_router = RaptorRouter()
