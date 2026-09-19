import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { StopBase, NextArrival } from "../types";
import { api } from "../services/api";

interface NearbyStopsProps {
  stops: StopBase[];
  onSelectStop: (stop: StopBase) => void;
}

export const NearbyStops: React.FC<NearbyStopsProps> = ({ stops, onSelectStop }) => {
  const { t } = useTranslation();
  const [selectedStop, setSelectedStop] = useState<StopBase | null>(null);
  const [arrivals, setArrivals] = useState<NextArrival[]>([]);
  const [loadingArrivals, setLoadingArrivals] = useState(false);

  useEffect(() => {
    if (selectedStop) {
      setLoadingArrivals(true);
      api
        .getArrivals(selectedStop.stop_id)
        .then((res) => {
          setArrivals(res);
          setLoadingArrivals(false);
        })
        .catch(() => setLoadingArrivals(false));
    }
  }, [selectedStop]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <h3 style={{ fontSize: "0.92rem", color: "var(--text-secondary)", fontWeight: 600 }}>
        {t("nav.nearby")}
      </h3>

      {stops.length === 0 ? (
        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: "12px 0" }}>
          No stops found near this location.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {stops.map((s) => (
            <div
              key={s.stop_id}
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
              onClick={() => {
                onSelectStop(s);
                setSelectedStop(s);
              }}
            >
              <div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#fff" }}>
                  {s.stop_name_en || s.stop_name}
                </div>
                {s.stop_name_ta && (
                  <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                    {s.stop_name_ta}
                  </div>
                )}
                <div style={{ fontSize: "0.72rem", color: "var(--accent-blue)", marginTop: "2px" }}>
                  {s.distance_meters ? `${Math.round(s.distance_meters)}m away` : ""}
                </div>
              </div>

              <button
                type="button"
                style={{
                  backgroundColor: "rgba(59, 130, 246, 0.12)",
                  border: "1px solid var(--accent-blue)",
                  color: "var(--accent-blue)",
                  borderRadius: "var(--radius-sm)",
                  padding: "4px 8px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                {t("arrivals.btn_arrivals")}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Departures Drawer */}
      {selectedStop && (
        <div
          style={{
            marginTop: "14px",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-focus)",
            borderRadius: "var(--radius-lg)",
            padding: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#fff" }}>
                {selectedStop.stop_name}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                {t("arrivals.title")}
              </div>
            </div>
            <button
              type="button"
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "12px" }}
              onClick={() => setSelectedStop(null)}
            >
              ✕ {t("arrivals.close")}
            </button>
          </div>

          {loadingArrivals ? (
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: "8px 0" }}>
              {t("arrivals.loading_schedule")}
            </div>
          ) : arrivals.length === 0 ? (
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{t("arrivals.no_arrivals")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {arrivals.slice(0, 6).map((arr, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    backgroundColor: "var(--bg-surface)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.82rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      className="badge-leg"
                      style={{
                        backgroundColor:
                          arr.route_type === 1
                            ? arr.route_id.includes("GREEN")
                              ? "var(--metro-green)"
                              : "var(--metro-blue)"
                            : "var(--bus-red)",
                        fontSize: "0.72rem",
                      }}
                    >
                      {arr.route_short_name}
                    </span>
                    <span style={{ color: "var(--text-primary)", fontSize: "0.78rem" }}>
                      to {arr.headsign}
                    </span>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#34D399", fontWeight: 700, fontSize: "0.8rem" }}>
                      {arr.eta_minutes === 0 ? t("arrivals.due_now") : t("arrivals.min_away", { minutes: arr.eta_minutes })}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {arr.departure_time.slice(0, 5)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
