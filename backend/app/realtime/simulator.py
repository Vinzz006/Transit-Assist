"""
Real-time Vehicle Tracking and GTFS-RT Simulation Engine.
Computes high-frequency live vehicle positions along surveyed GTFS shapes
with realistic speed, directional bearing, dwell times, and crowdsourced delay fusion.
"""

import math
import time
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional, Any
from sqlalchemy.orm import Session

from backend.app.db.models import Trip, Route, Stop, StopTime, ShapePoint, TransitReport
from backend.app.schemas.realtime import (
    VehiclePositionItem,
    TripUpdateItem,
    StopTimeUpdateItem,
    GTFSRTFeedMessage,
    GTFSRTFeedHeader,
    GTFSRTFeedEntity,
)
from data.clean_gtfs import parse_time_to_seconds

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two points in meters."""
    R = 6371000  # meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate compass heading/bearing from point 1 to point 2 in degrees (0-360)."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = (
        math.cos(phi1) * math.sin(phi2)
        - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    )
    initial_bearing = math.degrees(math.atan2(y, x))
    return (initial_bearing + 360.0) % 360.0

def interpolate_segment(
    lat1: float, lon1: float, lat2: float, lon2: float, fraction: float
) -> Tuple[float, float]:
    """Linear interpolation between two coordinates."""
    f = max(0.0, min(1.0, fraction))
    return (lat1 + f * (lat2 - lat1), lon1 + f * (lon2 - lon1))

class VehicleTracker:
    def __init__(self, db: Session):
        self.db = db
        self._shapes_cache: Dict[str, List[Tuple[float, float]]] = {}
        self._load_shapes_cache()

    def _load_shapes_cache(self):
        """Preload shape points into memory ordered by sequence for fast spatial indexing."""
        shape_pts = (
            self.db.query(ShapePoint)
            .order_by(ShapePoint.shape_id, ShapePoint.shape_pt_sequence)
            .all()
        )
        for pt in shape_pts:
            if pt.shape_id not in self._shapes_cache:
                self._shapes_cache[pt.shape_id] = []
            self._shapes_cache[pt.shape_id].append((pt.shape_pt_lat, pt.shape_pt_lon))

    def _interpolate_along_shape(
        self,
        shape_id: Optional[str],
        lat_start: float,
        lon_start: float,
        lat_end: float,
        lon_end: float,
        fraction: float,
    ) -> Tuple[float, float, float]:
        """
        Interpolate along the shape points between start and end coordinates.
        Returns (interpolated_lat, interpolated_lon, bearing).
        """
        pts = self._shapes_cache.get(shape_id, []) if shape_id else []

        if len(pts) < 2:
            # Fallback to direct linear interpolation between stops
            inter_lat, inter_lon = interpolate_segment(lat_start, lon_start, lat_end, lon_end, fraction)
            bearing = calculate_bearing(lat_start, lon_start, lat_end, lon_end)
            return (inter_lat, inter_lon, bearing)

        # Find closest shape points to start and end
        def find_closest_idx(target_lat: float, target_lon: float) -> int:
            min_dist = float("inf")
            best_idx = 0
            for i, (plat, plon) in enumerate(pts):
                d = (plat - target_lat) ** 2 + (plon - target_lon) ** 2
                if d < min_dist:
                    min_dist = d
                    best_idx = i
            return best_idx

        idx_start = find_closest_idx(lat_start, lon_start)
        idx_end = find_closest_idx(lat_end, lon_end)

        # Slice shape points for this specific stop-to-stop segment
        if idx_start <= idx_end:
            sub_pts = pts[idx_start : idx_end + 1]
        else:
            sub_pts = list(reversed(pts[idx_end : idx_start + 1]))

        if len(sub_pts) < 2:
            inter_lat, inter_lon = interpolate_segment(lat_start, lon_start, lat_end, lon_end, fraction)
            bearing = calculate_bearing(lat_start, lon_start, lat_end, lon_end)
            return (inter_lat, inter_lon, bearing)

        # Compute cumulative distance along the sub-polyline
        distances = [0.0]
        for i in range(1, len(sub_pts)):
            d = haversine_distance(
                sub_pts[i - 1][0], sub_pts[i - 1][1], sub_pts[i][0], sub_pts[i][1]
            )
            distances.append(distances[-1] + d)

        total_distance = distances[-1]
        if total_distance <= 0:
            inter_lat, inter_lon = sub_pts[0]
            bearing = calculate_bearing(lat_start, lon_start, lat_end, lon_end)
            return (inter_lat, inter_lon, bearing)

        target_d = fraction * total_distance

        # Locate segment in polyline
        for i in range(1, len(distances)):
            if distances[i] >= target_d:
                seg_len = distances[i] - distances[i - 1]
                seg_frac = (target_d - distances[i - 1]) / seg_len if seg_len > 0 else 0.0
                p1 = sub_pts[i - 1]
                p2 = sub_pts[i]
                inter_lat, inter_lon = interpolate_segment(p1[0], p1[1], p2[0], p2[1], seg_frac)
                bearing = calculate_bearing(p1[0], p1[1], p2[0], p2[1])
                return (inter_lat, inter_lon, bearing)

        inter_lat, inter_lon = sub_pts[-1]
        bearing = calculate_bearing(sub_pts[-2][0], sub_pts[-2][1], sub_pts[-1][0], sub_pts[-1][1])
        return (inter_lat, inter_lon, bearing)

    def _get_route_reports_summary(self) -> Dict[str, Dict[str, Any]]:
        """Retrieve recent consensus delay and crowd level for active routes."""
        reports = self.db.query(TransitReport).all()
        summary: Dict[str, Dict[str, Any]] = {}
        for r in reports:
            if r.route_id not in summary:
                summary[r.route_id] = {"delays": [], "crowds": []}
            summary[r.route_id]["delays"].append(r.delay_minutes)
            summary[r.route_id]["crowds"].append(r.crowd_level)

        res = {}
        for r_id, val in summary.items():
            avg_delay = sum(val["delays"]) / len(val["delays"]) if val["delays"] else 0
            # consensus crowd
            crowds = val["crowds"]
            packed = crowds.count("packed")
            mod = crowds.count("moderate")
            if packed >= len(crowds) / 2:
                crowd = "STANDING_ROOM_ONLY"
            elif mod >= len(crowds) / 3:
                crowd = "FEW_SEATS_AVAILABLE"
            else:
                crowd = "MANY_SEATS_AVAILABLE"
            res[r_id] = {"avg_delay_min": round(avg_delay), "occupancy": crowd}
        return res

    def get_active_vehicles(
        self,
        time_str: Optional[str] = None,
        route_id: Optional[str] = None,
        route_type: Optional[int] = None,
        agency_id: Optional[str] = None,
    ) -> List[VehiclePositionItem]:
        """
        Compute real-time positions for all vehicles actively traveling at the given time.
        """
        now = datetime.now(timezone.utc)
        unix_ts = int(now.timestamp())

        if time_str:
            query_sec = parse_time_to_seconds(time_str) or (8 * 3600 + 30 * 60)
        else:
            # Current time in IST (UTC+5:30)
            ist_hour = (now.hour + 5) + (now.minute + 30) // 60
            ist_min = (now.minute + 30) % 60
            ist_sec = now.second
            query_sec = (ist_hour % 24) * 3600 + ist_min * 60 + ist_sec

        reports_summary = self._get_route_reports_summary()

        # Query all trips with their routes and agencies
        trips_query = self.db.query(Trip).join(Route, Route.route_id == Trip.route_id)
        if route_id:
            trips_query = trips_query.filter(Trip.route_id == route_id)
        if route_type is not None:
            trips_query = trips_query.filter(Route.route_type == route_type)
        if agency_id:
            trips_query = trips_query.filter(Route.agency_id == agency_id)

        all_trips = trips_query.all()

        vehicles: List[VehiclePositionItem] = []

        for trip in all_trips:
            # Fetch ordered stop times
            stop_times = (
                self.db.query(StopTime, Stop)
                .join(Stop, Stop.stop_id == StopTime.stop_id)
                .filter(StopTime.trip_id == trip.trip_id)
                .order_by(StopTime.stop_sequence)
                .all()
            )

            if len(stop_times) < 2:
                continue

            trip_start = stop_times[0][0].departure_seconds
            trip_end = stop_times[-1][0].arrival_seconds

            # Check delay reports for this route
            report_info = reports_summary.get(trip.route_id, {})
            avg_delay_min = report_info.get("avg_delay_min", 0)
            delay_sec = avg_delay_min * 60
            occupancy = report_info.get("occupancy", "MANY_SEATS_AVAILABLE")

            effective_sec = query_sec - delay_sec

            # Check if trip is active
            if not (trip_start <= effective_sec <= trip_end):
                continue

            # Find active segment
            prev_st, prev_stop = stop_times[0]
            next_st, next_stop = stop_times[1]
            status = "IN_TRANSIT_TO"
            cur_seq = 1

            for i in range(len(stop_times) - 1):
                st1, sp1 = stop_times[i]
                st2, sp2 = stop_times[i + 1]

                if effective_sec >= st1.departure_seconds and effective_sec <= st2.arrival_seconds:
                    prev_st, prev_stop = st1, sp1
                    next_st, next_stop = st2, sp2
                    cur_seq = st1.stop_sequence
                    break
                elif effective_sec >= st1.arrival_seconds and effective_sec < st1.departure_seconds:
                    # Vehicle is dwelling at stop
                    prev_st, prev_stop = st1, sp1
                    next_st, next_stop = st2, sp2
                    status = "STOPPED_AT"
                    cur_seq = st1.stop_sequence
                    break

            # Calculate progress fraction
            seg_duration = next_st.arrival_seconds - prev_st.departure_seconds
            if status == "STOPPED_AT" or seg_duration <= 0:
                fraction = 0.0
                speed_kmh = 0.0
                cur_lat, cur_lon = prev_stop.stop_lat, prev_stop.stop_lon
                bearing = calculate_bearing(
                    prev_stop.stop_lat, prev_stop.stop_lon, next_stop.stop_lat, next_stop.stop_lon
                )
            else:
                fraction = (effective_sec - prev_st.departure_seconds) / float(seg_duration)
                fraction = max(0.0, min(1.0, fraction))
                cur_lat, cur_lon, bearing = self._interpolate_along_shape(
                    trip.shape_id,
                    prev_stop.stop_lat,
                    prev_stop.stop_lon,
                    next_stop.stop_lat,
                    next_stop.stop_lon,
                    fraction,
                )

                # Assign realistic cruising speed based on route type
                r_type = trip.route.route_type
                if r_type == 1:  # Metro
                    speed_kmh = 52.0 + (hash(trip.trip_id) % 15)
                elif r_type == 2:  # Suburban Rail
                    speed_kmh = 60.0 + (hash(trip.trip_id) % 18)
                else:  # Bus
                    speed_kmh = 28.0 + (hash(trip.trip_id) % 12)

            vehicle_id = f"V_{trip.trip_id}"
            vehicles.append(
                VehiclePositionItem(
                    vehicle_id=vehicle_id,
                    trip_id=trip.trip_id,
                    route_id=trip.route_id,
                    route_short_name=trip.route.route_short_name,
                    route_long_name=trip.route.route_long_name,
                    route_type=trip.route.route_type,
                    agency_id=trip.route.agency_id,
                    latitude=round(cur_lat, 6),
                    longitude=round(cur_lon, 6),
                    bearing=round(bearing, 1),
                    speed_kmh=round(speed_kmh, 1),
                    current_status=status,
                    current_stop_id=prev_stop.stop_id,
                    current_stop_name=prev_stop.stop_name,
                    current_stop_sequence=cur_seq,
                    next_stop_id=next_stop.stop_id,
                    next_stop_name=next_stop.stop_name,
                    delay_seconds=delay_sec,
                    delay_minutes=avg_delay_min,
                    occupancy_status=occupancy,
                    timestamp=unix_ts,
                )
            )

        return vehicles

    def get_trip_updates(
        self,
        time_str: Optional[str] = None,
        route_id: Optional[str] = None,
    ) -> List[TripUpdateItem]:
        """
        Generate GTFS-RT Trip Updates for active trips including delays and schedule adjustments.
        """
        now = datetime.now(timezone.utc)
        unix_ts = int(now.timestamp())
        vehicles = self.get_active_vehicles(time_str=time_str, route_id=route_id)

        updates: List[TripUpdateItem] = []
        for v in vehicles:
            stop_times = (
                self.db.query(StopTime, Stop)
                .join(Stop, Stop.stop_id == StopTime.stop_id)
                .filter(StopTime.trip_id == v.trip_id)
                .order_by(StopTime.stop_sequence)
                .all()
            )

            st_updates: List[StopTimeUpdateItem] = []
            for st, sp in stop_times:
                st_updates.append(
                    StopTimeUpdateItem(
                        stop_sequence=st.stop_sequence,
                        stop_id=sp.stop_id,
                        stop_name=sp.stop_name,
                        arrival_time=st.arrival_time,
                        departure_time=st.departure_time,
                        arrival_delay=v.delay_seconds,
                        departure_delay=v.delay_seconds,
                    )
                )

            updates.append(
                TripUpdateItem(
                    trip_id=v.trip_id,
                    route_id=v.route_id,
                    route_short_name=v.route_short_name,
                    delay_seconds=v.delay_seconds,
                    delay_minutes=v.delay_minutes,
                    stop_time_updates=st_updates,
                    timestamp=unix_ts,
                )
            )

        return updates

    def get_gtfs_rt_feed(
        self,
        time_str: Optional[str] = None,
        route_id: Optional[str] = None,
    ) -> GTFSRTFeedMessage:
        """
        Export standard GTFS-RT 2.0 FeedMessage JSON containing VehiclePositions & TripUpdates.
        """
        now = datetime.now(timezone.utc)
        unix_ts = int(now.timestamp())

        vehicles = self.get_active_vehicles(time_str=time_str, route_id=route_id)
        trip_updates = self.get_trip_updates(time_str=time_str, route_id=route_id)
        tu_map = {tu.trip_id: tu for tu in trip_updates}

        entities: List[GTFSRTFeedEntity] = []

        for v in vehicles:
            # Vehicle position entity
            vp_data = {
                "trip": {
                    "trip_id": v.trip_id,
                    "route_id": v.route_id,
                },
                "position": {
                    "latitude": v.latitude,
                    "longitude": v.longitude,
                    "bearing": v.bearing,
                    "speed": round(v.speed_kmh / 3.6, 2),  # GTFS-RT speed is in meters/second
                },
                "current_stop_sequence": v.current_stop_sequence,
                "current_status": v.current_status,
                "timestamp": v.timestamp,
                "congestion_level": "CONGESTION" if v.delay_minutes > 5 else "RUNNING_SMOOTHLY",
                "occupancy_status": v.occupancy_status,
            }

            entities.append(
                GTFSRTFeedEntity(
                    id=f"VP_{v.vehicle_id}",
                    vehicle=vp_data,
                )
            )

            # Trip update entity
            tu = tu_map.get(v.trip_id)
            if tu:
                tu_data = {
                    "trip": {
                        "trip_id": tu.trip_id,
                        "route_id": tu.route_id,
                    },
                    "delay": tu.delay_seconds,
                    "stop_time_update": [
                        {
                            "stop_sequence": stu.stop_sequence,
                            "stop_id": stu.stop_id,
                            "arrival": {"delay": stu.arrival_delay},
                            "departure": {"delay": stu.departure_delay},
                        }
                        for stu in tu.stop_time_updates
                    ],
                    "timestamp": tu.timestamp,
                }
                entities.append(
                    GTFSRTFeedEntity(
                        id=f"TU_{v.vehicle_id}",
                        trip_update=tu_data,
                    )
                )

        header = GTFSRTFeedHeader(
            gtfs_realtime_version="2.0",
            incrementality="FULL_DATASET",
            timestamp=unix_ts,
        )

        return GTFSRTFeedMessage(header=header, entity=entities)

def get_vehicle_tracker(db: Session) -> VehicleTracker:
    return VehicleTracker(db)
