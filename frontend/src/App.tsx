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
import { SavedPlaces } from "./components/SavedPlaces";
import { DepartureAlertModal } from "./components/DepartureAlertModal";
import { AdminDashboardModal } from "./components/AdminDashboardModal";
import { TransitWalletModal } from "./components/TransitWalletModal";
import { LiveNavigationModal } from "./components/LiveNavigationModal";
import { ShieldAlert, Bookmark, Radio, CreditCard } from "lucide-react";

import type { Itinerary, StopBase, TripPlanResponse, TransitIncident, TransitQRPass } from "./types";
import { api } from "./services/api";
import { cache } from "./services/cache";

export const App: React.FC = () => {
  const { t } = useTranslation();
  const prefs = cache.getPrefs();

  const [activeTab, setActiveTab] = useState<"plan" | "nearby" | "routes" | "saved">("plan");
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
  const [currentPreference, setCurrentPreference] = useState<"fastest" | "fewest_transfers" | "least_walking" | "cheapest">("fastest");
  const [weather, setWeather] = useState<"clear" | "rain" | "monsoon">("clear");
  const [wheelchairPref, setWheelchairPref] = useState<boolean>(false);

  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [selectedItinIndex, setSelectedItinIndex] = useState<number>(0);
  const [nearbyStops, setNearbyStops] = useState<StopBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  // Phase 8, 11, 12 & 13 Modals
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [crowdModalRoute, setCrowdModalRoute] = useState<{ id: string; name: string } | null>(null);
  const [alertModalItin, setAlertModalItin] = useState<Itinerary | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLiveNavModalOpen, setIsLiveNavModalOpen] = useState(false);
  const [navItinerary, setNavItinerary] = useState<Itinerary | null>(null);
  const [activeWalletPass, setActiveWalletPass] = useState<TransitQRPass | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(250);
  const [activeIncidents, setActiveIncidents] = useState<TransitIncident[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  // Initial load: Fetch nearby stops, active disruptions, and seed initial plan
  useEffect(() => {
    // 1. Fetch nearby stops around Chennai Central
    api
      .getNearbyStops(13.0827, 80.2754, 2000, 15)
      .then(setNearbyStops)
      .catch(() => {});

    // 2. Fetch active transit disruptions
    api
      .getAdminIncidents(true)
      .then(setActiveIncidents)
      .catch(() => {});

    // 3. Cache stops in background for offline use
    api.searchStops("", 100).then((allStops) => {
      cache.cacheStops(allStops);
    }).catch(() => {});

    // 4. Load bookmarked itineraries
    setBookmarkedIds(cache.getBookmarkedItineraries().map((it) => it.itinerary_id));

    // 5. Fetch Singara Chennai wallet balance
    api.getWalletCard().then((c) => setWalletBalance(c.balance)).catch(() => {});

    // 6. Trigger initial journey search
    handlePlanJourney({
      origin: { lat: 13.0827, lon: 80.2754, name: "Chennai Central" },
      destination: { lat: 12.9780, lon: 80.1640, name: "Chennai Airport" },
      isFemale: prefs.isFemale,
      preference: "fastest",
    });
  }, []);

  const handlePlanJourney = (params: {
    origin: { lat: number; lon: number; name: string };
    destination: { lat: number; lon: number; name: string };
    isFemale: boolean;
    preference?: "fastest" | "fewest_transfers" | "least_walking" | "cheapest";
    weather?: "clear" | "rain" | "monsoon";
    wheelchairAccessible?: boolean;
  }) => {
    const pref = params.preference || currentPreference;
    const currentW = params.weather || weather;
    const isWheelchair = params.wheelchairAccessible !== undefined ? params.wheelchairAccessible : wheelchairPref;
    setCurrentPreference(pref);
    setWeather(currentW);
    setWheelchairPref(isWheelchair);
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
        preference: pref,
        allow_auto: true,
        weather: currentW,
        wheelchair_accessible: isWheelchair,
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

  const handleGenerateTicket = async (it: Itinerary) => {
    try {
      const firstTransit = it.legs.find((l) => l.leg_type === "TRANSIT") || it.legs[0];
      const fare = isFemalePref && it.fare.women_fare_total === 0 ? 0 : (it.fare.smartcard_total || it.fare.cash_total);
      const pass = await api.generateTransitTicket({
        itinerary_id: it.itinerary_id,
        origin_name: it.origin_name || origin.name,
        destination_name: it.destination_name || destination.name,
        route_short_name: firstTransit?.route_short_name || "Line",
        mode: firstTransit?.mode || "METRO",
        fare_amount: fare,
        is_female_concession: isFemalePref && it.fare.women_fare_total === 0,
      });
      setActiveWalletPass(pass);
      setIsWalletModalOpen(true);
      const card = await api.getWalletCard();
      setWalletBalance(card.balance);
    } catch (err: any) {
      alert("Could not generate ticket: " + (err.message || "Insufficient balance. Please top up your wallet."));
    }
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
              className="btn-ops"
              onClick={() => setIsAdminModalOpen(true)}
              title={t("admin.ops_button", "Transit Operations Control Center")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(59, 130, 246, 0.35)",
                borderRadius: "6px",
                padding: "6px 10px",
                color: "#60A5FA",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Radio size={13} />
              <span>Ops</span>
            </button>
            <button
              type="button"
              className="btn-ops"
              onClick={() => setIsWalletModalOpen(true)}
              title={t("wallet.title", "Singara Chennai Transit Wallet")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                backgroundColor: "rgba(6, 182, 212, 0.15)",
                border: "1px solid rgba(6, 182, 212, 0.35)",
                borderRadius: "6px",
                padding: "6px 9px",
                color: "#67E8F9",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <CreditCard size={13} color="#22D3EE" />
              <span>₹{walletBalance.toFixed(0)}</span>
            </button>
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

        {/* Active Disruption Alert Banner */}
        {activeIncidents.length > 0 && !dismissedAlerts.includes(activeIncidents[0].id) && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.16)",
              borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#FECACA",
              fontSize: "12px",
              lineHeight: 1.3,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
              <ShieldAlert size={15} color="#EF4444" style={{ flexShrink: 0 }} />
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong style={{ color: "#fff", marginRight: "4px" }}>
                  [{activeIncidents[0].mode}] {activeIncidents[0].title}:
                </strong>
                <span>{activeIncidents[0].description}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, marginLeft: "8px" }}>
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                style={{
                  background: "rgba(239, 68, 68, 0.3)",
                  border: "1px solid rgba(239, 68, 68, 0.5)",
                  borderRadius: "4px",
                  color: "#fff",
                  fontSize: "10px",
                  padding: "2px 6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {t("admin.view", "View")}
              </button>
              <button
                type="button"
                onClick={() => setDismissedAlerts((prev) => [...prev, activeIncidents[0].id])}
                style={{
                  background: "none",
                  border: "none",
                  color: "#FCA5A5",
                  cursor: "pointer",
                  fontSize: "14px",
                  padding: "0 2px",
                  lineHeight: 1,
                }}
                title="Dismiss"
              >
                &times;
              </button>
            </div>
          </div>
        )}

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
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === "saved" ? "active" : ""}`}
            onClick={() => setActiveTab("saved")}
          >
            <Bookmark size={14} />
            <span>{t("nav.saved", "Saved")}</span>
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
                currentPreference={currentPreference}
                onPreferenceChange={(p) => {
                  handlePlanJourney({
                    origin,
                    destination,
                    isFemale: isFemalePref,
                    preference: p,
                    weather,
                  });
                }}
                currentWeather={weather}
                onWeatherChange={(w) => {
                  handlePlanJourney({
                    origin,
                    destination,
                    isFemale: isFemalePref,
                    preference: currentPreference,
                    weather: w,
                    wheelchairAccessible: wheelchairPref,
                  });
                }}
                wheelchairPref={wheelchairPref}
                onToggleWheelchair={(val) => {
                  handlePlanJourney({
                    origin,
                    destination,
                    isFemale: isFemalePref,
                    preference: currentPreference,
                    weather,
                    wheelchairAccessible: val,
                  });
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
                      onSetAlert={() => setAlertModalItin(itin)}
                      isBookmarked={bookmarkedIds.includes(itin.itinerary_id)}
                      onToggleBookmark={() => {
                        cache.toggleBookmarkItinerary(itin);
                        setBookmarkedIds(cache.getBookmarkedItineraries().map((b) => b.itinerary_id));
                      }}
                      onStartTrip={(it) => {
                        setNavItinerary(it);
                        setIsLiveNavModalOpen(true);
                      }}
                      onGenerateTicket={(it) => handleGenerateTicket(it)}
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

          {/* TAB 4: SAVED PLACES & COMMUTE HUBS */}
          {activeTab === "saved" && (
            <SavedPlaces
              onSelectRouteFrom={(p) => {
                setOrigin(p);
                setActiveTab("plan");
                handlePlanJourney({
                  origin: p,
                  destination,
                  isFemale: isFemalePref,
                  preference: currentPreference,
                  weather,
                  wheelchairAccessible: wheelchairPref,
                });
              }}
              onSelectRouteTo={(p) => {
                setDestination(p);
                setActiveTab("plan");
                handlePlanJourney({
                  origin,
                  destination: p,
                  isFemale: isFemalePref,
                  preference: currentPreference,
                  weather,
                  wheelchairAccessible: wheelchairPref,
                });
              }}
              onSelectItinerary={(itin) => {
                const firstLeg = itin.legs[0];
                const lastLeg = itin.legs[itin.legs.length - 1];
                setOrigin({ lat: firstLeg.from_stop_lat, lon: firstLeg.from_stop_lon, name: firstLeg.from_stop_name });
                setDestination({ lat: lastLeg.to_stop_lat, lon: lastLeg.to_stop_lon, name: lastLeg.to_stop_name });
                setItineraries([itin]);
                setSelectedItinIndex(0);
                setActiveTab("plan");
              }}
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

      {/* Departure Alert & Audio Chime Modal */}
      {alertModalItin && (
        <DepartureAlertModal
          isOpen={!!alertModalItin}
          onClose={() => setAlertModalItin(null)}
          itinerary={alertModalItin}
          originName={origin.name}
          destinationName={destination.name}
        />
      )}

      {/* Admin Operations Control Center Modal */}
      <AdminDashboardModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onIncidentsUpdated={(updated) => setActiveIncidents(updated)}
      />

      {/* Phase 13: Singara Chennai / NCMC Digital Transit Wallet & QR Ticketing */}
      <TransitWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        activePass={activeWalletPass}
        onBalanceUpdated={(bal) => setWalletBalance(bal)}
      />

      {/* Phase 13: Live Turn-by-Turn Transit Navigation & Stop Proximity Alarm HUD */}
      <LiveNavigationModal
        isOpen={isLiveNavModalOpen}
        onClose={() => setIsLiveNavModalOpen(false)}
        itinerary={navItinerary}
        onTripCompleted={(fare) => {
          setWalletBalance((prev) => Math.max(0, prev - fare));
        }}
        onOpenWallet={() => {
          setIsLiveNavModalOpen(false);
          setIsWalletModalOpen(true);
        }}
      />
    </div>
  );
};
