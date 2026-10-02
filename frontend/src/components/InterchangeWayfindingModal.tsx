import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Compass,
  Layers,
  MapPin,
  DoorOpen,
  Accessibility,
  Bus,
  Train,
  CheckCircle2,
  Search,
  Sparkles,
  ShieldCheck,
  Footprints,
} from "lucide-react";
import type {
  InterchangeHubSummary,
  InterchangeHubDetail,
  TransferGuideResponse,
} from "../types";
import { api } from "../services/api";

interface InterchangeWayfindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultHubId?: string | null;
}

export const InterchangeWayfindingModal: React.FC<InterchangeWayfindingModalProps> = ({
  isOpen,
  onClose,
  defaultHubId,
}) => {
  const { t, i18n } = useTranslation();
  const isTa = i18n.language === "ta";

  const [activeTab, setActiveTab] = useState<"transfer" | "feeders" | "platforms" | "gates" | "amenities">("transfer");
  const [hubs, setHubs] = useState<InterchangeHubSummary[]>([]);
  const [selectedHubId, setSelectedHubId] = useState<string>("HUB_CENTRAL");
  const [hubDetail, setHubDetail] = useState<InterchangeHubDetail | null>(null);
  const [loadingHub, setLoadingHub] = useState(false);

  // Transfer Route states
  const [originPlatform, setOriginPlatform] = useState<string>("");
  const [destPlatform, setDestPlatform] = useState<string>("");
  const [wheelchairOnly, setWheelchairOnly] = useState(false);
  const [transferGuide, setTransferGuide] = useState<TransferGuideResponse | null>(null);
  const [loadingGuide, setLoadingGuide] = useState(false);

  // Feeder search state
  const [feederQuery, setFeederQuery] = useState("");

  // Load hub summaries on mount
  useEffect(() => {
    if (isOpen) {
      api.getInterchangeHubs().then((data) => {
        setHubs(data);
        if (defaultHubId && data.some((h) => h.hub_id === defaultHubId)) {
          setSelectedHubId(defaultHubId);
        } else if (data.length > 0 && !selectedHubId) {
          setSelectedHubId(data[0].hub_id);
        }
      }).catch(() => {});
    }
  }, [isOpen, defaultHubId]);

  // Load selected hub detail when selectedHubId changes
  useEffect(() => {
    if (selectedHubId) {
      setLoadingHub(true);
      setTransferGuide(null);
      setFeederQuery("");

      api.getInterchangeHubDetail(selectedHubId).then((detail) => {
        setHubDetail(detail);
        if (detail.platforms.length >= 2) {
          setOriginPlatform(detail.platforms[0].platform_id);
          setDestPlatform(detail.platforms[1].platform_id);
        }
      }).catch((err) => {
        console.error("Error loading hub detail:", err);
      }).finally(() => {
        setLoadingHub(false);
      });
    }
  }, [selectedHubId]);

  // Handle transfer guide generation
  const handleGenerateTransfer = async () => {
    if (!selectedHubId || !originPlatform || !destPlatform) return;
    setLoadingGuide(true);
    try {
      const guide = await api.getTransferGuide({
        hub_id: selectedHubId,
        origin_platform_id: originPlatform,
        destination_platform_id: destPlatform,
        wheelchair_only: wheelchairOnly,
      });
      setTransferGuide(guide);
    } catch (err: any) {
      alert("Transfer routing error: " + (err.message || "Failed to calculate path"));
    } finally {
      setLoadingGuide(false);
    }
  };

  // Filter feeders based on query
  const displayedFeeders = (hubDetail?.feeders || []).filter((f) => {
    if (!feederQuery.trim()) return true;
    const q = feederQuery.toLowerCase();
    const dest = `${f.destination_en} ${f.destination_ta} ${f.via_en} ${f.via_ta} ${f.route_number}`.toLowerCase();
    return dest.includes(q);
  });

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2600,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#0B132B",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 30px 70px -15px rgba(0, 0, 0, 0.85), 0 0 50px rgba(56, 189, 248, 0.15)",
          color: "#F8FAFC",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, rgba(14, 165, 233, 0.15) 0%, rgba(11, 19, 43, 0) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #0284C7, #0369A1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.4)",
              }}
            >
              <Compass size={22} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#F0F9FF" }}>
                  {t("interchange.title", "Station Interchanges & Feeder Wayfinding")}
                </h2>
                <span
                  style={{
                    backgroundColor: "rgba(14, 165, 233, 0.2)",
                    color: "#38BDF8",
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                >
                  Phase 15 • Smart Hub
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#94A3B8" }}>
                {t("interchange.subtitle", "Platform directories, step-free transfer routes, MTC Small Buses, and Chennai Share-Autos")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94A3B8",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Hub Selector Pills Bar */}
        <div
          style={{
            padding: "12px 24px",
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B", whiteSpace: "nowrap" }}>
            {t("interchange.all_hubs", "Major Transit Hubs")}:
          </span>
          {hubs.map((h) => {
            const isSelected = h.hub_id === selectedHubId;
            return (
              <button
                key={h.hub_id}
                onClick={() => setSelectedHubId(h.hub_id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "9999px",
                  fontSize: "0.8rem",
                  fontWeight: isSelected ? 600 : 500,
                  border: isSelected ? "1px solid #38BDF8" : "1px solid rgba(255, 255, 255, 0.08)",
                  backgroundColor: isSelected ? "rgba(14, 165, 233, 0.2)" : "rgba(255, 255, 255, 0.03)",
                  color: isSelected ? "#38BDF8" : "#94A3B8",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                }}
              >
                <MapPin size={13} color={isSelected ? "#38BDF8" : "#64748B"} />
                {isTa ? h.name_ta.split("(")[0].trim() : h.name_en.split("(")[0].trim()}
              </button>
            );
          })}
        </div>

        {/* Selected Hub Banner */}
        {hubDetail && (
          <div
            style={{
              padding: "12px 24px",
              backgroundColor: "rgba(30, 41, 59, 0.4)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#E2E8F0" }}>
                {isTa ? hubDetail.name_ta : hubDetail.name_en}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                {isTa ? hubDetail.subtitle_ta : hubDetail.subtitle_en}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {hubDetail.modes.map((m) => (
                <span
                  key={m}
                  style={{
                    fontSize: "0.68rem",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#CBD5E1",
                    fontWeight: 600,
                  }}
                >
                  {m.replace("_", " ")}
                </span>
              ))}
              <span
                style={{
                  fontSize: "0.68rem",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(34, 197, 94, 0.15)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  color: "#4ADE80",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <Accessibility size={12} /> Step-Free
              </span>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "0 24px",
            backgroundColor: "rgba(15, 23, 42, 0.3)",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {[
            { id: "transfer", label: t("interchange.tab_transfer", "Transfer Wayfinding"), icon: Footprints },
            { id: "feeders", label: t("interchange.tab_feeders", "Small Buses & Share-Autos"), icon: Bus },
            { id: "platforms", label: t("interchange.tab_platforms", "Platforms & Levels"), icon: Layers },
            { id: "gates", label: t("interchange.tab_gates", "Gates & Exits"), icon: DoorOpen },
            { id: "amenities", label: t("interchange.tab_amenities", "Station Amenities"), icon: Sparkles },
          ].map((tab) => {
            const isTabActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "14px 16px",
                  background: "transparent",
                  border: "none",
                  borderBottom: isTabActive ? "2px solid #38BDF8" : "2px solid transparent",
                  color: isTabActive ? "#38BDF8" : "#94A3B8",
                  fontWeight: isTabActive ? 600 : 500,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s",
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {loadingHub ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#94A3B8" }}>
              <div style={{ fontSize: "1.1rem", marginBottom: "8px" }}>Loading station wayfinding data...</div>
            </div>
          ) : (
            <>
              {/* TAB 1: TRANSFER WAYFINDING GUIDE */}
              {activeTab === "transfer" && hubDetail && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {/* Transfer Controls Box */}
                  <div
                    style={{
                      backgroundColor: "rgba(30, 41, 59, 0.5)",
                      borderRadius: "16px",
                      padding: "18px",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "#94A3B8", marginBottom: "6px", fontWeight: 600 }}>
                          {t("interchange.origin_platform", "Arriving Platform / Mode")}
                        </label>
                        <select
                          value={originPlatform}
                          onChange={(e) => setOriginPlatform(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            backgroundColor: "#0F172A",
                            color: "#F8FAFC",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            borderRadius: "10px",
                            fontSize: "0.85rem",
                          }}
                        >
                          {hubDetail.platforms.map((p) => (
                            <option key={p.platform_id} value={p.platform_id}>
                              {p.platform_number} ({p.mode})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "#94A3B8", marginBottom: "6px", fontWeight: 600 }}>
                          {t("interchange.dest_platform", "Connecting Platform / Mode")}
                        </label>
                        <select
                          value={destPlatform}
                          onChange={(e) => setDestPlatform(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            backgroundColor: "#0F172A",
                            color: "#F8FAFC",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            borderRadius: "10px",
                            fontSize: "0.85rem",
                          }}
                        >
                          {hubDetail.platforms.map((p) => (
                            <option key={p.platform_id} value={p.platform_id}>
                              {p.platform_number} ({p.mode})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.82rem", color: "#CBD5E1" }}>
                        <input
                          type="checkbox"
                          checked={wheelchairOnly}
                          onChange={(e) => setWheelchairOnly(e.target.checked)}
                          style={{ width: "16px", height: "16px", accentColor: "#0284C7" }}
                        />
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Accessibility size={14} color="#38BDF8" />
                          {t("interchange.wheelchair_accessible_only", "Step-Free Wheelchair Route Only")}
                        </span>
                      </label>

                      <button
                        onClick={handleGenerateTransfer}
                        disabled={loadingGuide}
                        style={{
                          backgroundColor: "#0284C7",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "10px 20px",
                          borderRadius: "10px",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                        }}
                      >
                        <Footprints size={16} />
                        {loadingGuide ? "Routing..." : t("interchange.calculate_route", "Generate Transfer Path")}
                      </button>
                    </div>
                  </div>

                  {/* Transfer Guide Output */}
                  {transferGuide && (
                    <div
                      style={{
                        backgroundColor: "rgba(15, 23, 42, 0.7)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        borderRadius: "16px",
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      {/* Metric Chips */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ backgroundColor: "rgba(56, 189, 248, 0.15)", padding: "6px 12px", borderRadius: "8px" }}>
                            <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{t("interchange.walking_time", "Walk Time")}: </span>
                            <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#38BDF8" }}>
                              {transferGuide.estimated_walk_duration_minutes} mins
                            </span>
                          </div>
                          <div style={{ backgroundColor: "rgba(56, 189, 248, 0.15)", padding: "6px 12px", borderRadius: "8px" }}>
                            <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{t("interchange.walking_distance", "Distance")}: </span>
                            <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#38BDF8" }}>
                              {transferGuide.total_walking_distance_meters} m
                            </span>
                          </div>
                        </div>

                        {transferGuide.is_fully_step_free && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              backgroundColor: "rgba(34, 197, 94, 0.15)",
                              color: "#4ADE80",
                              padding: "4px 10px",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              border: "1px solid rgba(34, 197, 94, 0.3)",
                            }}
                          >
                            <CheckCircle2 size={14} /> 100% Step-Free Accessible
                          </div>
                        )}
                      </div>

                      {/* Step By Step Timeline */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", position: "relative" }}>
                        {transferGuide.steps.map((st) => (
                          <div
                            key={st.step_number}
                            style={{
                              display: "flex",
                              gap: "14px",
                              alignItems: "flex-start",
                              padding: "12px",
                              borderRadius: "12px",
                              backgroundColor: "rgba(30, 41, 59, 0.4)",
                              border: "1px solid rgba(255, 255, 255, 0.05)",
                            }}
                          >
                            <div
                              style={{
                                width: "26px",
                                height: "26px",
                                borderRadius: "50%",
                                backgroundColor: "#0284C7",
                                color: "#FFFFFF",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {st.step_number}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "0.85rem", color: "#F1F5F9", lineHeight: "1.4" }}>
                                {isTa ? st.instruction_ta : st.instruction_en}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                                  ~{st.distance_meters}m • {st.duration_seconds}s
                                </span>
                                {st.level_change && (
                                  <span
                                    style={{
                                      fontSize: "0.68rem",
                                      backgroundColor: "rgba(168, 85, 247, 0.2)",
                                      color: "#C084FC",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {st.level_change}
                                  </span>
                                )}
                                <span
                                  style={{
                                    fontSize: "0.68rem",
                                    backgroundColor: "rgba(56, 189, 248, 0.1)",
                                    color: "#7DD3FC",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                  }}
                                >
                                  Signage: {st.signage_clue}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Station Safety Tips */}
                      <div
                        style={{
                          backgroundColor: "rgba(30, 41, 59, 0.3)",
                          borderRadius: "10px",
                          padding: "10px 14px",
                          borderLeft: "3px solid #38BDF8",
                          fontSize: "0.75rem",
                          color: "#94A3B8",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#E2E8F0", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <ShieldCheck size={14} color="#38BDF8" /> Commuter Wayfinding Tips:
                        </div>
                        {(isTa ? transferGuide.tips_ta : transferGuide.tips_en).map((tip, idx) => (
                          <div key={idx} style={{ margin: "2px 0" }}>• {tip}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: FIRST/LAST-MILE FEEDERS & SHARE-AUTOS */}
              {activeTab === "feeders" && hubDetail && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Neighbourhood Search Filter */}
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Search
                      size={18}
                      color="#64748B"
                      style={{ position: "absolute", left: "14px" }}
                    />
                    <input
                      type="text"
                      placeholder={t("interchange.search_neighbourhood", "Search destination (e.g. Madipakkam, Porur, Mogappair...)")}
                      value={feederQuery}
                      onChange={(e) => setFeederQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 14px 12px 42px",
                        backgroundColor: "rgba(30, 41, 59, 0.6)",
                        color: "#F8FAFC",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: "14px",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* Feeder Cards List */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {displayedFeeders.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px", color: "#64748B", fontSize: "0.85rem" }}>
                        No feeder services matching "{feederQuery}". Try searching for another nearby neighbourhood.
                      </div>
                    ) : (
                      displayedFeeders.map((f) => {
                        const isShareAuto = f.service_type === "SHARE_AUTO";
                        return (
                          <div
                            key={f.service_id}
                            style={{
                              backgroundColor: "rgba(30, 41, 59, 0.4)",
                              borderRadius: "16px",
                              padding: "16px",
                              border: isShareAuto
                                ? "1px solid rgba(234, 179, 8, 0.25)"
                                : "1px solid rgba(56, 189, 248, 0.25)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: "12px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <div
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  borderRadius: "10px",
                                  backgroundColor: isShareAuto
                                    ? "rgba(234, 179, 8, 0.15)"
                                    : "rgba(56, 189, 248, 0.15)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                {isShareAuto ? (
                                  <span style={{ fontSize: "1.2rem" }}>🛺</span>
                                ) : (
                                  <Bus size={20} color="#38BDF8" />
                                )}
                              </div>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span
                                    style={{
                                      backgroundColor: isShareAuto
                                        ? "rgba(234, 179, 8, 0.2)"
                                        : "rgba(56, 189, 248, 0.2)",
                                      color: isShareAuto ? "#FDE047" : "#7DD3FC",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      fontSize: "0.72rem",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {f.route_number}
                                  </span>
                                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#F1F5F9" }}>
                                    {isTa ? f.destination_ta : f.destination_en}
                                  </span>
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "3px" }}>
                                  Via: {isTa ? f.via_ta : f.via_en}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "6px", fontSize: "0.72rem", color: "#64748B" }}>
                                  <span>{f.vehicle_capacity}</span>
                                  <span>•</span>
                                  <span>Stand: <strong style={{ color: "#E2E8F0" }}>{f.boarding_gate_code}</strong></span>
                                  <span>•</span>
                                  <span>Hours: {f.operating_hours}</span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#38BDF8" }}>
                                  ₹{f.fare_inr.toFixed(0)}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "#94A3B8" }}>
                                  {t("interchange.fixed_fare", "Fixed Fare")}
                                </div>
                              </div>
                              <div
                                style={{
                                  backgroundColor: "rgba(34, 197, 94, 0.15)",
                                  color: "#4ADE80",
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                  border: "1px solid rgba(34, 197, 94, 0.25)",
                                }}
                              >
                                {t("interchange.frequency", { min: f.frequency_minutes, defaultValue: `Every ${f.frequency_minutes}m` })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: PLATFORMS & LEVELS DIRECTORY */}
              {activeTab === "platforms" && hubDetail && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {hubDetail.platforms.map((p) => (
                    <div
                      key={p.platform_id}
                      style={{
                        backgroundColor: "rgba(30, 41, 59, 0.4)",
                        borderRadius: "14px",
                        padding: "16px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            backgroundColor: p.mode === "METRO" ? "rgba(14, 165, 233, 0.2)" : "rgba(168, 85, 247, 0.2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Train size={18} color={p.mode === "METRO" ? "#38BDF8" : "#C084FC"} />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#F8FAFC" }}>
                              {p.platform_number}
                            </span>
                            <span
                              style={{
                                fontSize: "0.68rem",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                backgroundColor: "rgba(255, 255, 255, 0.06)",
                                color: "#94A3B8",
                              }}
                            >
                              {p.level.replace("_", " ")}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "#94A3B8", marginTop: "3px" }}>
                            {isTa ? p.service_direction_ta : p.service_direction}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {p.has_lift && (
                          <span style={{ fontSize: "0.7rem", backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#4ADE80", padding: "2px 6px", borderRadius: "4px" }}>
                            Lift
                          </span>
                        )}
                        {p.has_escalator && (
                          <span style={{ fontSize: "0.7rem", backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#7DD3FC", padding: "2px 6px", borderRadius: "4px" }}>
                            Escalator
                          </span>
                        )}
                        {p.accessible && (
                          <span style={{ fontSize: "0.7rem", backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#4ADE80", padding: "2px 6px", borderRadius: "4px" }}>
                            Step-Free
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: GATES & EXITS DIRECTORY */}
              {activeTab === "gates" && hubDetail && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {hubDetail.exit_gates.map((g) => (
                    <div
                      key={g.gate_id}
                      style={{
                        backgroundColor: "rgba(30, 41, 59, 0.4)",
                        borderRadius: "14px",
                        padding: "16px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "14px",
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: "#0284C7",
                          color: "#FFFFFF",
                          padding: "6px 10px",
                          borderRadius: "8px",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {g.gate_code}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#F8FAFC" }}>
                          {isTa ? g.name_ta : g.name_en}
                        </div>
                        <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {(isTa ? g.leading_to_ta : g.leading_to).map((item, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: "0.72rem",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                backgroundColor: "rgba(255, 255, 255, 0.06)",
                                color: "#CBD5E1",
                              }}
                            >
                              📍 {item}
                            </span>
                          ))}
                        </div>
                        {g.nearby_feeder_stand && (
                          <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "#38BDF8", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span>Stand / Shuttle:</span>
                            <strong>{g.nearby_feeder_stand}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 5: STATION AMENITIES */}
              {activeTab === "amenities" && hubDetail && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {hubDetail.amenities.map((a, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: "rgba(30, 41, 59, 0.4)",
                        borderRadius: "12px",
                        padding: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#F8FAFC" }}>
                          {isTa ? a.name_ta : a.name_en}
                        </span>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            backgroundColor: "rgba(34, 197, 94, 0.15)",
                            color: "#4ADE80",
                            padding: "1px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          Verified
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#94A3B8" }}>
                        {isTa ? a.location_description_ta : a.location_description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
