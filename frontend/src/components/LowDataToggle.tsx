import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Wifi, WifiOff, Zap } from "lucide-react";
import { cache } from "../services/cache";

interface LowDataToggleProps {
  lowDataMode: boolean;
  onToggle: (val: boolean) => void;
}

export const LowDataToggle: React.FC<LowDataToggleProps> = ({ lowDataMode, onToggle }) => {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-md)",
        fontSize: "0.78rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {isOnline ? (
          <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#10B981" }}>
            <Wifi size={13} /> {t("filters.online_status")}
          </span>
        ) : (
          <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#EF4444" }}>
            <WifiOff size={13} /> {t("filters.offline_status")}
          </span>
        )}
        <span style={{ color: "var(--text-muted)" }}>&bull;</span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-secondary)" }}>
          <Zap size={13} color="var(--accent-amber)" />
          {t("filters.low_data_mode")}
        </span>
      </div>

      <label className="switch">
        <input
          type="checkbox"
          checked={lowDataMode}
          onChange={(e) => {
            const val = e.target.checked;
            onToggle(val);
            cache.setPrefs({ lowDataMode: val });
          }}
        />
        <span className="slider"></span>
      </label>
    </div>
  );
};
