import "leaflet/dist/leaflet.css";
import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet";

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }): null {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, bounds]);
  return null;
}
import type { TrackPoint } from "../core/types";

export interface MapViewProps {
  points: TrackPoint[];
  progressIndex: number;
  markerColor: string;
  onRequestImport?: () => void;
}

if (typeof document !== "undefined" && !document.getElementById("runner-bob-style")) {
  const style = document.createElement("style");
  style.id = "runner-bob-style";
  style.textContent =
    "@keyframes runnerBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}" +
    ".runner-bob{animation:runnerBob .5s ease-in-out infinite}";
  document.head.appendChild(style);
}

export default function MapView({ points, progressIndex, markerColor: _markerColor, onRequestImport }: MapViewProps): React.JSX.Element {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const latlngs = useMemo<LatLngExpression[]>(() => points.map((p) => [p.lat, p.lon]), [points]);
  const bounds = useMemo<LatLngBoundsExpression>(() => {
    const lats = points.map((p) => p.lat);
    const lons = points.map((p) => p.lon);
    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ];
  }, [points]);

  const clamped = Math.max(0, Math.min(progressIndex, points.length - 1));
  const i = Math.floor(clamped);
  const frac = clamped - i;
  const a = points[i] ?? points[0];
  const b = points[i + 1] ?? a;
  const facingRight = b.lon - a.lon >= 0;

  const runnerIcon = useMemo(
    () =>
      L.divIcon({
        html:
          // 🏃 emoji faces left by default; mirror it to face right when heading east
          `<div style="transform:scaleX(${facingRight ? -1 : 1})">` +
          `<div class="runner-bob" style="font-size:22px;line-height:24px;text-align:center">🏃</div>` +
          `</div>`,
        className: "runner-marker",
        iconSize: [24, 24],
        iconAnchor: [12, 22],
      }),
    [facingRight],
  );
  const markerPos: LatLngExpression = [a.lat + (b.lat - a.lat) * frac, a.lon + (b.lon - a.lon) * frac];
  const passed = useMemo<LatLngExpression[]>(
    () => latlngs.slice(0, i + 1).concat([markerPos]),
    [latlngs, i, markerPos],
  );

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }); }}
      onClick={() => setMenu(null)}
    >
      <MapContainer bounds={bounds} style={{ width: "100%", height: "100%" }} scrollWheelZoom>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        {/* white casing under the whole route for contrast on light tiles */}
        <Polyline positions={latlngs} pathOptions={{ color: "#FFFFFF", weight: 8, opacity: 0.9 }} />
        {/* full route: strong blue */}
        <Polyline positions={latlngs} pathOptions={{ color: "#1D4ED8", weight: 4 }} />
        {/* passed portion: strong orange on top */}
        <Polyline positions={passed} pathOptions={{ color: "#EA580C", weight: 6 }} />
        {/* position marker: running-person emoji gliding along the route */}
        <Marker position={markerPos} icon={runnerIcon} />
        <FitBounds bounds={bounds} />
      </MapContainer>
      {/* hint label */}
      <div style={{ position: "absolute", top: 8, left: 8, zIndex: 999, pointerEvents: "none",
                    background: "rgba(11,18,32,0.7)", color: "#CBD5E1", fontSize: 11,
                    padding: "3px 8px", borderRadius: 6 }}>Right-click to upload a GPX</div>
      {/* context menu */}
      {menu && onRequestImport && (
        <div
          style={{ position: "absolute", left: menu.x, top: menu.y, zIndex: 1000,
                   background: "#16213A", border: "1px solid #334155", borderRadius: 8,
                   padding: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
          onMouseLeave={() => setMenu(null)}
        >
          <button
            onClick={() => { setMenu(null); onRequestImport(); }}
            style={{ background: "transparent", color: "#F1F5F9", border: "none",
                     padding: "8px 14px", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}
          >⤓ Upload GPX file</button>
        </div>
      )}
    </div>
  );
}
