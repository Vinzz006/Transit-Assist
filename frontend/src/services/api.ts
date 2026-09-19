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
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
};

