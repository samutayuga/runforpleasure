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
  cumulative: number[];
  onRequestImport?: () => void;
  onRequestStrava?: () => void;
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

export default function MapView({ points, progressIndex, markerColor: _markerColor, cumulative, onRequestImport, onRequestStrava }: MapViewProps): React.JSX.Element {
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

  const j = Math.min(i + 4, points.length - 1);
  const ahead = points[j];
  const dx = (ahead.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180);
  const dy = ahead.lat - a.lat;
  const bearingRaw = (dx === 0 && dy === 0) ? 0 : (Math.atan2(-dy, dx) * 180) / Math.PI;
  const bearingQ = Math.round(bearingRaw / 8) * 8;

  const runnerIcon = useMemo(() => {
    const upsideDown = Math.abs(bearingQ) > 90;
    const transform = `rotate(${bearingQ}deg)` + (upsideDown ? " scaleY(-1)" : "");
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
        `<div style="transform:${transform}">` +
          `<div class="rn-bob" style="width:26px;height:26px;border-radius:50%;background:rgba(248,250,252,0.92);` +
          `display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.4)">` +
            svg +
          `</div>` +
        `</div>`,
      className: "runner-marker",
      iconSize: [26, 26],
      iconAnchor: [13, 24],
    });
  }, [bearingQ]);
  const markerPos: LatLngExpression = [a.lat + (b.lat - a.lat) * frac, a.lon + (b.lon - a.lon) * frac];
  const passed = useMemo<LatLngExpression[]>(
    () => latlngs.slice(0, i + 1).concat([markerPos]),
    [latlngs, i, markerPos],
  );

  const kmMarkers = useMemo(() => {
    const out: Array<{ pos: [number, number]; label: string }> = [];
    const total = cumulative.length ? cumulative[cumulative.length - 1] : 0;
    for (let km = 1; km * 1000 <= total; km++) {
      const target = km * 1000;
      let idx = -1;
      for (let k = 1; k < cumulative.length; k++) { if (cumulative[k] >= target) { idx = k; break; } }
      if (idx <= 0) continue;
      const d0 = cumulative[idx - 1], d1 = cumulative[idx];
      const f = d1 === d0 ? 0 : (target - d0) / (d1 - d0);
      const p0 = points[idx - 1], p1 = points[idx];
      out.push({ pos: [p0.lat + (p1.lat - p0.lat) * f, p0.lon + (p1.lon - p0.lon) * f], label: String(km) });
    }
    return out;
  }, [points, cumulative]);

  const kmIcon = (label: string) =>
    L.divIcon({
      html:
        `<div style="background:#0B1220;color:#F8FAFC;font-size:10px;font-weight:700;` +
        `padding:1px 5px;border-radius:9px;border:1.5px solid #F97316;white-space:nowrap;` +
        `box-shadow:0 1px 2px rgba(0,0,0,0.5)">${label}k</div>`,
      className: "km-marker",
      iconSize: [22, 16],
      iconAnchor: [11, 8],
    });

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
        {/* km markers: labeled every 1 km along the route, below the runner */}
        {kmMarkers.map((m) => (
          <Marker key={m.label} position={m.pos} icon={kmIcon(m.label)} interactive={false} />
        ))}
        {/* position marker: running-person emoji gliding along the route */}
        <Marker position={markerPos} icon={runnerIcon} />
        <FitBounds bounds={bounds} />
      </MapContainer>
      {/* hint label */}
      <div style={{ position: "absolute", top: 8, left: 8, zIndex: 999, pointerEvents: "none",
                    background: "rgba(11,18,32,0.7)", color: "#CBD5E1", fontSize: 11,
                    padding: "3px 8px", borderRadius: 6 }}>Right-click for upload / Strava</div>
      {/* context menu */}
      {menu && (onRequestImport || onRequestStrava) && (
        <div
          style={{ position: "absolute", left: menu.x, top: menu.y, zIndex: 1000,
                   background: "#16213A", border: "1px solid #334155", borderRadius: 8,
                   padding: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
          onMouseLeave={() => setMenu(null)}
        >
          {onRequestImport && (
            <button
              onClick={() => { setMenu(null); onRequestImport(); }}
              style={{ background: "transparent", color: "#F1F5F9", border: "none",
                       padding: "8px 14px", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap",
                       display: "block", width: "100%", textAlign: "left" }}
            >⤓ Upload GPX file</button>
          )}
          {onRequestStrava && (
            <button onClick={() => { setMenu(null); onRequestStrava(); }}
              style={{ background: "transparent", color: "#F1F5F9", border: "none", padding: "8px 14px", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap", display: "block", width: "100%", textAlign: "left" }}
            >↪ Load from Strava</button>
          )}
        </div>
      )}
    </div>
  );
}
