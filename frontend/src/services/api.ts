import type {
  StopBase,
  StopDetail,
  RouteSummary,
  NextArrival,
  TripPlanRequest,
  TripPlanResponse,
  ReportCreateRequest,
  ReportItem,
  RouteCrowdSummary,
  VehiclePosition,
  TripUpdate,
  DelayPrediction,
  CorridorRiskItem,
  StationAccessibility,
  AdminMetrics,
  TransitIncident,
  IncidentCreateRequest,
  WalletCard,
  TopupRequest,
  TicketRequest,
  TransitQRPass,
  WalletTransaction,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }

  return res.json();
}

export const api = {
  getHealth: () => fetchJson<{ status: string; city: string; total_stops: number; total_routes: number }>(`${API_BASE_URL}/api/health`),

  searchStops: (q?: string, limit: number = 20): Promise<StopDetail[]> => {
    const params = new URLSearchParams();
    if (q) params.append("q", q);
    params.append("limit", limit.toString());
    return fetchJson<StopDetail[]>(`${API_BASE_URL}/api/stops?${params.toString()}`);
  },

  getNearbyStops: (lat: number, lon: number, radiusMeters: number = 1500, limit: number = 15): Promise<StopBase[]> => {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      radius_meters: radiusMeters.toString(),
      limit: limit.toString(),
    });
    return fetchJson<StopBase[]>(`${API_BASE_URL}/api/stops/nearby?${params.toString()}`);
  },

  getStopDetail: (stopId: string): Promise<StopDetail> => {
    return fetchJson<StopDetail>(`${API_BASE_URL}/api/stops/${encodeURIComponent(stopId)}`);
  },

  getArrivals: (stopId: string, time?: string, limit: number = 10): Promise<NextArrival[]> => {
    const params = new URLSearchParams({
      stop_id: stopId,
      limit: limit.toString(),
    });
    if (time) params.append("time", time);
    return fetchJson<NextArrival[]>(`${API_BASE_URL}/api/arrivals?${params.toString()}`);
  },

  planTrip: (req: TripPlanRequest): Promise<TripPlanResponse> => {
    return fetchJson<TripPlanResponse>(`${API_BASE_URL}/api/plan`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  getRoutes: (): Promise<RouteSummary[]> => {
    return fetchJson<RouteSummary[]>(`${API_BASE_URL}/api/routes`);
  },

  getRouteDetail: (routeId: string): Promise<any> => {
    return fetchJson<any>(`${API_BASE_URL}/api/routes/${encodeURIComponent(routeId)}`);
  },

  submitReport: (req: ReportCreateRequest): Promise<ReportItem> => {
    return fetchJson<ReportItem>(`${API_BASE_URL}/api/reports`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  getRouteCrowdSummary: (routeId: string): Promise<RouteCrowdSummary> => {
    return fetchJson<RouteCrowdSummary>(`${API_BASE_URL}/api/reports/summary/${encodeURIComponent(routeId)}`);
  },

  getRealtimeVehicles: (params?: { time?: string; route_id?: string; route_type?: number; bounds?: string }): Promise<VehiclePosition[]> => {
    const q = new URLSearchParams();
    if (params?.time) q.append("time", params.time);
    if (params?.route_id) q.append("route_id", params.route_id);
    if (params?.route_type !== undefined) q.append("route_type", params.route_type.toString());
    if (params?.bounds) q.append("bounds", params.bounds);
    const qs = q.toString();
    return fetchJson<VehiclePosition[]>(`${API_BASE_URL}/api/realtime/vehicles${qs ? `?${qs}` : ""}`);
  },

  getTripUpdates: (params?: { time?: string; route_id?: string }): Promise<TripUpdate[]> => {
    const q = new URLSearchParams();
    if (params?.time) q.append("time", params.time);
    if (params?.route_id) q.append("route_id", params.route_id);
    const qs = q.toString();
    return fetchJson<TripUpdate[]>(`${API_BASE_URL}/api/realtime/trip-updates${qs ? `?${qs}` : ""}`);
  },

  predictDelay: (params: { route_id: string; departure_time?: string; weather?: string }): Promise<DelayPrediction> => {
    const q = new URLSearchParams({ route_id: params.route_id });
    if (params.departure_time) q.append("departure_time", params.departure_time);
    if (params.weather) q.append("weather", params.weather);
    return fetchJson<DelayPrediction>(`${API_BASE_URL}/api/predict/delay?${q.toString()}`);
  },

  getCorridors: (weather?: string): Promise<{ weather: string; active_corridors_count: number; corridors: CorridorRiskItem[] }> => {
    const q = new URLSearchParams();
    if (weather) q.append("weather", weather);
    const qs = q.toString();
    return fetchJson<{ weather: string; active_corridors_count: number; corridors: CorridorRiskItem[] }>(`${API_BASE_URL}/api/predict/corridors${qs ? `?${qs}` : ""}`);
  },

  getAccessibleStations: (mode?: string): Promise<StationAccessibility[]> => {
    const q = new URLSearchParams();
    if (mode) q.append("mode", mode);
    const qs = q.toString();
    return fetchJson<StationAccessibility[]>(`${API_BASE_URL}/api/accessibility/stations${qs ? `?${qs}` : ""}`);
  },

  getAdminMetrics: (): Promise<AdminMetrics> => {
    return fetchJson<AdminMetrics>(`${API_BASE_URL}/api/admin/metrics`);
  },

  getAdminIncidents: (activeOnly: boolean = false): Promise<TransitIncident[]> => {
    return fetchJson<TransitIncident[]>(`${API_BASE_URL}/api/admin/incidents?active_only=${activeOnly}`);
  },

  broadcastIncident: (req: IncidentCreateRequest): Promise<TransitIncident> => {
    return fetchJson<TransitIncident>(`${API_BASE_URL}/api/admin/incidents`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  resolveIncident: (incidentId: string): Promise<TransitIncident> => {
    return fetchJson<TransitIncident>(`${API_BASE_URL}/api/admin/incidents/${encodeURIComponent(incidentId)}/resolve`, {
      method: "POST",
    });
  },

  getAdminReports: (limit: number = 20): Promise<ReportItem[]> => {
    return fetchJson<ReportItem[]>(`${API_BASE_URL}/api/admin/reports?limit=${limit}`);
  },

  // Phase 13: Singara Chennai / NCMC Digital Transit Wallet
  getWalletCard: (): Promise<WalletCard> => {
    return fetchJson<WalletCard>(`${API_BASE_URL}/api/wallet/card`);
  },

  topupWallet: (req: TopupRequest): Promise<WalletCard> => {
    return fetchJson<WalletCard>(`${API_BASE_URL}/api/wallet/topup`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  generateTransitTicket: (req: TicketRequest): Promise<TransitQRPass> => {
    return fetchJson<TransitQRPass>(`${API_BASE_URL}/api/wallet/ticket`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  deductFare: (amount: number, description: string, mode: string = "TRANSIT", route_short_name?: string): Promise<WalletCard> => {
    return fetchJson<WalletCard>(`${API_BASE_URL}/api/wallet/deduct`, {
      method: "POST",
      body: JSON.stringify({ amount, description, mode, route_short_name }),
    });
  },

  getWalletTransactions: (limit: number = 20): Promise<WalletTransaction[]> => {
    return fetchJson<WalletTransaction[]>(`${API_BASE_URL}/api/wallet/transactions?limit=${limit}`);
  },

  getActiveTickets: (): Promise<TransitQRPass[]> => {
    return fetchJson<TransitQRPass[]>(`${API_BASE_URL}/api/wallet/tickets/active`);
  },
};

