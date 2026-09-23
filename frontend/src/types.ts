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
  leg_type: "WALK" | "TRANSIT" | "AUTO" | "TAXI";
  mode: "WALK" | "BUS" | "METRO" | "SUBURBAN_RAIL" | "RAIL" | "AUTO" | "TAXI";
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
  instruction?: string;
  instruction_ta?: string;
  is_estimated?: boolean;
  predicted_delay_minutes?: number;
  weather_risk?: string;
  advisory_en?: string;
  advisory_ta?: string;
  is_wheelchair_accessible?: boolean;
  accessibility_notes?: string;
}

export interface Itinerary {
  itinerary_id: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  walking_time_minutes: number;
  transit_time_minutes: number;
  auto_time_minutes?: number;
  transfers_count: number;
  legs: TransitLeg[];
  fare: TotalFare;
  preference_applied?: string;
  predicted_delay_minutes?: number;
  weather_condition?: "clear" | "rain" | "monsoon";
  monsoon_warning?: string;
  is_wheelchair_accessible?: boolean;
  accessibility_notes?: string;
  origin_name?: string;
  destination_name?: string;
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
  preference?: "fastest" | "fewest_transfers" | "least_walking" | "cheapest";
  allow_auto?: boolean;
  weather?: "clear" | "rain" | "monsoon";
  wheelchair_accessible?: boolean;
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

export interface VehiclePosition {
  vehicle_id: string;
  trip_id: string;
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number; // 1=Metro, 2=Rail, 3=Bus
  agency_id: string;
  latitude: number;
  longitude: number;
  bearing: number;
  speed_kmh: number;
  current_status: "IN_TRANSIT_TO" | "STOPPED_AT" | "INCOMING_AT";
  current_stop_id?: string;
  current_stop_name?: string;
  current_stop_sequence: number;
  next_stop_id?: string;
  next_stop_name?: string;
  delay_seconds: number;
  delay_minutes: number;
  occupancy_status: "MANY_SEATS_AVAILABLE" | "FEW_SEATS_AVAILABLE" | "STANDING_ROOM_ONLY" | "FULL";
  timestamp: number;
}

export interface StopTimeUpdate {
  stop_sequence: number;
  stop_id: string;
  stop_name: string;
  arrival_time: string;
  departure_time: string;
  arrival_delay: number;
  departure_delay: number;
}

export interface TripUpdate {
  trip_id: string;
  route_id: string;
  route_short_name: string;
  delay_seconds: number;
  delay_minutes: number;
  stop_time_updates: StopTimeUpdate[];
  timestamp: number;
}

export interface DelayPrediction {
  route_id: string;
  route_short_name: string;
  mode: string;
  weather: string;
  predicted_delay_minutes: number;
  confidence_score: number;
  risk_level: "LOW" | "MODERATE" | "HIGH";
  corridor_name?: string;
  is_waterlogging_prone: boolean;
  advisory_en: string;
  advisory_ta: string;
}

export interface CorridorRiskItem {
  corridor_id: string;
  name_en: string;
  name_ta: string;
  routes: string[];
  waterlogging_risk: "NONE" | "MODERATE" | "SEVERE";
  typical_peak_delay_min: number;
  monsoon_delay_min: number;
  advice_en: string;
  advice_ta: string;
}

export interface SavedPlace {
  id: string;
  label: "home" | "work" | "college" | "favorite" | "custom";
  name: string;
  lat: number;
  lon: number;
  address?: string;
  stop_id?: string;
  created_at: number;
}

export interface StationAccessibility {
  stop_id: string;
  station_name: string;
  station_name_ta: string;
  mode: "METRO" | "SUBURBAN_RAIL" | "BUS";
  has_elevators: boolean;
  has_escalators: boolean;
  has_wheelchair_ramp: boolean;
  has_tactile_paths: boolean;
  has_accessible_restrooms: boolean;
  elevator_count: number;
  accessibility_level: "FULL" | "PARTIAL" | "LIMITED";
  notes_en: string;
  notes_ta: string;
}

export interface AdminMetrics {
  network_status: "OPTIMAL" | "ELEVATED" | "INCIDENT" | "CRITICAL";
  city: string;
  total_stops: number;
  total_routes: number;
  active_vehicles_total: number;
  metro_active: number;
  suburban_active: number;
  bus_active: number;
  overall_otp_pct: number;
  metro_otp_pct: number;
  suburban_otp_pct: number;
  bus_otp_pct: number;
  crowd_reports_total: number;
  monsoon_flood_risk: "LOW" | "MODERATE" | "HIGH";
  timestamp: string;
}

export interface TransitIncident {
  id: string;
  title: string;
  description: string;
  mode: "ALL" | "METRO" | "SUBURBAN_RAIL" | "BUS";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  affected_corridor?: string;
  is_active: boolean;
  reported_at: string;
  resolved_at?: string;
}

export interface IncidentCreateRequest {
  title: string;
  description: string;
  mode: "ALL" | "METRO" | "SUBURBAN_RAIL" | "BUS";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  affected_corridor?: string;
}

export interface WalletCard {
  card_id: string;
  card_number: string;
  masked_number: string;
  card_type: string;
  cardholder_name: string;
  balance: number;
  currency: string;
  expiry_date: string;
  is_active: boolean;
}

export interface TopupRequest {
  amount: number;
  payment_method?: string;
  upi_id?: string;
}

export interface TicketRequest {
  itinerary_id?: string;
  origin_name: string;
  destination_name: string;
  route_short_name: string;
  mode: string;
  fare_amount: number;
  is_female_concession: boolean;
}

export interface TransitQRPass {
  ticket_id: string;
  qr_data_token: string;
  origin_name: string;
  destination_name: string;
  route_short_name: string;
  mode: string;
  fare_amount: number;
  is_female_concession: boolean;
  issued_at: string;
  valid_until: string;
  validity_minutes: number;
  status: "ACTIVE" | "USED" | "EXPIRED";
}

export interface WalletTransaction {
  id: string;
  type: "TOPUP" | "FARE_PAYMENT" | "FREE_PASS";
  amount: number;
  description: string;
  mode?: string;
  route_short_name?: string;
  timestamp: string;
  balance_after: number;
}

