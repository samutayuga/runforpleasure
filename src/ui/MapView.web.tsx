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

if (typeof document !== "undefined" && !document.getElementById("runner-anim-style")) {
  const style = document.createElement("style");
  style.id = "runner-anim-style";
  style.textContent =
    "@keyframes rnStepA{0%,49.9%{opacity:1}50%,100%{opacity:0}}" +
    "@keyframes rnStepB{0%,49.9%{opacity:0}50%,100%{opacity:1}}" +
    "@keyframes rnBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}" +
    ".rn-a{animation:rnStepA .36s steps(1) infinite}" +
    ".rn-b{animation:rnStepB .36s steps(1) infinite}" +
    ".rn-bob{animation:rnBob .36s ease-in-out infinite}";
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

  const runnerIcon = useMemo(() => {
    const flip = facingRight ? -1 : 1; // 🏃 faces right when heading east
    const svg =
      `<svg width="20" height="20" viewBox="0 0 24 24" stroke="#0F172A" stroke-width="2" stroke-linecap="round" fill="none">` +
        `<circle cx="14" cy="4" r="2.4" fill="#0F172A" stroke="none"/>` +
        `<line x1="13.5" y1="6.2" x2="10" y2="14"/>` +
        `<g class="rn-a">` +
          `<line x1="10" y1="14" x2="15" y2="19.5"/>` +
          `<line x1="10" y1="14" x2="6.5" y2="20.5"/>` +
          `<line x1="12.5" y1="8" x2="16.5" y2="10.5"/>` +
          `<line x1="12.5" y1="8" x2="9" y2="6.5"/>` +
        `</g>` +
        `<g class="rn-b">` +
          `<line x1="10" y1="14" x2="8" y2="21"/>` +
          `<line x1="10" y1="14" x2="13" y2="20.5"/>` +
          `<line x1="12.5" y1="8" x2="9" y2="10.5"/>` +
          `<line x1="12.5" y1="8" x2="16" y2="6.5"/>` +
        `</g>` +
      `</svg>`;
    return L.divIcon({
      html:
        `<div style="transform:scaleX(${flip})">` +
          `<div class="rn-bob" style="width:26px;height:26px;border-radius:50%;background:rgba(248,250,252,0.92);` +
          `display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.4)">` +
            svg +
          `</div>` +
        `</div>`,
      className: "runner-marker",
      iconSize: [26, 26],
      iconAnchor: [13, 24],
    });
  }, [facingRight]);
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
