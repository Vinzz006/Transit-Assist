import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Leaf,
  Award,
  Trees,
  Fuel,
  Sparkles,
  CheckCircle2,
  TrendingDown,
  RefreshCw,
  Info,
} from "lucide-react";
import { api } from "../services/api";
import type {
  Itinerary,
  EcoTripComparison,
  CommuteOptimizerResponse,
  GreenCommuterProfile,
  MonthlyPassOption,
} from "../types";

interface EcoTransitModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItinerary?: Itinerary | null;
}

export const EcoTransitModal: React.FC<EcoTransitModalProps> = ({
  isOpen,
  onClose,
  selectedItinerary,
}) => {
  const { t, i18n } = useTranslation();
  const isTa = i18n.language === "ta";

  const [activeTab, setActiveTab] = useState<"compare" | "optimizer" | "profile">("compare");

  // Tab 1: Comparison State
  const [ecoComparison, setEcoComparison] = useState<EcoTripComparison | null>(null);
  const [loadingCompare, setLoadingCompare] = useState<boolean>(false);

  // Tab 2: Pass Optimizer State
  const [distanceKm, setDistanceKm] = useState<number>(14);
  const [fareCash, setFareCash] = useState<number>(40);
  const [workingDays, setWorkingDays] = useState<number>(22);
  const [tripsPerDay, setTripsPerDay] = useState<number>(2);
  const [primaryMode, setPrimaryMode] = useState<string>("METRO");
  const [isFemale, setIsFemale] = useState<boolean>(false);
  const [optimizerResult, setOptimizerResult] = useState<CommuteOptimizerResponse | null>(null);
  const [loadingOptimizer, setLoadingOptimizer] = useState<boolean>(false);

  // Tab 3: Green Profile State
  const [greenProfile, setGreenProfile] = useState<GreenCommuterProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);

  // Derive distance from itinerary if passed
  useEffect(() => {
    if (selectedItinerary) {
      const totalMeters = selectedItinerary.legs.reduce((acc, l) => acc + (l.distance_meters || 0), 0);
      const computedKm = Math.max(1, Math.round((totalMeters / 1000) * 10) / 10);
      const fare = selectedItinerary.fare.cash_total || 30;
      setDistanceKm(computedKm);
      setFareCash(fare);

      // detect mode
      const hasMetro = selectedItinerary.legs.some((l) => l.mode === "METRO");
      const hasSuburban = selectedItinerary.legs.some((l) => l.mode === "SUBURBAN_RAIL" || l.mode === "RAIL");
      const hasBus = selectedItinerary.legs.some((l) => l.mode === "BUS");

      if (hasMetro && hasBus) setPrimaryMode("MULTIMODAL");
      else if (hasMetro) setPrimaryMode("METRO");
      else if (hasSuburban) setPrimaryMode("SUBURBAN_RAIL");
      else setPrimaryMode("BUS");
    }
  }, [selectedItinerary]);

  // Load Comparison
  const fetchComparison = async () => {
    setLoadingCompare(true);
    try {
      const mode = primaryMode || "TRANSIT";
      const fare = fareCash || 30;
      const data = await api.getEcoComparison(distanceKm, mode, fare);
      setEcoComparison(data);
    } catch (err) {
      console.error("Failed to fetch eco comparison:", err);
    } finally {
      setLoadingCompare(false);
    }
  };

  // Load Optimizer
  const fetchOptimizer = async () => {
    setLoadingOptimizer(true);
    try {
      const data = await api.optimizeCommutePasses({
        one_way_distance_km: distanceKm,
        one_way_fare_cash: fareCash,
        working_days_per_month: workingDays,
        trips_per_day: tripsPerDay,
        primary_mode: primaryMode,
        is_female: isFemale,
      });
      setOptimizerResult(data);
    } catch (err) {
      console.error("Failed to optimize commute passes:", err);
    } finally {
      setLoadingOptimizer(false);
    }
  };

  // Load Profile
  const fetchProfile = async () => {
    setLoadingProfile(true);
    try {
      const data = await api.getEcoProfile();
      setGreenProfile(data);
    } catch (err) {
      console.error("Failed to fetch green profile:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchComparison();
      fetchOptimizer();
      fetchProfile();
    }
  }, [isOpen, distanceKm, fareCash, primaryMode, workingDays, tripsPerDay, isFemale]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--bg-secondary, #111827)",
          border: "1px solid rgba(16, 185, 129, 0.4)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "780px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 24px rgba(16, 185, 129, 0.2)",
          color: "var(--text-primary, #F9FAFB)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, rgba(6, 78, 59, 0.5) 0%, rgba(17, 24, 39, 0.9) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "rgba(16, 185, 129, 0.2)",
                border: "1px solid rgba(16, 185, 129, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10B981",
              }}
            >
              <Leaf size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#ECFDF5", display: "flex", alignItems: "center", gap: "8px" }}>
                {t("eco.title", "Eco-Transit & Commute Pass Optimizer")}
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    backgroundColor: "rgba(16, 185, 129, 0.2)",
                    color: "#34D399",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                  }}
                >
                  Phase 14 &bull; Green Mobility
                </span>
              </h2>
              <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "2px 0 0 0" }}>
                {t("eco.subtitle", "Track your carbon footprint savings & unlock optimal Chennai commute passes")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "none",
              borderRadius: "8px",
              padding: "6px",
              color: "#9CA3AF",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            padding: "4px 16px",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("compare")}
            style={{
              background: activeTab === "compare" ? "rgba(16, 185, 129, 0.18)" : "transparent",
              border: activeTab === "compare" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid transparent",
              color: activeTab === "compare" ? "#34D399" : "#9CA3AF",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Leaf size={14} />
            {t("eco.tab_comparison", "Trip Carbon & Fuel Savings")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("optimizer")}
            style={{
              background: activeTab === "optimizer" ? "rgba(16, 185, 129, 0.18)" : "transparent",
              border: activeTab === "optimizer" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid transparent",
              color: activeTab === "optimizer" ? "#34D399" : "#9CA3AF",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <TrendingDown size={14} />
            {t("eco.tab_optimizer", "Monthly Pass Cost Optimizer")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            style={{
              background: activeTab === "profile" ? "rgba(16, 185, 129, 0.18)" : "transparent",
              border: activeTab === "profile" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid transparent",
              color: activeTab === "profile" ? "#34D399" : "#9CA3AF",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Award size={14} />
            {t("eco.tab_profile", "Green Commuter Badges")}
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {/* TAB 1: TRIP CARBON & FUEL SAVINGS */}
          {activeTab === "compare" && (
            <div>
              {loadingCompare ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#9CA3AF" }}>
                  <RefreshCw className="animate-spin" size={24} style={{ margin: "0 auto 8px" }} />
                  <p>Calculating carbon and fuel savings...</p>
                </div>
              ) : ecoComparison ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Top Highlight Metric Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                    {/* Carbon Saved */}
                    <div
                      style={{
                        backgroundColor: "rgba(6, 78, 59, 0.3)",
                        border: "1px solid rgba(16, 185, 129, 0.35)",
                        borderRadius: "12px",
                        padding: "14px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#34D399", marginBottom: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600 }}>{t("eco.co2_saved", "CO₂ Avoided")}</span>
                        <Leaf size={16} />
                      </div>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: "#ECFDF5" }}>
                        {ecoComparison.net_co2_saved_kg} <span style={{ fontSize: "14px", fontWeight: 600 }}>kg</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#6EE7B7", marginTop: "4px" }}>
                        vs {ecoComparison.car_co2_kg} kg if driving petrol car
                      </div>
                    </div>

                    {/* Fuel Saved */}
                    <div
                      style={{
                        backgroundColor: "rgba(30, 58, 138, 0.25)",
                        border: "1px solid rgba(59, 130, 246, 0.35)",
                        borderRadius: "12px",
                        padding: "14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#60A5FA", marginBottom: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600 }}>{t("eco.fuel_saved", "Petrol Saved")}</span>
                        <Fuel size={16} />
                      </div>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: "#EFF6FF" }}>
                        {ecoComparison.fuel_saved_liters} <span style={{ fontSize: "14px", fontWeight: 600 }}>Liters</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#93C5FD", marginTop: "4px" }}>
                        ~₹{ecoComparison.fuel_cost_saved_inr} petrol value preserved
                      </div>
                    </div>

                    {/* Trees Equivalent */}
                    <div
                      style={{
                        backgroundColor: "rgba(120, 53, 15, 0.25)",
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        borderRadius: "12px",
                        padding: "14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#FBBF24", marginBottom: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600 }}>{t("eco.tree_equivalent", "Tree-Days Equivalent")}</span>
                        <Trees size={16} />
                      </div>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: "#FFFBEB" }}>
                        {ecoComparison.tree_days_equivalent} <span style={{ fontSize: "14px", fontWeight: 600 }}>days</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#FDE68A", marginTop: "4px" }}>
                        Equal to 1 tree absorbing CO₂ for {ecoComparison.tree_days_equivalent} days
                      </div>
                    </div>
                  </div>

                  {/* Distance & Trip Context banner */}
                  <div
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      color: "#9CA3AF",
                    }}
                  >
                    <span>
                      Trip Distance: <strong style={{ color: "#E5E7EB" }}>{ecoComparison.distance_km} km</strong> &bull; Transit Fare: <strong style={{ color: "#34D399" }}>₹{ecoComparison.transit_cost_inr}</strong>
                    </span>
                    <span style={{ fontSize: "11px" }}>
                      Benchmark Petrol: <strong>₹{ecoComparison.petrol_price_benchmark}/L</strong> (Chennai)
                    </span>
                  </div>

                  {/* Mode-wise Breakdown Comparison Table */}
                  <div>
                    <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#D1D5DB", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {t("eco.mode_comparison", "Emissions & Cost Breakdown by Mode")}
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {ecoComparison.modes_breakdown.map((item, idx) => {
                        const isTransit = item.mode === "TRANSIT";
                        const maxCo2 = Math.max(...ecoComparison.modes_breakdown.map((m) => m.co2_grams));
                        const pctCo2 = Math.min(100, Math.round((item.co2_grams / maxCo2) * 100));

                        return (
                          <div
                            key={idx}
                            style={{
                              backgroundColor: isTransit ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.02)",
                              border: isTransit ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.06)",
                              borderRadius: "8px",
                              padding: "10px 12px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "13px", fontWeight: isTransit ? 700 : 500, color: isTransit ? "#34D399" : "#E5E7EB" }}>
                                  {item.name}
                                </span>
                                {isTransit && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 700,
                                      backgroundColor: "rgba(16, 185, 129, 0.3)",
                                      color: "#6EE7B7",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                    }}
                                  >
                                    Eco Choice 🌿
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px" }}>
                                <span style={{ color: "#9CA3AF" }}>
                                  CO₂: <strong style={{ color: isTransit ? "#34D399" : "#F87171" }}>{item.co2_grams}g</strong>
                                </span>
                                <span style={{ color: "#9CA3AF" }}>
                                  Cost: <strong style={{ color: isTransit ? "#34D399" : "#E5E7EB" }}>₹{item.cost_inr}</strong>
                                </span>
                              </div>
                            </div>

                            {/* Bar Chart Visual */}
                            <div style={{ height: "6px", backgroundColor: "rgba(255, 255, 255, 0.08)", borderRadius: "3px", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${Math.max(4, pctCo2)}%`,
                                  height: "100%",
                                  backgroundColor: isTransit ? "#10B981" : pctCo2 > 60 ? "#EF4444" : "#F59E0B",
                                  borderRadius: "3px",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p style={{ fontSize: "11px", color: "#6B7280", margin: "4px 0 0 0", fontStyle: "italic" }}>
                    <Info size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                    {t("eco.benchmark_note", "Calculated using ARAI / BEE emissions benchmarks and Chennai petrol benchmark ₹100.75/L.")}
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: MONTHLY COMMUTE PASS OPTIMIZER */}
          {activeTab === "optimizer" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Commute Parameters Form */}
              <div
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                  padding: "14px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                }}
              >
                {/* Distance Slider */}
                <div>
                  <label style={{ fontSize: "11px", color: "#9CA3AF", display: "flex", justifyContent: "space-between" }}>
                    <span>One-Way Distance</span>
                    <strong style={{ color: "#34D399" }}>{distanceKm} km</strong>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="45"
                    step="1"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#10B981", marginTop: "4px" }}
                  />
                </div>

                {/* Cash Fare Slider */}
                <div>
                  <label style={{ fontSize: "11px", color: "#9CA3AF", display: "flex", justifyContent: "space-between" }}>
                    <span>Single Cash Ticket</span>
                    <strong style={{ color: "#34D399" }}>₹{fareCash}</strong>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="80"
                    step="5"
                    value={fareCash}
                    onChange={(e) => setFareCash(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#10B981", marginTop: "4px" }}
                  />
                </div>

                {/* Working Days */}
                <div>
                  <label style={{ fontSize: "11px", color: "#9CA3AF", display: "flex", justifyContent: "space-between" }}>
                    <span>{t("eco.working_days", "Working Days / Mo")}</span>
                    <strong style={{ color: "#34D399" }}>{workingDays} days</strong>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="28"
                    step="1"
                    value={workingDays}
                    onChange={(e) => setWorkingDays(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#10B981", marginTop: "4px" }}
                  />
                </div>

                {/* Trips Per Day */}
                <div>
                  <label style={{ fontSize: "11px", color: "#9CA3AF", display: "block", marginBottom: "4px" }}>
                    {t("eco.trips_day", "Trips / Day")}
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {[1, 2, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setTripsPerDay(n)}
                        style={{
                          flex: 1,
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: tripsPerDay === n ? 700 : 500,
                          backgroundColor: tripsPerDay === n ? "rgba(16, 185, 129, 0.25)" : "rgba(255, 255, 255, 0.05)",
                          border: tripsPerDay === n ? "1px solid #10B981" : "1px solid rgba(255, 255, 255, 0.1)",
                          color: tripsPerDay === n ? "#34D399" : "#9CA3AF",
                          cursor: "pointer",
                        }}
                      >
                        {n} {n === 1 ? "trip" : "trips"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode Selector */}
                <div>
                  <label style={{ fontSize: "11px", color: "#9CA3AF", display: "block", marginBottom: "4px" }}>
                    Primary Mode
                  </label>
                  <select
                    value={primaryMode}
                    onChange={(e) => setPrimaryMode(e.target.value)}
                    style={{
                      width: "100%",
                      backgroundColor: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "6px",
                      color: "#E5E7EB",
                      padding: "5px 8px",
                      fontSize: "12px",
                    }}
                  >
                    <option value="METRO">Chennai Metro (CMRL)</option>
                    <option value="BUS">MTC Metropolitan Bus</option>
                    <option value="SUBURBAN_RAIL">Suburban EMU Rail</option>
                    <option value="MULTIMODAL">Multimodal (Metro + Bus)</option>
                  </select>
                </div>

                {/* Female Concession Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "14px" }}>
                  <input
                    type="checkbox"
                    id="female_concession"
                    checked={isFemale}
                    onChange={(e) => setIsFemale(e.target.checked)}
                    style={{ accentColor: "#EC4899", width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label htmlFor="female_concession" style={{ fontSize: "12px", color: "#F472B6", cursor: "pointer", fontWeight: 600 }}>
                    Women Free Bus (Vidiyal Payanam)
                  </label>
                </div>
              </div>

              {/* Optimizer Live Output */}
              {loadingOptimizer ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#9CA3AF" }}>
                  <RefreshCw className="animate-spin" size={20} style={{ margin: "0 auto 8px" }} />
                  <p>Calculating pass combinations...</p>
                </div>
              ) : optimizerResult ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Recommended Pass Banner */}
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(6, 78, 59, 0.5) 0%, rgba(16, 185, 129, 0.15) 100%)",
                      border: "1.5px solid #10B981",
                      borderRadius: "14px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          backgroundColor: "#10B981",
                          color: "#064E3B",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        🌟 Recommended Best Option
                      </span>
                      <span style={{ fontSize: "12px", color: "#6EE7B7", fontWeight: 600 }}>
                        Agency: {optimizerResult.best_pass.agency}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <h4 style={{ fontSize: "18px", fontWeight: 800, color: "#ECFDF5", margin: 0 }}>
                          {isTa ? optimizerResult.best_pass.name_ta : optimizerResult.best_pass.name_en}
                        </h4>
                        <p style={{ fontSize: "12px", color: "#A7F3D0", margin: "2px 0 0 0" }}>
                          {isTa ? optimizerResult.best_pass.description_ta : optimizerResult.best_pass.description_en}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "24px", fontWeight: 900, color: "#34D399" }}>
                          ₹{optimizerResult.best_pass.price_inr}
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#A7F3D0" }}> / month</span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#FDE68A", fontWeight: 700 }}>
                          Saves ₹{optimizerResult.max_savings_vs_cash}/mo vs cash tickets
                        </div>
                      </div>
                    </div>

                    {/* Annual & Eco Potentials */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "8px",
                        marginTop: "4px",
                        paddingTop: "10px",
                        borderTop: "1px solid rgba(16, 185, 129, 0.2)",
                      }}
                    >
                      <div style={{ fontSize: "11px" }}>
                        <span style={{ color: "#9CA3AF", display: "block" }}>Annual Savings:</span>
                        <strong style={{ color: "#34D399", fontSize: "13px" }}>₹{optimizerResult.annual_savings_potential} / year</strong>
                      </div>
                      <div style={{ fontSize: "11px" }}>
                        <span style={{ color: "#9CA3AF", display: "block" }}>Savings vs Driving Car:</span>
                        <strong style={{ color: "#F59E0B", fontSize: "13px" }}>₹{optimizerResult.max_savings_vs_car} / month</strong>
                      </div>
                      <div style={{ fontSize: "11px" }}>
                        <span style={{ color: "#9CA3AF", display: "block" }}>Monthly CO₂ Avoided:</span>
                        <strong style={{ color: "#60A5FA", fontSize: "13px" }}>{optimizerResult.monthly_co2_avoided_kg} kg CO₂</strong>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Pass Comparisons List */}
                  <div>
                    <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#D1D5DB", marginBottom: "8px", textTransform: "uppercase" }}>
                      Evaluated Chennai Commute Passes ({optimizerResult.total_trips_monthly} trips / {optimizerResult.total_monthly_km} km)
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {optimizerResult.monthly_passes_evaluated.map((pass: MonthlyPassOption, pIdx: number) => {
                        return (
                          <div
                            key={pIdx}
                            style={{
                              backgroundColor: pass.recommended ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.03)",
                              border: pass.recommended ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.08)",
                              borderRadius: "8px",
                              padding: "10px 14px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "13px", fontWeight: 700, color: "#E5E7EB" }}>
                                  {isTa ? pass.name_ta : pass.name_en}
                                </span>
                                <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", backgroundColor: "rgba(255, 255, 255, 0.08)", color: "#9CA3AF" }}>
                                  {pass.agency}
                                </span>
                                {pass.recommended && (
                                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#10B981" }}>
                                    ✓ Best Choice
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                                {isTa ? pass.description_ta : pass.description_en}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "15px", fontWeight: 800, color: "#ECFDF5" }}>
                                ₹{pass.price_inr}
                              </div>
                              {pass.monthly_savings_inr > 0 ? (
                                <div style={{ fontSize: "11px", color: "#34D399", fontWeight: 600 }}>
                                  Saves ₹{pass.monthly_savings_inr}
                                </div>
                              ) : (
                                <div style={{ fontSize: "10px", color: "#9CA3AF" }}>Baseline</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 3: GREEN COMMUTER BADGES & STATS */}
          {activeTab === "profile" && (
            <div>
              {loadingProfile ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#9CA3AF" }}>
                  <RefreshCw className="animate-spin" size={20} style={{ margin: "0 auto 8px" }} />
                  <p>Loading green commuter telemetry...</p>
                </div>
              ) : greenProfile ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Commuter Level Header Card */}
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 78, 59, 0.4) 100%)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      borderRadius: "14px",
                      padding: "18px",
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        backgroundColor: "rgba(16, 185, 129, 0.25)",
                        border: "2px solid #10B981",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#34D399",
                        flexShrink: 0,
                      }}
                    >
                      <Sparkles size={28} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#ECFDF5" }}>
                          {isTa ? greenProfile.badge_title_ta : greenProfile.badge_title_en}
                        </h3>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            backgroundColor: "rgba(16, 185, 129, 0.3)",
                            color: "#6EE7B7",
                            padding: "2px 8px",
                            borderRadius: "12px",
                          }}
                        >
                          {greenProfile.commuter_level}
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#A7F3D0", margin: "4px 0 0 0" }}>
                        You've unlocked <strong>{greenProfile.cleaner_air_points} Clean Air Points</strong> by choosing Chennai public transit!
                      </p>
                    </div>
                  </div>

                  {/* Lifetime Impact Metrics */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
                    <div style={{ backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "10px", padding: "12px" }}>
                      <span style={{ fontSize: "11px", color: "#9CA3AF", display: "block" }}>Lifetime CO₂ Avoided</span>
                      <strong style={{ fontSize: "18px", color: "#34D399", display: "block", marginTop: "4px" }}>
                        {greenProfile.lifetime_co2_saved_kg} kg
                      </strong>
                    </div>

                    <div style={{ backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "10px", padding: "12px" }}>
                      <span style={{ fontSize: "11px", color: "#9CA3AF", display: "block" }}>Petrol Saved</span>
                      <strong style={{ fontSize: "18px", color: "#60A5FA", display: "block", marginTop: "4px" }}>
                        {greenProfile.lifetime_fuel_saved_liters} L
                      </strong>
                    </div>

                    <div style={{ backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "10px", padding: "12px" }}>
                      <span style={{ fontSize: "11px", color: "#9CA3AF", display: "block" }}>Money Saved vs Car</span>
                      <strong style={{ fontSize: "18px", color: "#FBBF24", display: "block", marginTop: "4px" }}>
                        ₹{greenProfile.lifetime_rupees_saved}
                      </strong>
                    </div>

                    <div style={{ backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "10px", padding: "12px" }}>
                      <span style={{ fontSize: "11px", color: "#9CA3AF", display: "block" }}>Urban Tree Days</span>
                      <strong style={{ fontSize: "18px", color: "#A7F3D0", display: "block", marginTop: "4px" }}>
                        {greenProfile.urban_trees_equivalent} d
                      </strong>
                    </div>
                  </div>

                  {/* Milestone Badges Grid */}
                  <div>
                    <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#D1D5DB", marginBottom: "10px", textTransform: "uppercase" }}>
                      Chennai Green Commute Milestones
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                      {[
                        { title: "First Green Mile", desc: "First completed public transit trip in Chennai", icon: "🌱", unlocked: true },
                        { title: "Marina Eco Pioneer", desc: "Avoided > 25 kg of carbon emissions", icon: "🌊", unlocked: true },
                        { title: "Ripon Clean Air Champion", desc: "Avoided > 100 kg of carbon emissions", icon: "🏛️", unlocked: false },
                        { title: "Guindy Forest Guardian", desc: "Planted 500+ tree-days equivalent", icon: "🌳", unlocked: true },
                      ].map((badge, bIdx) => (
                        <div
                          key={bIdx}
                          style={{
                            backgroundColor: badge.unlocked ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.02)",
                            border: badge.unlocked ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 255, 255, 0.06)",
                            borderRadius: "10px",
                            padding: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            opacity: badge.unlocked ? 1 : 0.6,
                          }}
                        >
                          <span style={{ fontSize: "24px" }}>{badge.icon}</span>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: badge.unlocked ? "#ECFDF5" : "#9CA3AF", display: "flex", alignItems: "center", gap: "4px" }}>
                              {badge.title}
                              {badge.unlocked && <CheckCircle2 size={12} color="#10B981" />}
                            </div>
                            <div style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                              {badge.desc}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            fontSize: "12px",
          }}
        >
          <span style={{ color: "#9CA3AF" }}>
            Singara Chennai Green Mobility &bull; Zero Emissions Initiative
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 16px",
              backgroundColor: "#10B981",
              border: "none",
              borderRadius: "8px",
              color: "#064E3B",
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            {t("common.close", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
};
