import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertTriangle,
  Radio,
  Train,
  Bus,
  ShieldAlert,
  CheckCircle,
  RefreshCw,
  X,
  Send,
  Users,
  Clock,
  CloudRain,
  Flame,
} from "lucide-react";
import { api } from "../services/api";
import type {
  AdminMetrics,
  TransitIncident,
  IncidentCreateRequest,
  ReportItem,
} from "../types";

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIncidentsUpdated?: (activeIncidents: TransitIncident[]) => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  onIncidentsUpdated,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"overview" | "incidents" | "reports">("overview");
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [incidents, setIncidents] = useState<TransitIncident[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New incident form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"ALL" | "METRO" | "SUBURBAN_RAIL" | "BUS">("ALL");
  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("HIGH");
  const [affectedCorridor, setAffectedCorridor] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [m, incs, reps] = await Promise.all([
        api.getAdminMetrics(),
        api.getAdminIncidents(false),
        api.getAdminReports(25),
      ]);
      setMetrics(m);
      setIncidents(incs);
      setReports(reps);
      if (onIncidentsUpdated) {
        onIncidentsUpdated(incs.filter((i) => i.is_active));
      }
    } catch (err: any) {
      console.error("Failed to load admin data:", err);
      setErrorMsg(err.message || "Failed to load operations metrics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsBroadcasting(true);
    try {
      const req: IncidentCreateRequest = {
        title: title.trim(),
        description: description.trim(),
        mode,
        severity,
        affected_corridor: affectedCorridor.trim() || undefined,
      };
      await api.broadcastIncident(req);
      setTitle("");
      setDescription("");
      setAffectedCorridor("");
      setBroadcastSuccess(true);
      setTimeout(() => setBroadcastSuccess(false), 3000);
      await fetchData();
    } catch (err: any) {
      alert("Failed to broadcast incident: " + (err.message || "Unknown error"));
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await api.resolveIncident(id);
      await fetchData();
    } catch (err: any) {
      alert("Failed to resolve incident: " + (err.message || "Unknown error"));
    }
  };

  if (!isOpen) return null;

  const activeIncidents = incidents.filter((i) => i.is_active);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2500,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#0B0F19",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "850px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          color: "#E2E8F0",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, #111827 0%, #1E1B4B 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "rgba(59, 130, 246, 0.2)",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#60A5FA",
              }}
            >
              <Radio size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#fff" }}>
                  {t("admin.title", "Transit Operations Control Center")}
                </h2>
                {metrics && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "12px",
                      backgroundColor:
                        metrics.network_status === "OPTIMAL"
                          ? "rgba(16, 185, 129, 0.2)"
                          : metrics.network_status === "INCIDENT"
                          ? "rgba(239, 68, 68, 0.25)"
                          : "rgba(245, 158, 11, 0.2)",
                      color:
                        metrics.network_status === "OPTIMAL"
                          ? "#34D399"
                          : metrics.network_status === "INCIDENT"
                          ? "#F87171"
                          : "#FBBF24",
                      border: `1px solid ${
                        metrics.network_status === "OPTIMAL"
                          ? "rgba(16, 185, 129, 0.4)"
                          : metrics.network_status === "INCIDENT"
                          ? "rgba(239, 68, 68, 0.4)"
                          : "rgba(245, 158, 11, 0.4)"
                      }`,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor:
                          metrics.network_status === "OPTIMAL"
                            ? "#34D399"
                            : metrics.network_status === "INCIDENT"
                            ? "#F87171"
                            : "#FBBF24",
                      }}
                    />
                    {metrics.network_status}
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#94A3B8" }}>
                {t("admin.subtitle", "Chennai Metropolitan Network Telemetry & Disruption Management")}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={fetchData}
              disabled={isLoading}
              title="Refresh Telemetry"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                padding: "8px",
                color: "#94A3B8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                transition: "all 0.2s",
              }}
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                padding: "8px",
                color: "#94A3B8",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "0 16px",
            backgroundColor: "rgba(17, 24, 39, 0.5)",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            style={{
              padding: "12px 14px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "overview" ? "2px solid #3B82F6" : "2px solid transparent",
              color: activeTab === "overview" ? "#60A5FA" : "#94A3B8",
              fontWeight: activeTab === "overview" ? 600 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Activity size={15} />
            {t("admin.tab_overview", "Network Health & Fleet")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("incidents")}
            style={{
              padding: "12px 14px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "incidents" ? "2px solid #EF4444" : "2px solid transparent",
              color: activeTab === "incidents" ? "#F87171" : "#94A3B8",
              fontWeight: activeTab === "incidents" ? 600 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <AlertTriangle size={15} />
            {t("admin.tab_incidents", "Disruption Broadcasting")}
            {activeIncidents.length > 0 && (
              <span
                style={{
                  backgroundColor: "#EF4444",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: 700,
                  borderRadius: "10px",
                  padding: "1px 6px",
                }}
              >
                {activeIncidents.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            style={{
              padding: "12px 14px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "reports" ? "2px solid #10B981" : "2px solid transparent",
              color: activeTab === "reports" ? "#34D399" : "#94A3B8",
              fontWeight: activeTab === "reports" ? 600 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Users size={15} />
            {t("admin.tab_reports", "Ground Commuter Reports")} ({reports.length})
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "16px",
                color: "#FCA5A5",
                fontSize: "13px",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* TAB 1: OVERVIEW & FLEET */}
          {activeTab === "overview" && metrics && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Stat Cards Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                }}
              >
                {/* Active Fleet */}
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#94A3B8", fontSize: "12px", marginBottom: "6px" }}>
                    <span>{t("admin.active_vehicles", "Active Fleet")}</span>
                    <Train size={16} color="#60A5FA" />
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: "#fff" }}>
                    {metrics.active_vehicles_total}
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px", fontSize: "11px" }}>
                    <span style={{ color: "#38BDF8" }}>Metro: {metrics.metro_active}</span>
                    <span style={{ color: "#FBBF24" }}>Suburban: {metrics.suburban_active}</span>
                    <span style={{ color: "#34D399" }}>Bus: {metrics.bus_active}</span>
                  </div>
                </div>

                {/* Overall OTP */}
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#94A3B8", fontSize: "12px", marginBottom: "6px" }}>
                    <span>{t("admin.overall_otp", "On-Time Performance")}</span>
                    <Clock size={16} color="#34D399" />
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: "#34D399" }}>
                    {metrics.overall_otp_pct}%
                  </div>
                  <div style={{ width: "100%", backgroundColor: "rgba(255, 255, 255, 0.1)", height: "4px", borderRadius: "2px", marginTop: "10px", overflow: "hidden" }}>
                    <div style={{ width: `${metrics.overall_otp_pct}%`, backgroundColor: "#10B981", height: "100%" }} />
                  </div>
                </div>

                {/* Ground Network Scope */}
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#94A3B8", fontSize: "12px", marginBottom: "6px" }}>
                    <span>{t("admin.network_scope", "Network Coverage")}</span>
                    <Radio size={16} color="#A78BFA" />
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: "#fff" }}>
                    {metrics.total_stops} <span style={{ fontSize: "13px", fontWeight: 400, color: "#94A3B8" }}>stops</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "8px" }}>
                    across {metrics.total_routes} corridors & transit lines
                  </div>
                </div>

                {/* Monsoon & Flood Risk */}
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#94A3B8", fontSize: "12px", marginBottom: "6px" }}>
                    <span>{t("admin.flood_risk", "Monsoon Waterlogging")}</span>
                    <CloudRain size={16} color="#38BDF8" />
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                      color:
                        metrics.monsoon_flood_risk === "LOW"
                          ? "#34D399"
                          : metrics.monsoon_flood_risk === "MODERATE"
                          ? "#FBBF24"
                          : "#F87171",
                    }}
                  >
                    {metrics.monsoon_flood_risk} RISK
                  </div>
                  <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "8px" }}>
                    Subways & underpasses clear
                  </div>
                </div>
              </div>

              {/* Mode On-Time Performance (OTP) Breakdown */}
              <div
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 14px 0", color: "#fff" }}>
                  {t("admin.mode_punctuality", "Modewise Punctuality & Fleet Health")}
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Metro */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#38BDF8", fontWeight: 600 }}>
                        <Train size={14} /> CMRL Metro Rail ({metrics.metro_active} trains active)
                      </span>
                      <span style={{ fontWeight: 700, color: "#34D399" }}>{metrics.metro_otp_pct}% OTP</span>
                    </div>
                    <div style={{ width: "100%", backgroundColor: "rgba(255, 255, 255, 0.08)", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${metrics.metro_otp_pct}%`, backgroundColor: "#38BDF8", height: "100%" }} />
                    </div>
                  </div>

                  {/* Suburban Rail */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#FBBF24", fontWeight: 600 }}>
                        <Train size={14} /> Southern Railway Suburban & MRTS ({metrics.suburban_active} EMU rakes)
                      </span>
                      <span style={{ fontWeight: 700, color: "#FBBF24" }}>{metrics.suburban_otp_pct}% OTP</span>
                    </div>
                    <div style={{ width: "100%", backgroundColor: "rgba(255, 255, 255, 0.08)", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${metrics.suburban_otp_pct}%`, backgroundColor: "#F59E0B", height: "100%" }} />
                    </div>
                  </div>

                  {/* MTC Bus */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#34D399", fontWeight: 600 }}>
                        <Bus size={14} /> MTC Metropolitan Bus ({metrics.bus_active} buses active)
                      </span>
                      <span style={{ fontWeight: 700, color: "#34D399" }}>{metrics.bus_otp_pct}% OTP</span>
                    </div>
                    <div style={{ width: "100%", backgroundColor: "rgba(255, 255, 255, 0.08)", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${metrics.bus_otp_pct}%`, backgroundColor: "#10B981", height: "100%" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Incident Summary */}
              {activeIncidents.length > 0 && (
                <div
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    borderRadius: "12px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <ShieldAlert size={18} color="#F87171" />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#FCA5A5" }}>
                      {activeIncidents.length} Active Disruption{activeIncidents.length > 1 ? "s" : ""} on Network
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {activeIncidents.slice(0, 2).map((inc) => (
                      <div
                        key={inc.id}
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.2)",
                          borderRadius: "8px",
                          padding: "10px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{inc.title}</div>
                          <div style={{ fontSize: "11px", color: "#94A3B8" }}>{inc.description}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleResolve(inc.id)}
                          style={{
                            backgroundColor: "rgba(16, 185, 129, 0.2)",
                            border: "1px solid rgba(16, 185, 129, 0.4)",
                            color: "#34D399",
                            fontSize: "11px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          Resolve
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DISRUPTIONS & BROADCASTING */}
          {activeTab === "incidents" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Broadcast Form */}
              <div
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <Flame size={18} color="#F97316" />
                  <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#fff" }}>
                    {t("admin.broadcast_title", "Broadcast New Transit Advisory or Disruption")}
                  </h3>
                </div>

                {broadcastSuccess && (
                  <div
                    style={{
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid #10B981",
                      borderRadius: "8px",
                      padding: "10px",
                      marginBottom: "12px",
                      color: "#A7F3D0",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <CheckCircle size={15} />
                    {t("admin.broadcast_success", "Disruption alert broadcast to all active commuter apps successfully!")}
                  </div>
                )}

                <form onSubmit={handleBroadcast} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#94A3B8", marginBottom: "4px" }}>
                      Incident Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Signal Maintenance delay at Guindy / Flooding on OMR Corridor"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        color: "#fff",
                        fontSize: "13px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "#94A3B8", marginBottom: "4px" }}>
                        Mode
                      </label>
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value as any)}
                        style={{
                          width: "100%",
                          backgroundColor: "#1E293B",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          borderRadius: "8px",
                          padding: "8px",
                          color: "#fff",
                          fontSize: "12px",
                          outline: "none",
                        }}
                      >
                        <option value="ALL">All Modes</option>
                        <option value="METRO">CMRL Metro</option>
                        <option value="SUBURBAN_RAIL">Suburban Rail</option>
                        <option value="BUS">MTC Bus</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "#94A3B8", marginBottom: "4px" }}>
                        Severity
                      </label>
                      <select
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value as any)}
                        style={{
                          width: "100%",
                          backgroundColor: "#1E293B",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          borderRadius: "8px",
                          padding: "8px",
                          color: "#fff",
                          fontSize: "12px",
                          outline: "none",
                        }}
                      >
                        <option value="LOW">Low (Minor Advisory)</option>
                        <option value="MEDIUM">Medium (10-15m Delay)</option>
                        <option value="HIGH">High (Major Slowdown)</option>
                        <option value="CRITICAL">Critical (Suspension / Diversion)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "#94A3B8", marginBottom: "4px" }}>
                        Affected Corridor / Stop
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. GST Road / OMR"
                        value={affectedCorridor}
                        onChange={(e) => setAffectedCorridor(e.target.value)}
                        style={{
                          width: "100%",
                          backgroundColor: "rgba(0, 0, 0, 0.3)",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          borderRadius: "8px",
                          padding: "8px",
                          color: "#fff",
                          fontSize: "12px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#94A3B8", marginBottom: "4px" }}>
                      Public Advisory Description *
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Detailed advice for commuters, expected duration, alternative routes..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        color: "#fff",
                        fontSize: "13px",
                        outline: "none",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      disabled={isBroadcasting}
                      style={{
                        backgroundColor: "#EF4444",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px 18px",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Send size={14} />
                      {isBroadcasting ? "Broadcasting..." : "Broadcast to Commuters"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Active & Resolved Incident Log */}
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 12px 0", color: "#fff" }}>
                  Active Disruption Feed ({incidents.length} Total Logged)
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {incidents.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px", color: "#64748B", fontSize: "13px" }}>
                      No active transit incidents on the network.
                    </div>
                  ) : (
                    incidents.map((inc) => (
                      <div
                        key={inc.id}
                        style={{
                          backgroundColor: inc.is_active ? "rgba(239, 68, 68, 0.08)" : "rgba(255, 255, 255, 0.02)",
                          border: `1px solid ${inc.is_active ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.06)"}`,
                          borderRadius: "10px",
                          padding: "14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "12px",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor:
                                  inc.severity === "CRITICAL"
                                    ? "#EF4444"
                                    : inc.severity === "HIGH"
                                    ? "#F97316"
                                    : inc.severity === "MEDIUM"
                                    ? "#EAB308"
                                    : "#3B82F6",
                                color: "#fff",
                              }}
                            >
                              {inc.severity}
                            </span>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 600,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor: "rgba(255, 255, 255, 0.1)",
                                color: "#CBD5E1",
                              }}
                            >
                              {inc.mode}
                            </span>
                            {inc.affected_corridor && (
                              <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                                Corridor: {inc.affected_corridor}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{inc.title}</div>
                          <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{inc.description}</div>
                          <div style={{ fontSize: "10px", color: "#64748B", marginTop: "6px" }}>
                            Reported: {inc.reported_at} {inc.resolved_at && `• Resolved: ${inc.resolved_at}`}
                          </div>
                        </div>

                        {inc.is_active ? (
                          <button
                            type="button"
                            onClick={() => handleResolve(inc.id)}
                            style={{
                              backgroundColor: "rgba(16, 185, 129, 0.15)",
                              border: "1px solid rgba(16, 185, 129, 0.4)",
                              color: "#34D399",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Mark Resolved
                          </button>
                        ) : (
                          <span
                            style={{
                              color: "#64748B",
                              fontSize: "11px",
                              padding: "4px 8px",
                              backgroundColor: "rgba(255, 255, 255, 0.05)",
                              borderRadius: "4px",
                            }}
                          >
                            Resolved
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMMUTER GROUND REPORTS */}
          {activeTab === "reports" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "#fff" }}>
                  Real-time Commuter Crowd & Delay Stream
                </h3>
                <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                  Showing latest {reports.length} verified submissions
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {reports.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px", color: "#64748B", fontSize: "13px" }}>
                    No crowd reports received yet.
                  </div>
                ) : (
                  reports.map((rep) => (
                    <div
                      key={rep.id}
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#fff" }}>
                            Route {rep.route_id}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              padding: "1px 6px",
                              borderRadius: "4px",
                              textTransform: "uppercase",
                              backgroundColor:
                                rep.crowd_level === "packed"
                                  ? "rgba(239, 68, 68, 0.2)"
                                  : rep.crowd_level === "moderate"
                                  ? "rgba(249, 115, 22, 0.2)"
                                  : "rgba(16, 185, 129, 0.2)",
                              color:
                                rep.crowd_level === "packed"
                                  ? "#F87171"
                                  : rep.crowd_level === "moderate"
                                  ? "#FB923C"
                                  : "#34D399",
                            }}
                          >
                            {rep.crowd_level}
                          </span>
                          {rep.delay_minutes > 0 && (
                            <span style={{ fontSize: "10px", color: "#FBBF24" }}>
                              +{rep.delay_minutes} min delay
                            </span>
                          )}
                        </div>
                        {rep.comment && (
                          <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
                            "{rep.comment}"
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: "10px", color: "#64748B" }}>
                        {rep.created_at ? rep.created_at.slice(11, 16) : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
