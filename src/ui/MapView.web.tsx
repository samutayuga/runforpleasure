import "leaflet/dist/leaflet.css";
import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet";
import { reverseGeocode } from "./geocode";

import type { TrackPoint } from "../core/types";

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }): null {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, bounds]);
  return null;
}

export interface MapViewProps {
  points: TrackPoint[];
  progressIndex: number;
  markerColor: string;
  cumulative: number[];
  onRequestImport?: () => void;
  onRequestStrava?: () => void;
  onShowRoutes?: () => void;
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

function kmIcon(label: string): L.DivIcon {
  return L.divIcon({
    html:
      `<div style="background:#0B1220;color:#F8FAFC;font-size:10px;font-weight:700;` +
      `padding:1px 5px;border-radius:9px;border:1.5px solid #F97316;white-space:nowrap;` +
      `box-shadow:0 1px 2px rgba(0,0,0,0.5)">${label}k</div>`,
    className: "km-marker",
    iconSize: [22, 16],
    iconAnchor: [11, 8],
  });
}

function KmMarker({ pos, label }: { pos: [number, number]; label: string }): React.JSX.Element {
  const [name, setName] = useState<string | null>(null);
  return (
    <Marker
      position={pos}
      icon={kmIcon(label)}
      eventHandlers={{
        popupopen: async () => {
          if (name === null) setName((await reverseGeocode(pos[0], pos[1])) ?? "Unknown area");
        },
      }}
    >
      <Popup>{`${label} km · ${name ?? "Locating…"}`}</Popup>
    </Marker>
  );
}

export default function MapView({ points, progressIndex, markerColor: _markerColor, cumulative, onRequestImport, onRequestStrava, onShowRoutes }: MapViewProps): React.JSX.Element {
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
      `<svg width="22" height="22" viewBox="0 0 24 24" stroke="#0F172A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">` +
        // head + leaning torso (spine)
        `<circle cx="15.5" cy="4.2" r="2.7" fill="#0F172A" stroke="none"/>` +
        `<line x1="15" y1="6.4" x2="10.5" y2="13.5"/>` +
        // stride frame A: front leg + arm forward, bent at knee/elbow
        `<g class="rn-a">` +
          `<polyline points="10.5,13.5 13.6,16 12.6,20.6"/>` +
          `<polyline points="10.5,13.5 7.6,16.8 8.9,20.8"/>` +
          `<polyline points="13,8 16.4,9.6 16,12.6"/>` +
          `<polyline points="13,8 10,9.2 9.6,12"/>` +
        `</g>` +
        // stride frame B: limbs swapped
        `<g class="rn-b">` +
          `<polyline points="10.5,13.5 8,16.6 7,20.8"/>` +
          `<polyline points="10.5,13.5 13.2,16.6 14.4,20.3"/>` +
          `<polyline points="13,8 10,9.6 9.6,12.6"/>` +
          `<polyline points="13,8 16,9.2 16.5,12"/>` +
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

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }); }}
      onClick={() => setMenu(null)}
    >
      <MapContainer bounds={bounds} style={{ width: "100%", height: "100%" }} scrollWheelZoom>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
          subdomains="abcd"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          maxZoom={20}
        />
        {/* white casing under the whole route for contrast on light tiles */}
        <Polyline positions={latlngs} pathOptions={{ color: "#FFFFFF", weight: 8, opacity: 0.9 }} />
        {/* full route: strong blue */}
        <Polyline positions={latlngs} pathOptions={{ color: "#1D4ED8", weight: 4 }} />
        {/* passed portion: strong orange on top */}
        <Polyline positions={passed} pathOptions={{ color: "#EA580C", weight: 6 }} />
        {/* km markers: labeled every 1 km along the route, below the runner */}
        {kmMarkers.map((m) => <KmMarker key={m.label} pos={m.pos} label={m.label} />)}
        {/* position marker: running-person emoji gliding along the route */}
        <Marker position={markerPos} icon={runnerIcon} />
        <FitBounds bounds={bounds} />
      </MapContainer>
      {/* hint label */}
      <div style={{ position: "absolute", top: 8, left: 8, zIndex: 999, pointerEvents: "none",
                    background: "rgba(11,18,32,0.7)", color: "#CBD5E1", fontSize: 11,
                    padding: "3px 8px", borderRadius: 6 }}>Right-click for upload / Strava</div>
      {/* context menu */}
      {menu && (onRequestImport || onRequestStrava || onShowRoutes) && (
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
            >⤓ Upload GPX file(s)</button>
          )}
          {onShowRoutes && (
            <button onClick={() => { setMenu(null); onShowRoutes(); }}
              style={{ background: "transparent", color: "#F1F5F9", border: "none", padding: "8px 14px", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap", display: "block", width: "100%", textAlign: "left" }}
            >☰ Show route list</button>
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
