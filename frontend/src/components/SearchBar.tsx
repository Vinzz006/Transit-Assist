import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, MapPin, ArrowUpDown, Navigation, Mic, MicOff } from "lucide-react";
import type { StopDetail } from "../types";
import { api } from "../services/api";

interface SearchBarProps {
  onSearch: (params: {
    origin: { lat: number; lon: number; name: string };
    destination: { lat: number; lon: number; name: string };
    isFemale: boolean;
  }) => void;
  isFemalePref: boolean;
  onToggleFemale: (val: boolean) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isFemalePref,
  onToggleFemale,
}) => {
  const { t, i18n } = useTranslation();

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

      {/* Submit Button */}
      <button type="submit" className="btn-primary">
        <Search size={16} />
        {t("search.find_routes")}
      </button>
    </form>
  );
};
