import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, Clock, AlertTriangle, CheckCircle, X, Send } from "lucide-react";
import { api } from "../services/api";

interface CrowdReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRouteId?: string;
  defaultRouteName?: string;
  onReportSubmitted?: () => void;
}

export const CrowdReportModal: React.FC<CrowdReportModalProps> = ({
  isOpen,
  onClose,
  defaultRouteId = "CMRL_BLUE",
  defaultRouteName = "Blue Line",
  onReportSubmitted,
}) => {
  const { t } = useTranslation();

  const [crowdLevel, setCrowdLevel] = useState<"low" | "moderate" | "packed">("moderate");
  const [delayMinutes, setDelayMinutes] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      await api.submitReport({
        route_id: defaultRouteId,
        crowd_level: crowdLevel,
        delay_minutes: delayMinutes,
        comment: comment.trim() || undefined,
      });

      setSubmitting(false);
      setSubmitted(true);
      if (onReportSubmitted) onReportSubmitted();
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(err.message || "Failed to submit report");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content report-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <Users size={22} className="text-amber" />
            <h3>{t("report.title", "Report Crowding & Delays")}</h3>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="report-success-state">
            <CheckCircle size={48} className="text-green" />
            <h4>{t("report.thankYou", "Thank you for reporting!")}</h4>
            <p>{t("report.successMsg", "Your feedback helps fellow Chennai commuters plan their journey.")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-body">
            <div className="report-line-pill">
              <span>{t("report.reportingFor", "Reporting line:")}</span>
              <strong>{defaultRouteName}</strong>
            </div>

            {/* Crowd Level Selection */}
            <div className="form-group">
              <label className="form-label">{t("report.crowdLevelLabel", "Current Crowding Level:")}</label>
              <div className="crowd-level-options">
                <button
                  type="button"
                  className={`crowd-option-btn ${crowdLevel === "low" ? "selected low" : ""}`}
                  onClick={() => setCrowdLevel("low")}
                >
                  <span className="crowd-indicator green" />
                  <span className="crowd-title">{t("report.crowdLow", "Seats Available")}</span>
                </button>

                <button
                  type="button"
                  className={`crowd-option-btn ${crowdLevel === "moderate" ? "selected moderate" : ""}`}
                  onClick={() => setCrowdLevel("moderate")}
                >
                  <span className="crowd-indicator yellow" />
                  <span className="crowd-title">{t("report.crowdModerate", "Standing Room Only")}</span>
                </button>

                <button
                  type="button"
                  className={`crowd-option-btn ${crowdLevel === "packed" ? "selected packed" : ""}`}
                  onClick={() => setCrowdLevel("packed")}
                >
                  <span className="crowd-indicator red" />
                  <span className="crowd-title">{t("report.crowdPacked", "Heavily Crowded")}</span>
                </button>
              </div>
            </div>

            {/* Delay Selection */}
            <div className="form-group">
              <label className="form-label">
                <Clock size={16} /> {t("report.delayLabel", "Service Delay (Minutes):")}
              </label>
              <div className="delay-chips">
                {[0, 5, 10, 15, 20, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className={`chip ${delayMinutes === mins ? "active" : ""}`}
                    onClick={() => setDelayMinutes(mins)}
                  >
                    {mins === 0 ? t("report.onTime", "On Time") : `+${mins} min`}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Comment */}
            <div className="form-group">
              <label className="form-label">{t("report.commentLabel", "Additional details (optional):")}</label>
              <input
                type="text"
                className="input-text"
                maxLength={100}
                placeholder={t("report.commentPlaceholder", "e.g., Heavy rush at Central platform")}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            {errorMsg && (
              <div className="error-banner">
                <AlertTriangle size={16} /> {errorMsg}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {t("common.cancel", "Cancel")}
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Send size={16} />
                {submitting ? t("report.submitting", "Submitting...") : t("report.submitBtn", "Submit Report")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
