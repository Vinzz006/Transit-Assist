import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, MapPin, ArrowUpDown, Navigation, Mic, MicOff, Sun, CloudRain, CloudLightning } from "lucide-react";
import type { StopDetail } from "../types";
import { api } from "../services/api";

interface SearchBarProps {
  onSearch: (params: {
    origin: { lat: number; lon: number; name: string };
    destination: { lat: number; lon: number; name: string };
    isFemale: boolean;
    preference?: "fastest" | "fewest_transfers" | "least_walking" | "cheapest";
    weather?: "clear" | "rain" | "monsoon";
  }) => void;
  isFemalePref: boolean;
  onToggleFemale: (val: boolean) => void;
  currentPreference?: "fastest" | "fewest_transfers" | "least_walking" | "cheapest";
  onPreferenceChange?: (pref: "fastest" | "fewest_transfers" | "least_walking" | "cheapest") => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isFemalePref,
  onToggleFemale,
  currentPreference = "fastest",
  onPreferenceChange,
}) => {
  const { t, i18n } = useTranslation();
  const [preference, setPreference] = useState<"fastest" | "fewest_transfers" | "least_walking" | "cheapest">(currentPreference);
  const [weather, setWeather] = useState<"clear" | "rain" | "monsoon">("clear");

  const [originText, setOriginText] = useState("Chennai Central");
  const [originCoord, setOriginCoord] = useState<{ lat: number; lon: number; name: string } | null>({
    lat: 13.0827,
    lon: 80.2754,
    name: "Chennai Central",
  });

  const [destText, setDestText] = useState("Chennai Airport");
  const [destCoord, setDestCoord] = useState<{ lat: number; lon: number; name: string } | null>({
    lat: 12.9780,
    lon: 80.1640,
    name: "Chennai Airport",
  });

  const [originSuggestions, setOriginSuggestions] = useState<StopDetail[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<StopDetail[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<"origin" | "dest" | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isListening, setIsListening] = useState<"origin" | "dest" | null>(null);

  const startVoiceInput = (target: "origin" | "dest") => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(t("search.voiceNotSupported", "Voice speech recognition is not supported in this browser."));
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = i18n.language === "ta" ? "ta-IN" : "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListening(target);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (target === "origin") {
          setOriginText(transcript);
          setActiveDropdown("origin");
        } else {
          setDestText(transcript);
          setActiveDropdown("dest");
        }
        setIsListening(null);
      };

      recognition.onerror = () => {
        setIsListening(null);
      };

      recognition.onend = () => {
        setIsListening(null);
      };

      recognition.start();
    } catch (err) {
      console.warn("Speech recognition error", err);
      setIsListening(null);
    }
  };

  // Search autocomplete debouncer
  useEffect(() => {
    if (activeDropdown === "origin" && originText.length >= 2) {
      const timer = setTimeout(() => {
        api.searchStops(originText, 6).then(setOriginSuggestions).catch(() => {});
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setOriginSuggestions([]);
    }
  }, [originText, activeDropdown]);

  useEffect(() => {
    if (activeDropdown === "dest" && destText.length >= 2) {
      const timer = setTimeout(() => {
        api.searchStops(destText, 6).then(setDestSuggestions).catch(() => {});
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setDestSuggestions([]);
    }
  }, [destText, activeDropdown]);

  const handleSwap = () => {
    const tempText = originText;
    const tempCoord = originCoord;
    setOriginText(destText);
    setOriginCoord(destCoord);
    setDestText(tempText);
    setDestCoord(tempCoord);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingLocation(false);
        const coord = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          name: t("search.current_location"),
        };
        setOriginCoord(coord);
        setOriginText(t("search.current_location"));
      },
      (err) => {
        setIsDetectingLocation(false);
        console.warn("Location detection failed", err);
        alert("Unable to detect current GPS location.");
      },
      { timeout: 8000 }
    );
  };

  const handleQuickPreset = (preset: { name: string; lat: number; lon: number }, field: "origin" | "dest") => {
    if (field === "origin") {
      setOriginText(preset.name);
      setOriginCoord(preset);
      setActiveDropdown(null);
    } else {
      setDestText(preset.name);
      setDestCoord(preset);
      setActiveDropdown(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originCoord || !destCoord) {
      alert("Please select valid origin and destination locations from the suggestions.");
      return;
    }
    onSearch({
      origin: originCoord,
      destination: destCoord,
      isFemale: isFemalePref,
      preference,
      weather,
    });
  };

  const QUICK_HUBS = [
    { name: "Chennai Central", lat: 13.0827, lon: 80.2754 },
    { name: "Chennai Airport", lat: 12.9780, lon: 80.1640 },
    { name: "Koyambedu CMBT", lat: 13.0690, lon: 80.1940 },
    { name: "Tambaram", lat: 12.9249, lon: 80.1200 },
    { name: "T. Nagar", lat: 13.0402, lon: 80.2337 },
    { name: "Adyar Depot", lat: 12.9978, lon: 80.2562 },
  ];

  return (
    <form className="search-card" onSubmit={handleSubmit}>
      {/* Origin Input */}
      <div className="search-input-group">
        <MapPin className="input-icon" size={18} color="#10B981" />
        <input
          type="text"
          className="search-input"
          value={originText}
          placeholder={t("search.origin_placeholder")}
          onChange={(e) => {
            setOriginText(e.target.value);
            setActiveDropdown("origin");
          }}
          onFocus={() => setActiveDropdown("origin")}
        />
        <button
          type="button"
          className={`btn-mic ${isListening === "origin" ? "listening" : ""}`}
          onClick={() => startVoiceInput("origin")}
          title={t("search.voiceSearch", "Voice search")}
          aria-label="Voice search origin"
        >
          {isListening === "origin" ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        {activeDropdown === "origin" && originSuggestions.length > 0 && (
          <div className="autocomplete-dropdown">
            <div
              className="autocomplete-item"
              onClick={handleUseCurrentLocation}
              style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" }}
            >
              <Navigation size={14} color="#3B82F6" />
              <span className="autocomplete-name-en">
                {isDetectingLocation ? t("search.detecting_location") : t("search.current_location")}
              </span>
            </div>
            {originSuggestions.map((s) => (
              <div
                key={s.stop_id}
                className="autocomplete-item"
                onClick={() => {
                  setOriginText(s.stop_name);
                  setOriginCoord({ lat: s.stop_lat, lon: s.stop_lon, name: s.stop_name });
                  setActiveDropdown(null);
                }}
              >
                <span className="autocomplete-name-en">{s.stop_name_en || s.stop_name}</span>
                {s.stop_name_ta && <span className="autocomplete-name-ta">{s.stop_name_ta}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Swap Button */}
      <button type="button" className="search-swap-btn" onClick={handleSwap} title={t("search.swap")}>
        <ArrowUpDown size={14} />
      </button>

      {/* Destination Input */}
      <div className="search-input-group">
        <MapPin className="input-icon" size={18} color="#EF4444" />
        <input
          type="text"
          className="search-input"
          value={destText}
          placeholder={t("search.destination_placeholder")}
          onChange={(e) => {
            setDestText(e.target.value);
            setActiveDropdown("dest");
          }}
          onFocus={() => setActiveDropdown("dest")}
        />
        <button
          type="button"
          className={`btn-mic ${isListening === "dest" ? "listening" : ""}`}
          onClick={() => startVoiceInput("dest")}
          title={t("search.voiceSearch", "Voice search")}
          aria-label="Voice search destination"
        >
          {isListening === "dest" ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        {activeDropdown === "dest" && destSuggestions.length > 0 && (
          <div className="autocomplete-dropdown">
            {destSuggestions.map((s) => (
              <div
                key={s.stop_id}
                className="autocomplete-item"
                onClick={() => {
                  setDestText(s.stop_name);
                  setDestCoord({ lat: s.stop_lat, lon: s.stop_lon, name: s.stop_name });
                  setActiveDropdown(null);
                }}
              >
                <span className="autocomplete-name-en">{s.stop_name_en || s.stop_name}</span>
                {s.stop_name_ta && <span className="autocomplete-name-ta">{s.stop_name_ta}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Hub Presets */}
      <div className="quick-hubs">
        {QUICK_HUBS.map((h) => (
          <button
            key={h.name}
            type="button"
            className="hub-chip"
            onClick={() => handleQuickPreset(h, "dest")}
          >
            + {h.name}
          </button>
        ))}
      </div>

      {/* Vidiyal Payanam Toggle (Concession for Women) */}
      <div className="toggle-row">
        <span>{t("filters.women_fare_scheme")}</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={isFemalePref}
            onChange={(e) => onToggleFemale(e.target.checked)}
          />
          <span className="slider"></span>
        </label>
      </div>

      {/* Route Preference Selector */}
      <div className="preference-section" style={{ margin: "10px 0 14px 0" }}>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
          {t("preferences.title", "Route Preference")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
          {(["fastest", "fewest_transfers", "least_walking", "cheapest"] as const).map((pref) => (
            <button
              key={pref}
              type="button"
              className={`chip ${preference === pref ? "active" : ""}`}
              style={{
                fontSize: "11px",
                padding: "6px 2px",
                textAlign: "center",
                borderRadius: "var(--radius-sm)",
                border: preference === pref ? "1px solid var(--accent-blue)" : "1px solid var(--border-color)",
                backgroundColor: preference === pref ? "rgba(0, 102, 204, 0.15)" : "var(--bg-card)",
                color: preference === pref ? "var(--accent-blue)" : "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: preference === pref ? 600 : 400,
              }}
              onClick={() => {
                setPreference(pref);
                if (onPreferenceChange) onPreferenceChange(pref);
              }}
            >
              {t(`preferences.${pref}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Chennai Weather & Monsoon Delay Simulator */}
      <div className="weather-section" style={{ margin: "0 0 16px 0" }}>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
          <span>{t("weather.title", "Monsoon & Traffic Risk")}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
          {[
            { id: "clear", label: t("weather.clear", "Normal"), icon: <Sun size={12} color="#FBBF24" /> },
            { id: "rain", label: t("weather.rain", "Rain"), icon: <CloudRain size={12} color="#60A5FA" /> },
            { id: "monsoon", label: t("weather.monsoon", "Monsoon Alert"), icon: <CloudLightning size={12} color="#F87171" /> },
          ].map((w) => (
            <button
              key={w.id}
              type="button"
              className={`chip ${weather === w.id ? "active" : ""}`}
              style={{
                fontSize: "11px",
                padding: "6px 4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                borderRadius: "var(--radius-sm)",
                border: weather === w.id ? (w.id === "monsoon" ? "1px solid #EF4444" : "1px solid var(--accent-blue)") : "1px solid var(--border-color)",
                backgroundColor: weather === w.id ? (w.id === "monsoon" ? "rgba(239, 68, 68, 0.18)" : "rgba(0, 102, 204, 0.15)") : "var(--bg-card)",
                color: weather === w.id ? (w.id === "monsoon" ? "#EF4444" : "var(--accent-blue)") : "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: weather === w.id ? 700 : 400,
              }}
              onClick={() => setWeather(w.id as any)}
            >
              {w.icon}
              <span>{w.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <button type="submit" className="btn-primary">
        <Search size={16} />
        {t("search.find_routes")}
      </button>
    </form>
  );
};
