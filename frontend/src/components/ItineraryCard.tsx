import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Footprints, ChevronDown, ChevronUp, Bus, Train, Share2, Users } from "lucide-react";
import type { Itinerary, TransitLeg } from "../types";

interface ItineraryCardProps {
  itinerary: Itinerary;
  isSelected: boolean;
  onSelect: () => void;
  isFemalePref: boolean;
  onShareTrip?: () => void;
  onReportCrowd?: (routeId: string, routeName: string) => void;
}

export const ItineraryCard: React.FC<ItineraryCardProps> = ({
  itinerary,
  isSelected,
  onSelect,
  isFemalePref,
  onShareTrip,
  onReportCrowd,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showStopsIndex, setShowStopsIndex] = useState<number | null>(null);

  const getModeIcon = (mode: string) => {
    if (mode === "METRO" || mode === "SUBURBAN_RAIL" || mode === "RAIL") return <Train size={14} />;
    if (mode === "BUS") return <Bus size={14} />;
    return <Footprints size={14} />;
  };

  const getBadgeClass = (leg: TransitLeg) => {
    if (leg.mode === "SUBURBAN_RAIL" || leg.mode === "RAIL" || leg.route_id?.startsWith("SR")) {
      return leg.route_id?.includes("MRTS") ? "badge-leg badge-mrts" : "badge-leg badge-suburban";
    }
    if (leg.mode === "METRO") {
      return leg.route_id?.includes("GREEN") ? "badge-leg badge-metro-green" : "badge-leg badge-metro-blue";
    }
    if (leg.mode === "BUS") return "badge-leg badge-bus";
    return "badge-leg badge-walk";
  };

  // Determine display fare
  const fareObj = itinerary.fare;
  let displayFare = `₹${fareObj.cash_total}`;
  let isFree = false;

  if (isFemalePref && fareObj.women_fare_total < fareObj.cash_total) {
    displayFare = fareObj.women_fare_total === 0 ? t("results.women_free") : `₹${fareObj.women_fare_total} (${t("results.women_concession")})`;
    isFree = fareObj.women_fare_total === 0;
  }

  return (
    <div
      className={`itinerary-card ${isSelected ? "selected" : ""}`}
      onClick={onSelect}
    >
      <div className="itinerary-header">
        <div className="itinerary-time-summary">
          <span className="itinerary-duration">{itinerary.duration_minutes} min</span>
          <span className="itinerary-window">
            {itinerary.departure_time.slice(0, 5)} - {itinerary.arrival_time.slice(0, 5)}
          </span>
        </div>
        <div className={`fare-pill ${isFree ? "free" : ""}`}>
          {displayFare}
        </div>
      </div>

      {/* Badges Chain */}
      <div className="legs-badge-row">
        {itinerary.legs.map((leg, idx) => (
          <React.Fragment key={idx}>
            <span className={getBadgeClass(leg)}>
              {getModeIcon(leg.mode)}
              <span>{leg.route_short_name || `${leg.duration_minutes}m`}</span>
            </span>
            {idx < itinerary.legs.length - 1 && <span className="leg-arrow">&rsaquo;</span>}
          </React.Fragment>
        ))}
        {itinerary.transfers_count > 0 && (
          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "auto" }}>
            {itinerary.transfers_count} {t("results.transfers")}
          </span>
        )}
      </div>

      {/* Expand / Collapse toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "12px",
          color: "var(--text-secondary)",
          paddingTop: "6px",
          cursor: "pointer",
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
      >
        <span>
          {itinerary.walking_time_minutes}m walk &bull; {itinerary.transit_time_minutes}m transit
        </span>
        <button
          type="button"
          style={{ background: "none", border: "none", color: "var(--accent-blue)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Detailed Stepper Breakdown */}
      {isExpanded && (
        <div className="legs-stepper">
          {itinerary.legs.map((leg, idx) => (
            <div key={idx} className="step-item">
              <div className="step-icon-col">
                <div
                  className="step-circle"
                  style={{
                    backgroundColor:
                      leg.mode === "METRO"
                        ? leg.route_id?.includes("GREEN")
                          ? "var(--metro-green)"
                          : "var(--metro-blue)"
                        : leg.mode === "BUS"
                        ? "var(--bus-red)"
                        : "var(--text-muted)",
                  }}
                >
                  {getModeIcon(leg.mode)}
                </div>
                {idx < itinerary.legs.length - 1 && <div className="step-line" />}
              </div>
              <div className="step-content">
                <div className="step-title">
                  {leg.leg_type === "WALK"
                    ? t("itinerary.walk_to", { stop: leg.to_stop_name })
                    : t("itinerary.board", {
                        route: leg.route_short_name,
                        headsign: leg.headsign || leg.to_stop_name,
                      })}
                </div>
                <div className="step-subtext">
                  {leg.departure_time.slice(0, 5)} - {leg.arrival_time.slice(0, 5)} &bull; {leg.duration_minutes} min ({leg.distance_meters > 1000 ? (leg.distance_meters / 1000).toFixed(1) + " km" : Math.round(leg.distance_meters) + " m"})
                </div>

                {/* Intermediate stops accordion for transit legs */}
                {leg.intermediate_stops_count > 0 && (
                  <div style={{ marginTop: "6px" }}>
                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        fontSize: "11px",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowStopsIndex(showStopsIndex === idx ? null : idx);
                      }}
                    >
                      {showStopsIndex === idx
                        ? t("itinerary.hide_stops")
                        : t("itinerary.intermediate_stops", { count: leg.intermediate_stops_count })}
                    </button>
                    {showStopsIndex === idx && (
                      <div
                        style={{
                          margin: "6px 0",
                          padding: "6px 10px",
                          backgroundColor: "var(--bg-surface)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "3px",
                        }}
                      >
                        {leg.intermediate_stops.map((st) => (
                          <div key={st.stop_id}>&bull; {st.stop_name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Fare detail for this leg */}
                {leg.fare && (
                  <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--text-muted)" }}>
                    {t("itinerary.fare_label")}: ₹{leg.fare.fare_amount}{" "}
                    {leg.fare.scheme_applied && (
                      <span style={{ color: "#F472B6", fontWeight: "bold" }}>
                        ({leg.fare.scheme_applied})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Action Row */}
          <div className="itinerary-action-bar">
            {onShareTrip && (
              <button
                type="button"
                className="btn-card-action"
                onClick={(e) => {
                  e.stopPropagation();
                  onShareTrip();
                }}
              >
                <Share2 size={14} /> {t("safety.shareTripTitle", "Share Trip")}
              </button>
            )}
            {onReportCrowd && (
              <button
                type="button"
                className="btn-card-action text-amber"
                onClick={(e) => {
                  e.stopPropagation();
                  const firstTransit = itinerary.legs.find((l) => l.leg_type === "TRANSIT");
                  const rId = firstTransit?.route_id || "CMRL_BLUE";
                  const rName = firstTransit?.route_short_name || "Line";
                  onReportCrowd(rId, rName);
                }}
              >
                <Users size={14} /> {t("report.reportBtn", "Report Crowd")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
