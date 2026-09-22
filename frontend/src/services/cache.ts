/**
 * Offline and Low-Data Caching Service.
 * Uses localStorage / IndexedDB to cache stops, routes, and recent trip plans
 * so the PWA operates reliably on slow 3G or offline conditions.
 */

import type { StopDetail, TripPlanResponse, SavedPlace, Itinerary } from "../types";

const STOPS_CACHE_KEY = "transit_assist_stops_v1";
const RECENT_PLANS_KEY = "transit_assist_recent_plans_v1";
const PREFS_KEY = "transit_assist_prefs_v1";
const SAVED_PLACES_KEY = "transit_assist_saved_places_v1";
const BOOKMARKED_ITINS_KEY = "transit_assist_bookmarked_itins_v1";

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

const DEFAULT_SAVED_PLACES: SavedPlace[] = [
  {
    id: "sp_home",
    label: "home",
    name: "Home (Chennai Central)",
    lat: 13.0827,
    lon: 80.2754,
    address: "Puratchi Thalaivar Dr. MGR Central Hub",
    created_at: Date.now(),
  },
  {
    id: "sp_work",
    label: "work",
    name: "Office (T. Nagar)",
    lat: 13.0402,
    lon: 80.2337,
    address: "Panagal Park, South Usman Road",
    created_at: Date.now(),
  },
  {
    id: "sp_airport",
    label: "favorite",
    name: "Chennai Airport (MAA)",
    lat: 12.9780,
    lon: 80.1640,
    address: "Meenambakkam International Terminal",
    created_at: Date.now(),
  },
];

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

  // Phase 11: Saved Places
  getSavedPlaces: (): SavedPlace[] => {
    try {
      const saved = localStorage.getItem(SAVED_PLACES_KEY);
      if (!saved) {
        localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(DEFAULT_SAVED_PLACES));
        return DEFAULT_SAVED_PLACES;
      }
      return JSON.parse(saved);
    } catch {
      return DEFAULT_SAVED_PLACES;
    }
  },

  savePlace: (place: Omit<SavedPlace, "id" | "created_at">): SavedPlace => {
    try {
      const places = cache.getSavedPlaces();
      const newPlace: SavedPlace = {
        ...place,
        id: `sp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        created_at: Date.now(),
      };
      const updated = [newPlace, ...places];
      localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(updated));
      return newPlace;
    } catch (e) {
      console.warn("Failed to save place", e);
      return { ...place, id: `sp_${Date.now()}`, created_at: Date.now() };
    }
  },

  deleteSavedPlace: (id: string): void => {
    try {
      const places = cache.getSavedPlaces();
      const updated = places.filter(p => p.id !== id);
      localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to delete place", e);
    }
  },

  // Phase 11: Bookmarked Itineraries
  getBookmarkedItineraries: (): Itinerary[] => {
    try {
      const saved = localStorage.getItem(BOOKMARKED_ITINS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  },

  toggleBookmarkItinerary: (itinerary: Itinerary): boolean => {
    try {
      const items = cache.getBookmarkedItineraries();
      const exists = items.some(it => it.itinerary_id === itinerary.itinerary_id);
      let updated: Itinerary[];
      if (exists) {
        updated = items.filter(it => it.itinerary_id !== itinerary.itinerary_id);
      } else {
        updated = [itinerary, ...items].slice(0, 10);
      }
      localStorage.setItem(BOOKMARKED_ITINS_KEY, JSON.stringify(updated));
      return !exists;
    } catch (e) {
      console.warn("Failed to toggle bookmark", e);
      return false;
    }
  },

  isItineraryBookmarked: (itineraryId: string): boolean => {
    try {
      const items = cache.getBookmarkedItineraries();
      return items.some(it => it.itinerary_id === itineraryId);
    } catch {
      return false;
    }
  },
};
