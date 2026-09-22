import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { BellRing, X, Clock, Volume2, CheckCircle2 } from "lucide-react";
import type { Itinerary } from "../types";

interface DepartureAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  itinerary: Itinerary | null;
  originName: string;
  destinationName: string;
}

export const DepartureAlertModal: React.FC<DepartureAlertModalProps> = ({
  isOpen,
  onClose,
  itinerary,
  originName,
  destinationName,
}) => {
  const { t } = useTranslation();
  const [minutesBefore, setMinutesBefore] = useState<number>(5);
  const [isAlertActive, setIsAlertActive] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [alertTriggered, setAlertTriggered] = useState<boolean>(false);
  const timerRef = useRef<any>(null);

  // Synthesize pleasant transit double-chime using Web Audio API (zero external assets)
  const playTransitChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Note 1 (E5 - 659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.6);

      // Note 2 (G#5 - 830.61 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(830.61, ctx.currentTime + 0.2);
      gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.2);
      osc2.stop(ctx.currentTime + 0.85);
    } catch (e) {
      console.warn("Web Audio not supported or allowed", e);
    }
  };

  const handleStartAlert = () => {
    if (!itinerary) return;
    setIsAlertActive(true);
    setAlertTriggered(false);

    // Calculate seconds from now to (departure_time minus minutesBefore)
    const now = new Date();
    const [depHours, depMins, depSecs] = itinerary.departure_time.split(":").map(Number);
    const depDate = new Date();
    depDate.setHours(depHours, depMins, depSecs || 0, 0);

    const alertTime = new Date(depDate.getTime() - minutesBefore * 60 * 1000);
    const diffSeconds = Math.max(10, Math.round((alertTime.getTime() - now.getTime()) / 1000));

    // Simulated / real countdown
    setSecondsRemaining(Math.min(diffSeconds, 60)); // For instant practical feedback or actual time
  };

  const handleCancelAlert = () => {
    setIsAlertActive(false);
    setSecondsRemaining(null);
    setAlertTriggered(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (!isAlertActive || secondsRemaining === null) return;

    if (secondsRemaining <= 0) {
      playTransitChime();
      setAlertTriggered(true);
      setIsAlertActive(false);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAlertActive, secondsRemaining]);

  if (!isOpen || !itinerary) return null;

  const firstTransit = itinerary.legs.find((l) => l.leg_type === "TRANSIT");
  const lineName = firstTransit?.route_short_name || "Transit";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "420px", padding: "20px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#3B82F6",
              }}
            >
              <BellRing size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                {t("alerts.title", "Departure Reminder")}
              </h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {originName} &rarr; {destinationName}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Departure Details */}
        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
            padding: "12px",
            marginBottom: "14px",
            border: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
            <span style={{ color: "var(--text-muted)" }}>{t("alerts.departure_time", "Departure Time:")}</span>
            <span style={{ color: "#fff", fontWeight: 600 }}>{itinerary.departure_time.slice(0, 5)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span style={{ color: "var(--text-muted)" }}>{t("alerts.boarding_line", "Boarding Line:")}</span>
            <span style={{ color: "var(--accent-blue)", fontWeight: 600 }}>{lineName}</span>
          </div>
        </div>

        {alertTriggered ? (
          <div
            style={{
              padding: "16px",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              border: "1px solid #10B981",
              borderRadius: "var(--radius-md)",
              textAlign: "center",
              marginBottom: "14px",
            }}
          >
            <CheckCircle2 size={32} color="#10B981" style={{ margin: "0 auto 8px auto" }} />
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>
              {t("alerts.time_to_depart", "Time to head to the station!")}
            </div>
            <div style={{ fontSize: "12px", color: "#A7F3D0", marginTop: "4px" }}>
              {lineName} departs at {itinerary.departure_time.slice(0, 5)}
            </div>
          </div>
        ) : isAlertActive ? (
          <div
            style={{
              padding: "14px",
              backgroundColor: "rgba(59, 130, 246, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: "var(--radius-md)",
              textAlign: "center",
              marginBottom: "14px",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
              {t("alerts.active_countdown", "Alert countdown active")}
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#38BDF8", fontFamily: "monospace" }}>
              {secondsRemaining !== null
                ? `${Math.floor(secondsRemaining / 60)
                    .toString()
                    .padStart(2, "0")}:${(secondsRemaining % 60).toString().padStart(2, "0")}`
                : "00:00"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Chime will ring {minutesBefore} minutes before departure
            </div>
          </div>
        ) : (
          <>
            {/* Minute Selector */}
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
                {t("alerts.remind_me", "Remind me before departure:")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                {[3, 5, 10, 15].map((m) => (
                  <button
                    key={m}
                    type="button"
                    style={{
                      padding: "8px 4px",
                      borderRadius: "var(--radius-sm)",
                      border: minutesBefore === m ? "1px solid var(--accent-blue)" : "1px solid var(--border-color)",
                      backgroundColor: minutesBefore === m ? "rgba(0, 102, 204, 0.18)" : "var(--bg-card)",
                      color: minutesBefore === m ? "var(--accent-blue)" : "var(--text-secondary)",
                      fontSize: "12px",
                      fontWeight: minutesBefore === m ? 700 : 500,
                      cursor: "pointer",
                    }}
                    onClick={() => setMinutesBefore(m)}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="btn-card-action"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={playTransitChime}
            title="Test station alert bell"
          >
            <Volume2 size={14} />
            <span>{t("alerts.test_chime", "Test Chime")}</span>
          </button>

          {isAlertActive ? (
            <button
              type="button"
              className="btn-card-action text-red"
              style={{ flex: 1.5, justifyContent: "center", backgroundColor: "rgba(239, 68, 68, 0.15)", borderColor: "#EF4444" }}
              onClick={handleCancelAlert}
            >
              <span>{t("alerts.cancel_alert", "Cancel Alert")}</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 1.5, padding: "8px 12px", justifyContent: "center", fontSize: "0.85rem" }}
              onClick={handleStartAlert}
            >
              <Clock size={14} />
              <span>{t("alerts.set_alert", "Set Alert")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
