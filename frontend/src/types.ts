export interface StopBase {
  stop_id: string;
  stop_code?: string;
  stop_name: string;
  stop_name_en?: string;
  stop_name_ta?: string;
  stop_lat: number;
  stop_lon: number;
  distance_meters?: number;
}

export interface StopDetail extends StopBase {
  stop_desc?: string;
  zone_id?: string;
  location_type: number;
  routes_count?: number;
}

export interface RouteSummary {
  route_id: string;
  agency_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number;
  route_color: string;
  route_text_color: string;
}

export interface NextArrival {
  trip_id: string;
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number; // 1=Metro, 3=Bus
  route_color: string;
  headsign: string;
  departure_time: string;
  departure_seconds: number;
  eta_minutes: number;
  is_realtime: boolean;
}

export interface FareBreakdown {
  agency_id: string;
  mode: string;
  service_type: string;
  distance_km: number;
  fare_amount: number;
  discounted_amount?: number;
  scheme_applied?: string;
  currency: string;
  currency_symbol: string;
}

export interface TotalFare {
  cash_total: number;
  smartcard_total: number;
  women_fare_total: number;
  currency: string;
  currency_symbol: string;
  breakdown: FareBreakdown[];
}

export interface TransitLeg {
  leg_type: "WALK" | "TRANSIT";
  mode: "WALK" | "BUS" | "METRO" | "SUBURBAN_RAIL" | "RAIL";
  route_id?: string;
  route_short_name?: string;
  route_long_name?: string;
  route_color?: string;
  route_text_color?: string;
  headsign?: string;
  from_stop_id: string;
  from_stop_name: string;
  from_stop_lat: number;
  from_stop_lon: number;
  to_stop_id: string;
  to_stop_name: string;
  to_stop_lat: number;
  to_stop_lon: number;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  distance_meters: number;
  intermediate_stops_count: number;
  intermediate_stops: StopBase[];
  polyline: [number, number][]; // [lat, lon]
  fare?: FareBreakdown;
}

export interface Itinerary {
  itinerary_id: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  walking_time_minutes: number;
  transit_time_minutes: number;
  transfers_count: number;
  legs: TransitLeg[];
  fare: TotalFare;
}

export interface TripPlanRequest {
  origin_lat: number;
  origin_lon: number;
  destination_lat: number;
  destination_lon: number;
  departure_time?: string;
  is_female?: boolean;
  max_transfers?: number;
  walk_speed_mps?: number;
}

export interface TripPlanResponse {
  origin: { lat: number; lon: number };
  destination: { lat: number; lon: number };
  query_time: string;
  itineraries_count: number;
  itineraries: Itinerary[];
}

export interface ReportCreateRequest {
  route_id: string;
  stop_id?: string;
  crowd_level: "low" | "moderate" | "packed";
  delay_minutes: number;
  comment?: string;
}

export interface ReportItem {
  id: number;
  route_id: string;
  stop_id?: string;
  crowd_level: "low" | "moderate" | "packed";
  delay_minutes: number;
  comment?: string;
  created_at: string;
}

export interface RouteCrowdSummary {
  route_id: string;
  total_reports: number;
  crowd_level: "low" | "moderate" | "packed";
  average_delay_minutes: number;
  status_label: string;
  latest_reports: ReportItem[];
}

