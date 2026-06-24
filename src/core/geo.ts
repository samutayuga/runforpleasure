import type { TrackPoint } from "./types";

const R = 6_371_000; // earth radius, meters

export function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function cumulativeDistances(points: TrackPoint[]): number[] {
  const out: number[] = new Array(points.length);
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) total += haversineMeters(points[i - 1], points[i]);
    out[i] = total;
  }
  return out;
}

export function paceMinPerKm(meters: number, seconds: number): number | null {
  if (meters <= 0) return null;
  const minutes = seconds / 60;
  const km = meters / 1000;
  return minutes / km;
}
