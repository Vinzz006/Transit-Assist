import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Train, Bus, Users, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import type { RouteSummary, RouteCrowdSummary, DelayPrediction } from "../types";
import { api } from "../services/api";

interface RouteDetailProps {
  onOpenReportModal?: (routeId: string, routeName: string) => void;
}

export const RouteDetail: React.FC<RouteDetailProps> = ({ onOpenReportModal }) => {
  const { t, i18n } = useTranslation();
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("CMRL_BLUE");
  const [routeDetail, setRouteDetail] = useState<any>(null);
  const [crowdSummary, setCrowdSummary] = useState<RouteCrowdSummary | null>(null);
  const [delayPrediction, setDelayPrediction] = useState<DelayPrediction | null>(null);
  const [direction, setDirection] = useState<0 | 1>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getRoutes().then(setRoutes).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedRouteId) {
      setLoading(true);
      api
        .getRouteDetail(selectedRouteId)
        .then((data) => {
          setRouteDetail(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));

      // Fetch crowd summary
      api
        .getRouteCrowdSummary(selectedRouteId)
        .then(setCrowdSummary)
        .catch(() => setCrowdSummary(null));

      // Fetch AI delay & corridor risk prediction
      api
        .predictDelay({ route_id: selectedRouteId })
        .then(setDelayPrediction)
        .catch(() => setDelayPrediction(null));
    }
  }, [selectedRouteId]);

  const getRouteColor = (r: RouteSummary) => {
    if (r.route_type === 2 || r.route_id.startsWith("SR")) {
      return r.route_id.includes("MRTS") ? "var(--mrts-purple, #7B1FA2)" : "var(--suburban-orange, #E65100)";
    }
    if (r.route_type === 1) {
      return r.route_id.includes("GREEN") ? "var(--metro-green)" : "var(--metro-blue)";
    }
    return "var(--bus-red)";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: "0.92rem", color: "var(--text-secondary)", fontWeight: 600 }}>
          {t("nav.routes")}
        </h3>
        {onOpenReportModal && routeDetail && (
          <button
            type="button"
            className="btn-text-action"
            onClick={() => onOpenReportModal(selectedRouteId, routeDetail.route_short_name || "Line")}
          >
            <Users size={14} /> {t("report.reportBtn", "Report Crowd")}
          </button>
        )}
      </div>

      {/* Routes Pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {routes.map((r) => {
          const isSelected = r.route_id === selectedRouteId;
          const bg = getRouteColor(r);

          return (
            <button
              key={r.route_id}
              type="button"
              style={{
                backgroundColor: isSelected ? bg : "var(--bg-card)",
                border: `1px solid ${isSelected ? bg : "var(--border-color)"}`,
                color: isSelected ? "#fff" : "var(--text-secondary)",
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
              onClick={() => setSelectedRouteId(r.route_id)}
            >
              {r.route_type === 1 || r.route_type === 2 ? <Train size={13} /> : <Bus size={13} />}
              {r.route_short_name}
            </button>
          );
        })}
      </div>

      {/* Route Detail Sheet */}
      {loading ? (
        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: "12px 0" }}>
          {t("routes_view.loading")}
        </div>
      ) : routeDetail ? (
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff" }}>
                {routeDetail.route_long_name}
              </div>
              {crowdSummary && (
                <div className={`crowd-badge-pill ${crowdSummary.crowd_level}`}>
                  <span className={`crowd-dot ${crowdSummary.crowd_level}`} />
                  <span>{crowdSummary.status_label}</span>
                  {crowdSummary.average_delay_minutes > 0 && (
                    <span className="delay-tag">+{crowdSummary.average_delay_minutes}m</span>
                  )}
                </div>
              )}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
              {t("routes_view.agency")}: {routeDetail.agency_id} &bull; {t("routes_view.mode")}: {routeDetail.mode}
            </div>

            {/* AI Delay Prediction & Corridor Risk */}
            {delayPrediction && (
              <div
                style={{
                  margin: "8px 0 2px 0",
                  padding: "8px 10px",
                  backgroundColor: delayPrediction.risk_level === "HIGH" ? "rgba(239, 68, 68, 0.12)" : "var(--bg-surface)",
                  border: delayPrediction.risk_level === "HIGH" ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {delayPrediction.predicted_delay_minutes > 0 ? (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#F59E0B", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <Clock size={12} /> +{delayPrediction.predicted_delay_minutes}m {t("predict.delay", "delay")}
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#10B981", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <ShieldCheck size={12} /> {t("predict.on_time", "On Time")}
                      </span>
                    )}
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                      ({Math.round(delayPrediction.confidence_score * 100)}% AI confidence)
                    </span>
                  </div>
                  {delayPrediction.is_waterlogging_prone && (
                    <span style={{ fontSize: "10px", color: "#EF4444", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <AlertTriangle size={11} /> {t("predict.waterlogging", "Waterlogging Risk")}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.3 }}>
                  {i18n.language === "ta" && delayPrediction.advisory_ta ? delayPrediction.advisory_ta : delayPrediction.advisory_en}
                </div>
              </div>
            )}
          </div>

          {/* Direction toggle */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              style={{
                flex: 1,
                padding: "6px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${direction === 0 ? "var(--accent-blue)" : "var(--border-color)"}`,
                backgroundColor: direction === 0 ? "var(--bg-card-hover)" : "var(--bg-surface)",
                color: direction === 0 ? "#fff" : "var(--text-secondary)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => setDirection(0)}
            >
              {t("routes_view.towards", { headsign: routeDetail.direction_0.headsign || "Forward" })}
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                padding: "6px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${direction === 1 ? "var(--accent-blue)" : "var(--border-color)"}`,
                backgroundColor: direction === 1 ? "var(--bg-card-hover)" : "var(--bg-surface)",
                color: direction === 1 ? "#fff" : "var(--text-secondary)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => setDirection(1)}
            >
              {t("routes_view.towards", { headsign: routeDetail.direction_1.headsign || "Reverse" })}
            </button>
          </div>

          {/* Stops sequence */}
          <div style={{ maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            {((direction === 0 ? routeDetail.direction_0.stops : routeDetail.direction_1.stops) || []).map(
              (st: any, i: number) => (
                <div
                  key={st.stop_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                    fontSize: "0.82rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", width: "16px" }}>
                      {i + 1}
                    </span>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 600 }}>{st.stop_name_en || st.stop_name}</div>
                      {st.stop_name_ta && (
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                          {st.stop_name_ta}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {st.departure_time?.slice(0, 5)}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
