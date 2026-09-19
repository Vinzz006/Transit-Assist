/**
 * Offline and Low-Data Caching Service.
 * Uses localStorage / IndexedDB to cache stops, routes, and recent trip plans
 * so the PWA operates reliably on slow 3G or offline conditions.
 */

import type { StopDetail, TripPlanResponse } from "../types";

const STOPS_CACHE_KEY = "transit_assist_stops_v1";
const RECENT_PLANS_KEY = "transit_assist_recent_plans_v1";
const PREFS_KEY = "transit_assist_prefs_v1";

export interface UserPrefs {
  language: "en" | "ta";
  lowDataMode: boolean;
  isFemale: boolean;
}

const DEFAULT_PREFS: UserPrefs = {
  language: "en",
  lowDataMode: false,
  isFemale: false,
};

export const cache = {
  getPrefs: (): UserPrefs => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      return saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  },

  setPrefs: (prefs: Partial<UserPrefs>): UserPrefs => {
    try {
      const current = cache.getPrefs();
      const updated = { ...current, ...prefs };
      localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
      return updated;
    } catch {
      return DEFAULT_PREFS;
    }
  },

  cacheStops: (stops: StopDetail[]) => {
    try {
      localStorage.setItem(STOPS_CACHE_KEY, JSON.stringify(stops));
    } catch (e) {
      console.warn("Local storage limit reached while caching stops", e);
    }
  },

  getCachedStops: (): StopDetail[] => {
    try {
      const saved = localStorage.getItem(STOPS_CACHE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  },

  saveRecentPlan: (plan: TripPlanResponse) => {
    try {
      const saved = localStorage.getItem(RECENT_PLANS_KEY);
      const plans: TripPlanResponse[] = saved ? JSON.parse(saved) : [];
      // Keep last 5 recent plans
      const updated = [plan, ...plans.filter(p => p.query_time !== plan.query_time)].slice(0, 5);
      localStorage.setItem(RECENT_PLANS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to cache recent trip plan", e);
    }
  },

  getRecentPlans: (): TripPlanResponse[] => {
    try {
      const saved = localStorage.getItem(RECENT_PLANS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  },
};
