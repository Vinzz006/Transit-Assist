import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, Map as MapIcon, Train, Bus, Footprints } from "lucide-react";
import type { Itinerary, StopBase } from "../types";

interface MapViewProps {
  origin?: { lat: number; lon: number; name?: string } | null;
  destination?: { lat: number; lon: number; name?: string } | null;
  selectedItinerary?: Itinerary | null;
  nearbyStops?: StopBase[];
  onSelectStop?: (stop: StopBase) => void;
  lowDataMode?: boolean;
}

const DEFAULT_CENTER: [number, number] = [80.2754, 13.0827];
const DEFAULT_ZOOM = 12;

export const MapView: React.FC<MapViewProps> = ({
  origin,
  destination,
  selectedItinerary,
  nearbyStops = [],
  onSelectStop,
  lowDataMode = false,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [showSchematic, setShowSchematic] = useState(false);

  // Automatically suggest schematic in low-data mode if requested
  useEffect(() => {
    if (lowDataMode) {
      setShowSchematic(true);
    } else {
      setShowSchematic(false);
    }
  }, [lowDataMode]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "carto-dark": {
            type: "raster",
            tiles: [
              "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
        },
        layers: [
          {
            id: "carto-dark-tiles",
            type: "raster",
            source: "carto-dark",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const clearMarkers = () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    clearMarkers();

    // 1. Origin Marker
    if (origin) {
      const el = document.createElement("div");
      el.className = "origin-marker";
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#10B981";
      el.style.border = "3px solid #FFFFFF";
      el.style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.8)";

      const m = new maplibregl.Marker({ element: el })
        .setLngLat([origin.lon, origin.lat])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setText(origin.name || "Origin"))
        .addTo(map);
      markersRef.current.push(m);
    }

    // 2. Destination Marker
    if (destination) {
      const el = document.createElement("div");
      el.className = "dest-marker";
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#EF4444";
      el.style.border = "3px solid #FFFFFF";
      el.style.boxShadow = "0 0 10px rgba(239, 68, 68, 0.8)";

      const m = new maplibregl.Marker({ element: el })
        .setLngLat([destination.lon, destination.lat])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setText(destination.name || "Destination"))
        .addTo(map);
      markersRef.current.push(m);
    }

    // 3. Nearby Stops Markers
    if (!selectedItinerary && nearbyStops.length > 0) {
      nearbyStops.forEach((s) => {
        const el = document.createElement("div");
        el.className = "stop-marker";
        el.style.width = "12px";
        el.style.height = "12px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#3B82F6";
        el.style.border = "2px solid #FFFFFF";
        el.style.cursor = "pointer";

        const popup = new maplibregl.Popup({ offset: 8 }).setHTML(
          `<strong>${s.stop_name}</strong><br/><span style="color:#94A3B8; font-size:11px;">${s.distance_meters ? Math.round(s.distance_meters) + "m away" : ""}</span>`
        );

        const m = new maplibregl.Marker({ element: el })
          .setLngLat([s.stop_lon, s.stop_lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("click", () => {
          if (onSelectStop) onSelectStop(s);
        });

        markersRef.current.push(m);
      });
    }

    // 4. Draw Itinerary Polylines
    if (map.isStyleLoaded()) {
      drawItinerary(map, selectedItinerary);
    } else {
      map.once("load", () => drawItinerary(map, selectedItinerary));
    }
  }, [origin, destination, selectedItinerary, nearbyStops]);

  const drawItinerary = (map: maplibregl.Map, itinerary?: Itinerary | null) => {
    // Clean old layers
    for (let i = 0; i < 20; i++) {
      const sId = `route-leg-${i}`;
      if (map.getLayer(sId)) map.removeLayer(sId);
      if (map.getSource(sId)) map.removeSource(sId);
    }

    if (!itinerary) return;

    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;

    itinerary.legs.forEach((leg, idx) => {
      const sourceId = `route-leg-${idx}`;
      const coordinates: [number, number][] = leg.polyline.map((p) => [p[1], p[0]]);
      if (coordinates.length === 0) {
        coordinates.push([leg.from_stop_lon, leg.from_stop_lat]);
        coordinates.push([leg.to_stop_lon, leg.to_stop_lat]);
      }

      coordinates.forEach((c) => {
        bounds.extend(c);
        hasCoords = true;
      });

      let lineColor = "#64748B";
      let lineDash: number[] | undefined = undefined;

      if (leg.mode === "METRO") {
        lineColor = leg.route_id?.includes("GREEN") ? "#009933" : "#0066CC";
      } else if (leg.mode === "BUS") {
        lineColor = "#DC2626";
      } else if (leg.mode === "WALK") {
        lineColor = "#94A3B8";
        lineDash = [2, 2];
      }

      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates,
          },
        },
      });

      map.addLayer({
        id: sourceId,
        type: "line",
        source: sourceId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": lineColor,
          "line-width": leg.mode === "WALK" ? 3 : 5,
          ...(lineDash ? { "line-dasharray": lineDash } : {}),
        },
      });
    });

    if (hasCoords) {
      map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 800 });
    }
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* MapLibre Container */}
      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "100%",
          display: showSchematic ? "none" : "block",
        }}
      />

      {/* Low-Data Schematic Transit Line Diagram */}
      {showSchematic && (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#070A10",
            padding: "24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ width: "100%", maxWidth: "480px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h4 style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>
                Schematic Transit Line (0 KB Tiles)
              </h4>
              <span
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  color: "#34D399",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                Data Saver Active
              </span>
            </div>

            {selectedItinerary ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {selectedItinerary.legs.map((leg, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-md)",
                      padding: "14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span
                        className="badge-leg"
                        style={{
                          backgroundColor:
                            leg.mode === "METRO"
                              ? leg.route_id?.includes("GREEN")
                                ? "var(--metro-green)"
                                : "var(--metro-blue)"
                              : leg.mode === "BUS"
                              ? "var(--bus-red)"
                              : "var(--text-muted)",
                        }}
                      >
                        {leg.mode === "METRO" ? <Train size={13} /> : leg.mode === "BUS" ? <Bus size={13} /> : <Footprints size={13} />}
                        {leg.route_short_name || leg.mode}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        {leg.duration_minutes} min &bull; {leg.departure_time.slice(0, 5)} - {leg.arrival_time.slice(0, 5)}
                      </span>
                    </div>

                    <div style={{ paddingLeft: "10px", borderLeft: "2px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>
                        From: {leg.from_stop_name}
                      </div>
                      {leg.intermediate_stops.length > 0 && (
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          Passing through: {leg.intermediate_stops.map((s) => s.stop_name).join(" → ")}
                        </div>
                      )}
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#34D399" }}>
                        To: {leg.to_stop_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: "13px" }}>
                Select or plan a trip to view the schematic route diagram.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Toggle Controls */}
      <div className="map-floating-overlay">
        <button
          type="button"
          className="map-control-btn"
          onClick={() => setShowSchematic(!showSchematic)}
        >
          {showSchematic ? <MapIcon size={14} /> : <Layers size={14} />}
          <span>{showSchematic ? "Map View" : "Diagram (0 KB)"}</span>
        </button>
      </div>
    </div>
  );
};
