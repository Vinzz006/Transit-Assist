import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Home,
  Briefcase,
  GraduationCap,
  Star,
  Plus,
  Trash2,
  Navigation,
  Accessibility,
  Check,
  X,
} from "lucide-react";
import type { SavedPlace, Itinerary, StationAccessibility, StopDetail } from "../types";
import { cache } from "../services/cache";
import { api } from "../services/api";

interface SavedPlacesProps {
  onSelectRouteFrom: (place: { lat: number; lon: number; name: string }) => void;
  onSelectRouteTo: (place: { lat: number; lon: number; name: string }) => void;
  onSelectItinerary?: (itinerary: Itinerary) => void;
}

export const SavedPlaces: React.FC<SavedPlacesProps> = ({
  onSelectRouteFrom,
  onSelectRouteTo,
  onSelectItinerary,
}) => {
  const { t, i18n } = useTranslation();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [bookmarkedItins, setBookmarkedItins] = useState<Itinerary[]>([]);
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [showAccessibilityDir, setShowAccessibilityDir] = useState(false);
  const [accessibleStations, setAccessibleStations] = useState<StationAccessibility[]>([]);

  // Add Place form state
  const [placeLabel, setPlaceLabel] = useState<"home" | "work" | "college" | "favorite">("home");
  const [placeName, setPlaceName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [stopSuggestions, setStopSuggestions] = useState<StopDetail[]>([]);
  const [selectedCoord, setSelectedCoord] = useState<{ lat: number; lon: number; address?: string } | null>(null);

  const loadData = () => {
    setPlaces(cache.getSavedPlaces());
    setBookmarkedItins(cache.getBookmarkedItineraries());
  };

  useEffect(() => {
    loadData();
    api.getAccessibleStations().then(setAccessibleStations).catch(() => {});
  }, []);

  // Autocomplete for adding new place
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => {
        api.searchStops(searchQuery, 5).then(setStopSuggestions).catch(() => {});
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setStopSuggestions([]);
    }
  }, [searchQuery]);

  const handleSaveNewPlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoord || !placeName.trim()) {
      alert("Please select a valid transit stop or location.");
      return;
    }

    cache.savePlace({
      label: placeLabel,
      name: placeName.trim(),
      lat: selectedCoord.lat,
      lon: selectedCoord.lon,
      address: selectedCoord.address,
    });

    setIsAddingPlace(false);
    setPlaceName("");
    setSearchQuery("");
    setSelectedCoord(null);
    loadData();
  };

  const handleDeletePlace = (id: string) => {
    cache.deleteSavedPlace(id);
    loadData();
  };

  const handleRemoveBookmark = (itineraryId: string) => {
    const it = bookmarkedItins.find((b) => b.itinerary_id === itineraryId);
    if (it) {
      cache.toggleBookmarkItinerary(it);
      loadData();
    }
  };

  const getLabelIcon = (label: string) => {
    switch (label) {
      case "home":
        return <Home size={15} color="#3B82F6" />;
      case "work":
        return <Briefcase size={15} color="#10B981" />;
      case "college":
        return <GraduationCap size={15} color="#8B5CF6" />;
      default:
        return <Star size={15} color="#F59E0B" />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff", margin: 0 }}>
            {t("saved.title", "Saved Places & Commute Hubs")}
          </h3>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {t("saved.subtitle", "1-tap quick routes & offline transit bookmarks")}
          </span>
        </div>
        <button
          type="button"
          className="btn-text-action"
          onClick={() => setIsAddingPlace(!isAddingPlace)}
          style={{ fontSize: "11px", gap: "4px" }}
        >
          {isAddingPlace ? <X size={14} /> : <Plus size={14} />}
          <span>{isAddingPlace ? t("common.cancel", "Cancel") : t("saved.add_place", "Add Place")}</span>
        </button>
      </div>

      {/* Add Place Card */}
      {isAddingPlace && (
        <form
          onSubmit={handleSaveNewPlace}
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-focus)",
            borderRadius: "var(--radius-md)",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>
            {t("saved.new_place_title", "Save a Frequent Destination")}
          </div>

          {/* Label selector */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
            {[
              { id: "home", label: t("saved.home", "Home"), icon: <Home size={12} /> },
              { id: "work", label: t("saved.work", "Work"), icon: <Briefcase size={12} /> },
              { id: "college", label: t("saved.college", "College"), icon: <GraduationCap size={12} /> },
              { id: "favorite", label: t("saved.favorite", "Star"), icon: <Star size={12} /> },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`chip ${placeLabel === cat.id ? "active" : ""}`}
                style={{
                  fontSize: "11px",
                  padding: "5px 4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  borderRadius: "var(--radius-sm)",
                  border: placeLabel === cat.id ? "1px solid var(--accent-blue)" : "1px solid var(--border-color)",
                  backgroundColor: placeLabel === cat.id ? "rgba(0, 102, 204, 0.18)" : "var(--bg-surface)",
                  color: placeLabel === cat.id ? "var(--accent-blue)" : "var(--text-secondary)",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setPlaceLabel(cat.id as any);
                  if (!placeName) setPlaceName(cat.label);
                }}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Name input */}
          <input
            type="text"
            className="search-input"
            style={{ fontSize: "12px", padding: "7px 10px" }}
            placeholder={t("saved.place_name_placeholder", "Place name (e.g. My Flat, Anna Univ)")}
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            required
          />

          {/* Station/Stop Search */}
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="text"
                className="search-input"
                style={{ fontSize: "12px", padding: "7px 10px" }}
                placeholder={t("saved.search_stop_placeholder", "Search nearest stop or hub...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {stopSuggestions.length > 0 && (
              <div className="autocomplete-dropdown" style={{ top: "36px", zIndex: 20 }}>
                {stopSuggestions.map((s) => (
                  <div
                    key={s.stop_id}
                    className="autocomplete-item"
                    onClick={() => {
                      setSearchQuery(s.stop_name);
                      setSelectedCoord({ lat: s.stop_lat, lon: s.stop_lon, address: s.stop_name });
                      if (!placeName) setPlaceName(s.stop_name);
                      setStopSuggestions([]);
                    }}
                  >
                    <span className="autocomplete-name-en">{s.stop_name}</span>
                    {s.stop_name_ta && <span className="autocomplete-name-ta">{s.stop_name_ta}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedCoord && (
            <div style={{ fontSize: "11px", color: "#34D399", display: "flex", alignItems: "center", gap: "4px" }}>
              <Check size={12} /> {selectedCoord.address}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ padding: "8px", fontSize: "12px", justifyContent: "center" }}
          >
            {t("saved.save_btn", "Save Place")}
          </button>
        </form>
      )}

      {/* Saved Places List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
          {t("saved.your_places", "Your Saved Hubs")} ({places.length})
        </div>

        {places.map((p) => (
          <div
            key={p.id}
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: "var(--bg-surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {getLabelIcon(p.label)}
              </div>
              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {p.name}
                </div>
                {p.address && (
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {p.address}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Trip Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
              <button
                type="button"
                className="chip"
                style={{
                  fontSize: "11px",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--accent-blue)",
                  backgroundColor: "rgba(0, 102, 204, 0.12)",
                  color: "var(--accent-blue)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
                onClick={() => onSelectRouteTo({ lat: p.lat, lon: p.lon, name: p.name })}
                title={`Find route to ${p.name}`}
              >
                &rarr; {t("saved.to", "To")}
              </button>

              <button
                type="button"
                className="chip"
                style={{
                  fontSize: "11px",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
                onClick={() => onSelectRouteFrom({ lat: p.lat, lon: p.lon, name: p.name })}
                title={`Find route from ${p.name}`}
              >
                {t("saved.from", "From")}
              </button>

              <button
                type="button"
                onClick={() => handleDeletePlace(p.id)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}
                title="Remove saved place"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bookmarked Trips Section */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
            {t("saved.bookmarked_trips", "Starred Itineraries")} ({bookmarkedItins.length})
          </div>
        </div>

        {bookmarkedItins.length === 0 ? (
          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--bg-card)",
              border: "1px dashed var(--border-color)",
              borderRadius: "var(--radius-md)",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "12px",
            }}
          >
            {t("saved.no_bookmarks", "Star any route in the planner to save it here for offline reference.")}
          </div>
        ) : (
          bookmarkedItins.map((itin) => (
            <div
              key={itin.itinerary_id}
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>
                    {itin.duration_minutes} min
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {itin.departure_time.slice(0, 5)} - {itin.arrival_time.slice(0, 5)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent-blue)" }}>
                    ₹{itin.fare.cash_total}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBookmark(itin.itinerary_id)}
                    style={{ background: "none", border: "none", color: "#F59E0B", cursor: "pointer", padding: "2px" }}
                    title="Remove star"
                  >
                    <Star size={14} fill="#F59E0B" />
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {itin.legs.map((leg, idx) => (
                  <span
                    key={idx}
                    className="badge-leg"
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      backgroundColor: leg.mode === "METRO" ? "var(--metro-blue)" : leg.mode === "BUS" ? "var(--bus-red)" : "var(--bg-surface)",
                      color: "#fff",
                    }}
                  >
                    {leg.route_short_name || leg.mode}
                  </span>
                ))}
              </div>

              {onSelectItinerary && (
                <button
                  type="button"
                  className="btn-card-action"
                  style={{ marginTop: "4px", padding: "4px 8px", fontSize: "11px", justifyContent: "center" }}
                  onClick={() => onSelectItinerary(itin)}
                >
                  <Navigation size={12} /> {t("saved.view_trip", "View Trip on Map")}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Accessible Stations Directory Toggle */}
      <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
        <button
          type="button"
          onClick={() => setShowAccessibilityDir(!showAccessibilityDir)}
          style={{
            width: "100%",
            padding: "8px 12px",
            backgroundColor: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            borderRadius: "var(--radius-md)",
            color: "#60A5FA",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Accessibility size={15} />
            <span>{t("accessibility.view_directory", "Chennai Step-Free Stations Directory")}</span>
          </div>
          <span>{showAccessibilityDir ? "▲" : "▼"}</span>
        </button>

        {showAccessibilityDir && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
            {accessibleStations.map((st) => (
              <div
                key={st.stop_id}
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 10px",
                  fontSize: "11px",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600, color: "#fff" }}>
                    {i18n.language === "ta" ? st.station_name_ta : st.station_name}
                  </div>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: "4px",
                      backgroundColor: st.accessibility_level === "FULL" ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                      color: st.accessibility_level === "FULL" ? "#34D399" : "#FBBF24",
                    }}
                  >
                    {st.accessibility_level} ACCESSIBLE
                  </span>
                </div>
                <div style={{ color: "var(--text-secondary)", marginTop: "2px", lineHeight: 1.3 }}>
                  {i18n.language === "ta" ? st.notes_ta : st.notes_en}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
