import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigation, MapPin, Compass, Route as RouteIcon } from "lucide-react";

import { MapView } from "./components/MapView";
import { SearchBar } from "./components/SearchBar";
import { ItineraryCard } from "./components/ItineraryCard";
import { NearbyStops } from "./components/NearbyStops";
import { RouteDetail } from "./components/RouteDetail";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { LowDataToggle } from "./components/LowDataToggle";
import { SafetyShareModal } from "./components/SafetyShareModal";
import { CrowdReportModal } from "./components/CrowdReportModal";
import { ShieldAlert } from "lucide-react";

import type { Itinerary, StopBase, TripPlanResponse } from "./types";
import { api } from "./services/api";
import { cache } from "./services/cache";

export const App: React.FC = () => {
  const { t } = useTranslation();
  const prefs = cache.getPrefs();

  const [activeTab, setActiveTab] = useState<"plan" | "nearby" | "routes">("plan");
  const [origin, setOrigin] = useState<{ lat: number; lon: number; name: string }>({
    lat: 13.0827,
    lon: 80.2754,
    name: "Chennai Central",
  });
  const [destination, setDestination] = useState<{ lat: number; lon: number; name: string }>({
    lat: 12.9780,
    lon: 80.1640,
    name: "Chennai Airport",
  });

  const [isFemalePref, setIsFemalePref] = useState(prefs.isFemale);
  const [lowDataMode, setLowDataMode] = useState(prefs.lowDataMode);

  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [selectedItinIndex, setSelectedItinIndex] = useState<number>(0);
  const [nearbyStops, setNearbyStops] = useState<StopBase[]>([]);
  const [loading, setLoading] = useState(false);

  // Phase 8 Modals
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [crowdModalRoute, setCrowdModalRoute] = useState<{ id: string; name: string } | null>(null);

  // Initial load: Fetch nearby stops and seed initial plan
  useEffect(() => {
    // 1. Fetch nearby stops around Chennai Central
    api
      .getNearbyStops(13.0827, 80.2754, 2000, 15)
      .then(setNearbyStops)
      .catch(() => {});

    // 2. Cache stops in background for offline use
    api.searchStops("", 100).then((allStops) => {
      cache.cacheStops(allStops);
    }).catch(() => {});

    // 3. Trigger initial journey search
    handlePlanJourney({
      origin: { lat: 13.0827, lon: 80.2754, name: "Chennai Central" },
      destination: { lat: 12.9780, lon: 80.1640, name: "Chennai Airport" },
      isFemale: prefs.isFemale,
    });
  }, []);

  const handlePlanJourney = (params: {
    origin: { lat: number; lon: number; name: string };
    destination: { lat: number; lon: number; name: string };
    isFemale: boolean;
  }) => {
    setLoading(true);
    setOrigin(params.origin);
    setDestination(params.destination);
    setIsFemalePref(params.isFemale);

    api
      .planTrip({
        origin_lat: params.origin.lat,
        origin_lon: params.origin.lon,
        destination_lat: params.destination.lat,
        destination_lon: params.destination.lon,
        is_female: params.isFemale,
      })
      .then((res: TripPlanResponse) => {
        setItineraries(res.itineraries);
        setSelectedItinIndex(0);
        setLoading(false);
        setActiveTab("plan");
        cache.saveRecentPlan(res);
      })
      .catch((err) => {
        setLoading(false);
        console.warn("Trip plan error", err);
        // Try fallback to cached recent plans
        const recents = cache.getRecentPlans();
        if (recents.length > 0) {
          setItineraries(recents[0].itineraries);
        }
      });
  };

  const selectedItinerary = itineraries[selectedItinIndex] || null;

  return (
    <div className="app-container">
      {/* Sidebar Panel */}
      <aside className="sidebar-panel">
        {/* Header */}
        <header className="app-header">
          <div className="brand-section">
            <div className="brand-icon">
              <Compass size={20} />
            </div>
            <div>
              <h1 className="brand-title">{t("app_name")}</h1>
              <span className="brand-subtitle">{t("app_tagline")}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className="btn-sos"
              onClick={() => setIsSafetyModalOpen(true)}
              title={t("safety.title", "Emergency SOS & Helplines")}
            >
              <ShieldAlert size={14} />
              <span>SOS</span>
            </button>
            <LanguageSwitcher />
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === "plan" ? "active" : ""}`}
            onClick={() => setActiveTab("plan")}
          >
            <Navigation size={14} />
            <span>{t("nav.plan")}</span>
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === "nearby" ? "active" : ""}`}
            onClick={() => setActiveTab("nearby")}
          >
            <MapPin size={14} />
            <span>{t("nav.nearby")}</span>
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === "routes" ? "active" : ""}`}
            onClick={() => setActiveTab("routes")}
          >
            <RouteIcon size={14} />
            <span>{t("nav.routes")}</span>
          </button>
        </nav>

        {/* Panel Content Area */}
        <main className="panel-content">
          {/* Low-data toggle & connectivity status */}
          <LowDataToggle
            lowDataMode={lowDataMode}
            onToggle={(val) => setLowDataMode(val)}
          />

          {/* TAB 1: JOURNEY PLANNER */}
          {activeTab === "plan" && (
            <>
              <SearchBar
                onSearch={handlePlanJourney}
                isFemalePref={isFemalePref}
                onToggleFemale={(val) => {
                  setIsFemalePref(val);
                  cache.setPrefs({ isFemale: val });
                }}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                    {t("results.suggested_routes")}
                  </h2>
                  {itineraries.length > 0 && (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {t("results.routes_found", { count: itineraries.length })}
                    </span>
                  )}
                </div>

                {loading ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                    {t("results.loading_routes")}
                  </div>
                ) : itineraries.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "30px 16px",
                      backgroundColor: "var(--bg-card)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px dashed var(--border-color)",
                      color: "var(--text-muted)",
                      fontSize: "0.85rem",
                    }}
                  >
                    {t("results.no_routes")}
                    <div style={{ fontSize: "0.75rem", marginTop: "4px" }}>
                      {t("results.try_different_time")}
                    </div>
                  </div>
                ) : (
                  itineraries.map((itin, index) => (
                    <ItineraryCard
                      key={itin.itinerary_id || index}
                      itinerary={itin}
                      isSelected={index === selectedItinIndex}
                      onSelect={() => setSelectedItinIndex(index)}
                      isFemalePref={isFemalePref}
                      onShareTrip={() => setIsSafetyModalOpen(true)}
                      onReportCrowd={(rId, rName) => setCrowdModalRoute({ id: rId, name: rName })}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {/* TAB 2: NEARBY STOPS */}
          {activeTab === "nearby" && (
            <NearbyStops
              stops={nearbyStops}
              onSelectStop={(s) => {
                setOrigin({ lat: s.stop_lat, lon: s.stop_lon, name: s.stop_name });
              }}
            />
          )}

          {/* TAB 3: ROUTES & METRO EXPLORER */}
          {activeTab === "routes" && (
            <RouteDetail
              onOpenReportModal={(rId, rName) => setCrowdModalRoute({ id: rId, name: rName })}
            />
          )}
        </main>
      </aside>

      {/* Map View */}
      <section className="map-container-wrapper">
        <MapView
          origin={origin}
          destination={destination}
          selectedItinerary={selectedItinerary}
          nearbyStops={nearbyStops}
          onSelectStop={(s) => {
            setDestination({ lat: s.stop_lat, lon: s.stop_lon, name: s.stop_name });
            setActiveTab("plan");
          }}
          lowDataMode={lowDataMode}
        />
      </section>

      {/* Safety & Trip Share Modal */}
      <SafetyShareModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        itinerary={selectedItinerary}
        originName={origin.name}
        destinationName={destination.name}
      />

      {/* Crowdsourced Crowd & Delay Report Modal */}
      {crowdModalRoute && (
        <CrowdReportModal
          isOpen={!!crowdModalRoute}
          onClose={() => setCrowdModalRoute(null)}
          defaultRouteId={crowdModalRoute.id}
          defaultRouteName={crowdModalRoute.name}
        />
      )}
    </div>
  );
};
