import type { TrackPoint } from "./types";

export interface XY {
  x: number;
  y: number;
}

export function projectRoute(
  points: TrackPoint[],
  width: number,
  height: number,
  padding: number,
): XY[] {
  if (points.length === 0) return [];

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const innerW = width - 2 * padding;
  const innerH = height - 2 * padding;
  const spanLon = maxLon - minLon || 1;
  const spanLat = maxLat - minLat || 1;
  const scale = Math.min(innerW / spanLon, innerH / spanLat);

  // center the scaled route in the padded box
  const usedW = spanLon * scale;
  const usedH = spanLat * scale;
  const offsetX = padding + (innerW - usedW) / 2;
  const offsetY = padding + (innerH - usedH) / 2;

  return points.map((p) => ({
    x: Math.max(padding, Math.min(width - padding, offsetX + (p.lon - minLon) * scale)),
    y: Math.max(padding, Math.min(height - padding, offsetY + (maxLat - p.lat) * scale)), // flip so north is up
  }));
}
