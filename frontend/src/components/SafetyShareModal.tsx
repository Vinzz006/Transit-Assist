import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, Share2, PhoneCall, Copy, Check, MessageSquare, X } from "lucide-react";
import type { Itinerary } from "../types";

interface SafetyShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  itinerary: Itinerary | null;
  originName: string;
  destinationName: string;
}

const EMERGENCY_CONTACTS = [
  { nameKey: "safety.police", number: "100", icon: "👮", descKey: "safety.policeDesc" },
  { nameKey: "safety.womenHelpline", number: "1091", icon: "👩", descKey: "safety.womenDesc" },
  { nameKey: "safety.cmrlHelpline", number: "18604251515", display: "1860-425-1515", icon: "🚇", descKey: "safety.cmrlDesc" },
  { nameKey: "safety.mtcHelpline", number: "149", icon: "🚌", descKey: "safety.mtcDesc" },
  { nameKey: "safety.ambulance", number: "108", icon: "🚑", descKey: "safety.ambulanceDesc" },
];

export const SafetyShareModal: React.FC<SafetyShareModalProps> = ({
  isOpen,
  onClose,
  itinerary,
  originName,
  destinationName,
}) => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate localized share message
  const transitLegs = itinerary?.legs.filter((l) => l.leg_type === "TRANSIT") || [];
  const linesUsed = transitLegs.map((l) => l.route_short_name || l.route_id).join(", ") || "Public Transit";

  const shareText =
    i18n.language === "ta"
      ? `🚨 சென்னை பயண உதவி: நான் ${originName} இலிருந்து ${destinationName} வரை பயணிக்கிறேன்.\nதடம்: ${linesUsed}\nபுறப்பாடு: ${itinerary?.departure_time} | வருகை: ${itinerary?.arrival_time} (~${itinerary?.duration_minutes} நிமிடம்)\nகட்டணம்: ₹${itinerary?.fare.cash_total}\nஅவசர உதவி: மகளிர் உதவி 1091 | காவல் 100`
      : `🚨 Transit Assist Chennai: I am traveling from ${originName} to ${destinationName}.\nLines: ${linesUsed}\nDep: ${itinerary?.departure_time} | Arr: ${itinerary?.arrival_time} (~${itinerary?.duration_minutes} mins)\nFare: ₹${itinerary?.fare.cash_total}\nEmergency: Women Helpline 1091 | Police 100`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Transit Assist India — Journey Share",
          text: shareText,
        });
      } catch (err) {
        console.warn("Share cancelled or failed", err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content safety-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <ShieldAlert size={22} className="text-red" />
            <h3>{t("safety.title", "Commuter Safety & Trip Sharing")}</h3>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Trip Share Section */}
          {itinerary && (
            <div className="safety-section">
              <h4 className="section-subtitle">
                <Share2 size={16} /> {t("safety.shareTripTitle", "Share Trip Status with Family")}
              </h4>
              <div className="share-preview-box">
                <pre>{shareText}</pre>
              </div>
              <div className="share-btn-group">
                <button className="btn btn-whatsapp" onClick={handleWhatsApp}>
                  <MessageSquare size={16} /> {t("safety.shareWhatsapp", "WhatsApp")}
                </button>
                <button className="btn btn-primary" onClick={handleNativeShare}>
                  <Share2 size={16} /> {t("safety.shareDirect", "Share...")}
                </button>
                <button className="btn btn-secondary" onClick={handleCopy}>
                  {copied ? <Check size={16} className="text-green" /> : <Copy size={16} />}
                  {copied ? t("safety.copied", "Copied!") : t("safety.copyText", "Copy")}
                </button>
              </div>
            </div>
          )}

          {/* Emergency Helplines */}
          <div className="safety-section">
            <h4 className="section-subtitle">
              <PhoneCall size={16} /> {t("safety.helplinesTitle", "Chennai Emergency SOS Helplines")}
            </h4>
            <div className="emergency-contacts-list">
              {EMERGENCY_CONTACTS.map((c) => (
                <div key={c.number} className="emergency-card">
                  <div className="emergency-info">
                    <span className="emergency-icon">{c.icon}</span>
                    <div>
                      <div className="emergency-name">{t(c.nameKey, c.number)}</div>
                      <div className="emergency-desc">{t(c.descKey, "")}</div>
                    </div>
                  </div>
                  <a href={`tel:${c.number}`} className="btn-call">
                    <PhoneCall size={14} /> {c.display || c.number}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
