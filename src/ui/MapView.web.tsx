import "leaflet/dist/leaflet.css";
import React, { useMemo } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet";
import type { TrackPoint } from "../core/types";

export interface MapViewProps {
  points: TrackPoint[];
  progressIndex: number;
  markerColor: string;
}

export default function MapView({ points, progressIndex, markerColor }: MapViewProps): React.JSX.Element {
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
  const markerPos: LatLngExpression = [a.lat + (b.lat - a.lat) * frac, a.lon + (b.lon - a.lon) * frac];
  const passed = useMemo<LatLngExpression[]>(
    () => latlngs.slice(0, i + 1).concat([markerPos]),
    [latlngs, i, markerPos],
  );

  return (
    <MapContainer bounds={bounds} style={{ width: "100%", height: "100%" }} scrollWheelZoom>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <Polyline positions={latlngs} pathOptions={{ color: "#94A3B8", weight: 3 }} />
      <Polyline positions={passed} pathOptions={{ color: "#FB923C", weight: 5 }} />
      <CircleMarker center={markerPos} radius={7} pathOptions={{ color: "#F8FAFC", weight: 2, fillColor: markerColor, fillOpacity: 1 }} />
    </MapContainer>
  );
}
