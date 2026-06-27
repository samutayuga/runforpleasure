import "leaflet/dist/leaflet.css";
import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet";
import { nearestPlace } from "../core/places";
import { PLACES } from "../data/places";
import { routeAreaMarkers } from "../core/areaMarkers";
import type { AreaMarker } from "../core/areaMarkers";

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
    "@keyframes rnBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}" +
    ".rn-bob{animation:rnBob .52s ease-in-out infinite}" +
    // dark, rounded place-name popup
    ".rn-popup .leaflet-popup-content-wrapper{background:#16213A;color:#F1F5F9;border:1px solid #334155;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,0.55)}" +
    ".rn-popup .leaflet-popup-content{margin:9px 14px;font:600 13px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:.2px}" +
    ".rn-popup .leaflet-popup-tip{background:#16213A;box-shadow:none;border:none}";
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
  // Offline nearest-place name, resolved synchronously from the bundled dataset.
  const name = nearestPlace(pos[0], pos[1], PLACES) ?? "Unknown area";
  return (
    <Marker position={pos} icon={kmIcon(label)}>
      <Popup className="rn-popup" closeButton={false}>{`📍 ${name}`}</Popup>
    </Marker>
  );
}

// Small cyan dot marking a named area the route passes through, between km marks.
const areaDotIcon = L.divIcon({
  html:
    `<div style="width:9px;height:9px;border-radius:50%;background:#22D3EE;` +
    `border:2px solid #0B1220;box-shadow:0 1px 2px rgba(0,0,0,0.5)"></div>`,
  className: "area-dot",
  iconSize: [13, 13],
  iconAnchor: [6.5, 6.5],
});

function AreaMarkerDot({ m }: { m: AreaMarker }): React.JSX.Element {
  return (
    <Marker position={[m.lat, m.lon]} icon={areaDotIcon}>
      <Popup className="rn-popup" closeButton={false}>{`📍 ${m.name}`}</Popup>
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
    // Running athlete with continuously rotating joints (SMIL): thighs swing at
    // the hip, shins bend at the knee, arms swing at the shoulder/elbow. Legs and
    // arms run a triangle-wave cycle; opposite sides are out of phase.
    const D = "0.52s";
    const rot = (vals: string) =>
      `<animateTransform attributeName="transform" type="rotate" dur="${D}" repeatCount="indefinite" values="${vals}"/>`;
    // hip (10.6,14), knee (10.9,17.5), shoulder (13.8,8), elbow (15.4,10.4)
    const leg = (thighVals: string, shinVals: string) =>
      `<g>${rot(thighVals)}<line x1="10.6" y1="14" x2="10.9" y2="17.5" stroke-width="2.4"/>` +
      `<g>${rot(shinVals)}<line x1="10.9" y1="17.5" x2="11.3" y2="20.9" stroke-width="2.4"/></g></g>`;
    const arm = (upperVals: string, foreVals: string) =>
      `<g>${rot(upperVals)}<line x1="13.8" y1="8" x2="15.4" y2="10.4" stroke-width="2"/>` +
      `<g>${rot(foreVals)}<line x1="15.4" y1="10.4" x2="15" y2="12.8" stroke-width="2"/></g></g>`;
    const svg =
      `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F172A" stroke-linecap="round" stroke-linejoin="round">` +
        // back limbs first (drawn behind), then torso/head, then front limbs
        leg("18 10.6 14;-18 10.6 14;18 10.6 14", "42 10.9 17.5;16 10.9 17.5;42 10.9 17.5") +
        arm("20 13.8 8;-20 13.8 8;20 13.8 8", "22 15.4 10.4;48 15.4 10.4;22 15.4 10.4") +
        `<line x1="13.6" y1="7" x2="10.6" y2="14" stroke-width="3.2"/>` +
        `<circle cx="14" cy="4.6" r="2.7" fill="#0F172A" stroke="none"/>` +
        leg("-18 10.6 14;18 10.6 14;-18 10.6 14", "16 10.9 17.5;42 10.9 17.5;16 10.9 17.5") +
        arm("-20 13.8 8;20 13.8 8;-20 13.8 8", "48 15.4 10.4;22 15.4 10.4;48 15.4 10.4") +
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

  const areaMarkers = useMemo(
    () => routeAreaMarkers(points, cumulative, PLACES),
    [points, cumulative],
  );

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
        {/* area markers: named places the route passes through, between km marks */}
        {areaMarkers.map((m, idx) => <AreaMarkerDot key={`area-${idx}`} m={m} />)}
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
