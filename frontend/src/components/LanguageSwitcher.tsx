import React from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { cache } from "../services/cache";

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  const handleToggle = () => {
    const nextLang = currentLang === "en" ? "ta" : "en";
    i18n.changeLanguage(nextLang);
    cache.setPrefs({ language: nextLang });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-full)",
        padding: "5px 10px",
        color: "var(--text-primary)",
        fontSize: "0.78rem",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      title="Switch Language / மொழியை மாற்றுக"
    >
      <Globe size={14} color="var(--accent-blue)" />
      <span>{currentLang === "en" ? "தமிழ்" : "English"}</span>
    </button>
  );
};
