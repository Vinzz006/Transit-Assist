import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Navigation,
  Footprints,
  Train,
  Bus,
  Car,
  Clock,
  Sparkles,
  Award,
  CreditCard,
  FastForward,
} from "lucide-react";
import type { Itinerary, TransitLeg } from "../types";
import { api } from "../services/api";

interface LiveNavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  itinerary: Itinerary | null;
  onTripCompleted?: (fare: number, itinerary: Itinerary) => void;
  onOpenWallet?: () => void;
}

export const LiveNavigationModal: React.FC<LiveNavigationModalProps> = ({
  isOpen,
  onClose,
  itinerary,
  onTripCompleted,
  onOpenWallet,
}) => {
  const { t } = useTranslation();
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [alarmFired, setAlarmFired] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [fareDeducted, setFareDeducted] = useState(false);

  // Audio Context for chime & alarm
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playTone = (freq: number, duration: number, type: OscillatorType = "sine") => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio not permitted
    }
  };

  const playChime = () => {
    playTone(587.33, 0.2); // D5
    setTimeout(() => playTone(880, 0.4), 200); // A5
  };

  const playAlarmTone = () => {
    playTone(880, 0.2, "sawtooth");
    setTimeout(() => playTone(987.77, 0.3, "sawtooth"), 200);
    setTimeout(() => playTone(1174.66, 0.4, "sawtooth"), 450);
  };

  // Web Speech API Voice Announcement
  const speakStop = (stopName: string, isFinal: boolean = false) => {
    if (!voiceEnabled || !window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Stop prior speech

    const announcementEn = isFinal
      ? `Approaching final destination: ${stopName}. Please prepare to alight.`
      : `Next stop: ${stopName}.`;

    const utterance = new SpeechSynthesisUtterance(announcementEn);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Pick Indian English or English voice if available
    const voices = window.speechSynthesis.getVoices();
    const indVoice = voices.find((v) => v.lang.includes("en-IN") || v.lang.includes("ta"));
    if (indVoice) utterance.voice = indVoice;

    window.speechSynthesis.speak(utterance);
  };

  // Reset state on modal open
  useEffect(() => {
    if (isOpen) {
      setCurrentLegIndex(0);
      setCurrentStopIndex(0);
      setAlarmFired(false);
      setIsCompleted(false);
      setFareDeducted(false);
    }
  }, [isOpen, itinerary]);

  if (!isOpen || !itinerary) return null;

  const legs = itinerary.legs || [];
  const originName = itinerary.origin_name || legs[0]?.from_stop_name || "Origin";
  const destinationName = itinerary.destination_name || legs[legs.length - 1]?.to_stop_name || "Destination";
  const currentLeg: TransitLeg | undefined = legs[currentLegIndex];
  const intermediateStops = currentLeg?.intermediate_stops || [];

  // Intermediate stops sequence including departure and arrival
  const stopSequence = currentLeg
    ? [
        { stop_id: currentLeg.from_stop_id, stop_name: currentLeg.from_stop_name },
        ...intermediateStops,
        { stop_id: currentLeg.to_stop_id, stop_name: currentLeg.to_stop_name },
      ]
    : [];

  const currentStop = stopSequence[currentStopIndex] || { stop_name: currentLeg?.from_stop_name || "" };
  const nextStop = stopSequence[currentStopIndex + 1];
  const isFinalLeg = currentLegIndex === legs.length - 1;

  const getModeIcon = (mode?: string) => {
    if (mode === "AUTO" || mode === "TAXI") return <Car size={18} />;
    if (mode === "METRO" || mode === "SUBURBAN_RAIL" || mode === "RAIL") return <Train size={18} />;
    if (mode === "BUS") return <Bus size={18} />;
    return <Footprints size={18} />;
  };

  const handleNextStep = () => {
    playChime();

    // If within current leg stops
    if (currentStopIndex < stopSequence.length - 2) {
      const nextIndex = currentStopIndex + 1;
      setCurrentStopIndex(nextIndex);
      const upcoming = stopSequence[nextIndex + 1] || stopSequence[nextIndex];
      speakStop(upcoming.stop_name, isFinalLeg && nextIndex >= stopSequence.length - 2);

      // Check if 1 stop before final stop
      if (isFinalLeg && nextIndex >= stopSequence.length - 2 && alarmEnabled && !alarmFired) {
        setAlarmFired(true);
        playAlarmTone();
      }
    } else if (currentLegIndex < legs.length - 1) {
      // Advance to next leg
      const nextLegIdx = currentLegIndex + 1;
      setCurrentLegIndex(nextLegIdx);
      setCurrentStopIndex(0);
      const nextLeg = legs[nextLegIdx];
      speakStop(`Transfer to ${nextLeg.mode} Line ${nextLeg.route_short_name || ""}`);
    } else {
      // Trip completed!
      setIsCompleted(true);
      playAlarmTone();
      speakStop(currentLeg.to_stop_name, true);
    }
  };

  const handleDeductAndComplete = async () => {
    try {
      const fareToPay = itinerary.fare.smartcard_total || itinerary.fare.cash_total || 0;
      if (fareToPay > 0) {
        await api.deductFare(
          fareToPay,
          `Transit Journey: ${originName} to ${destinationName} (20% NCMC Smartcard discount)`,
          currentLeg?.mode || "TRANSIT",
          currentLeg?.route_short_name
        );
      }
      setFareDeducted(true);
      if (onTripCompleted) {
        onTripCompleted(fareToPay, itinerary);
      }
    } catch {
      setFareDeducted(true);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
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
          backgroundColor: "#0B1120",
          border: "1px solid rgba(6, 182, 212, 0.3)",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 25px 70px -15px rgba(0, 0, 0, 0.8), 0 0 50px rgba(6, 182, 212, 0.2)",
          color: "#F8FAFC",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top App Bar */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, rgba(6, 182, 212, 0.15) 0%, rgba(15, 23, 42, 0) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "#06B6D4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 0 15px rgba(6, 182, 212, 0.5)",
              }}
            >
              <Navigation size={18} />
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.3px" }}>
                {t("nav.live_title", "Live Turn-by-Turn Transit HUD")}
              </div>
              <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                Leg {currentLegIndex + 1} of {legs.length} • {itinerary.duration_minutes} min journey
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Audio Toggle */}
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              style={{
                background: voiceEnabled ? "rgba(6, 182, 212, 0.2)" : "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: voiceEnabled ? "#67E8F9" : "#94A3B8",
                borderRadius: "8px",
                padding: "6px 8px",
                cursor: "pointer",
              }}
              title={voiceEnabled ? "Voice Mute" : "Voice Unmute"}
            >
              {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            {/* Stop Alarm Toggle */}
            <button
              onClick={() => setAlarmEnabled(!alarmEnabled)}
              style={{
                background: alarmEnabled ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: alarmEnabled ? "#FBBF24" : "#94A3B8",
                borderRadius: "8px",
                padding: "6px 8px",
                cursor: "pointer",
              }}
              title={alarmEnabled ? "Wake Me Up Alarm Active" : "Alarm Off"}
            >
              {alarmEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            </button>

            <button
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "none",
                color: "#94A3B8",
                cursor: "pointer",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Alarm Banner if Triggered */}
        {alarmFired && !isCompleted && (
          <div
            style={{
              padding: "12px 20px",
              backgroundColor: "rgba(239, 68, 68, 0.25)",
              borderBottom: "1px solid rgba(239, 68, 68, 0.5)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              animation: "pulse 1.5s infinite",
            }}
          >
            <Bell size={20} color="#F87171" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#FCA5A5" }}>
                🔔 WAKE UP: APPROACHING YOUR DESTINATION!
              </div>
              <div style={{ fontSize: "11px", color: "#FEE2E2" }}>
                Next stop is your alight point: {currentLeg?.to_stop_name}. Gather your belongings!
              </div>
            </div>
            <button
              onClick={() => setAlarmFired(false)}
              style={{
                padding: "4px 10px",
                backgroundColor: "#EF4444",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Navigation HUD Content */}
        {!isCompleted ? (
          <div style={{ padding: "20px 24px" }}>
            {/* Active Leg Summary Card */}
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "16px",
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    backgroundColor:
                      currentLeg?.mode === "METRO"
                        ? "#0284C7"
                        : currentLeg?.mode === "BUS"
                        ? "#16A34A"
                        : currentLeg?.mode === "SUBURBAN_RAIL"
                        ? "#9333EA"
                        : "#475569",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                  }}
                >
                  {getModeIcon(currentLeg?.mode)}
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>
                    {currentLeg?.mode === "WALK" ? "Walking Transfer" : `Board ${currentLeg?.mode}`}
                  </div>
                  <div style={{ fontSize: "17px", fontWeight: 800, color: "#FFFFFF" }}>
                    {currentLeg?.route_short_name ? `Line ${currentLeg.route_short_name}` : "Walk on Foot"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#CBD5E1" }}>
                    Towards {currentLeg?.to_stop_name}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#38BDF8" }}>
                  {currentLeg?.duration_minutes} min
                </div>
                <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                  {currentLeg?.distance_meters ? `${Math.round(currentLeg.distance_meters)}m` : ""}
                </div>
              </div>
            </div>

            {/* Next Stop Display Box */}
            <div
              style={{
                borderRadius: "18px",
                padding: "20px 22px",
                background: "linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)",
                border: "1px solid rgba(6, 182, 212, 0.35)",
                marginBottom: "20px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "1.5px", color: "#67E8F9", textTransform: "uppercase", marginBottom: "6px" }}>
                {nextStop ? "UPCOMING STOP / அடுத்த நிறுத்தம்" : "FINAL DESTINATION / சேரும் இடம்"}
              </div>

              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "#FFFFFF",
                  letterSpacing: "-0.5px",
                  marginBottom: "4px",
                }}
              >
                {nextStop ? nextStop.stop_name : currentLeg?.to_stop_name}
              </div>

              <div style={{ fontSize: "13px", color: "#94A3B8", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <Clock size={14} color="#34D399" />
                <span>Current Stop: {currentStop.stop_name}</span>
              </div>
            </div>

            {/* Intermediate Stops Visual Stepper */}
            {stopSequence.length > 2 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#94A3B8", marginBottom: "8px", textTransform: "uppercase" }}>
                  Route Progression ({stopSequence.length - 1 - currentStopIndex} stops remaining)
                </div>
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    maxHeight: "130px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {stopSequence.map((st, idx) => {
                    const isPassed = idx < currentStopIndex;
                    const isCurrent = idx === currentStopIndex;
                    const isNext = idx === currentStopIndex + 1;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          fontSize: "12px",
                          color: isCurrent ? "#38BDF8" : isNext ? "#34D399" : isPassed ? "#64748B" : "#94A3B8",
                          fontWeight: isCurrent || isNext ? 700 : 400,
                        }}
                      >
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: isCurrent ? "#38BDF8" : isNext ? "#34D399" : isPassed ? "#334155" : "#64748B",
                          }}
                        />
                        <span>{st.stop_name}</span>
                        {isCurrent && <span style={{ fontSize: "10px", color: "#38BDF8" }}>(Here)</span>}
                        {isNext && <span style={{ fontSize: "10px", color: "#34D399" }}>(Next)</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stepper Buttons for Commuter / Simulation */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleNextStep}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "14px",
                  border: "none",
                  background: "linear-gradient(135deg, #06B6D4 0%, #10B981 100%)",
                  color: "#FFFFFF",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 6px 20px rgba(6, 182, 212, 0.4)",
                }}
              >
                <FastForward size={18} />
                <span>Simulate Next Stop / Transfer</span>
              </button>
            </div>
          </div>
        ) : (
          /* Trip Completed Celebration Screen */
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                border: "2px solid #10B981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                color: "#10B981",
                boxShadow: "0 0 30px rgba(16, 185, 129, 0.4)",
              }}
            >
              <Award size={36} />
            </div>

            <div style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", marginBottom: "6px" }}>
              Destination Reached! 🎉
            </div>
            <div style={{ fontSize: "14px", color: "#94A3B8", marginBottom: "22px" }}>
              You have arrived at <strong>{destinationName}</strong>.
            </div>

            {/* Green Eco Stats & Trip Summary */}
            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "16px",
                padding: "18px 20px",
                marginBottom: "24px",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", paddingBottom: "10px" }}>
                <span style={{ color: "#94A3B8", fontSize: "13px" }}>Duration:</span>
                <strong style={{ color: "#FFFFFF", fontSize: "14px" }}>{itinerary.duration_minutes} mins</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", paddingBottom: "10px" }}>
                <span style={{ color: "#94A3B8", fontSize: "13px" }}>Transit Fare:</span>
                <strong style={{ color: "#34D399", fontSize: "14px" }}>
                  ₹{itinerary.fare.smartcard_total || itinerary.fare.cash_total} (20% NCMC Smartcard discount)
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#6EE7B7", fontSize: "13px" }}>
                  <Sparkles size={16} color="#10B981" />
                  <span>Eco-Commute Savings:</span>
                </div>
                <strong style={{ color: "#10B981", fontSize: "13px" }}>~1.8 kg CO₂ Saved 🌿</strong>
              </div>
            </div>

            {/* Smartcard Tap-and-Pay Deduction */}
            {!fareDeducted ? (
              <button
                onClick={handleDeductAndComplete}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "14px",
                  border: "none",
                  background: "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
                  color: "#FFFFFF",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 6px 20px rgba(16, 185, 129, 0.4)",
                  marginBottom: "12px",
                }}
              >
                <CreditCard size={18} />
                <span>Tap & Pay Fare (₹{itinerary.fare.smartcard_total || itinerary.fare.cash_total}) via Singara Chennai Card</span>
              </button>
            ) : (
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "10px",
                  color: "#A7F3D0",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "14px",
                }}
              >
                ✓ Fare paid and receipt logged in your NCMC Transit Wallet.
              </div>
            )}

            {onOpenWallet && (
              <button
                onClick={onOpenWallet}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "12px",
                  border: "1px solid rgba(6, 182, 212, 0.4)",
                  backgroundColor: "rgba(6, 182, 212, 0.12)",
                  color: "#67E8F9",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  marginBottom: "8px",
                }}
              >
                <CreditCard size={14} />
                <span>View Transit Wallet & Pass Ledger</span>
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                color: "#E2E8F0",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Exit Navigation HUD
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
