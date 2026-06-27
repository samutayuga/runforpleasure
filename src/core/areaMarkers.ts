import type { TrackPoint } from "./types";
import { nearestPlace, type Place } from "./places";

export interface AreaMarker {
  lat: number;
  lon: number;
  name: string;
}

// Walk the route, sampling roughly every `stepM` metres, and emit a marker each
// time the nearest known place changes — i.e. the first point of every new named
// area the route enters. The very first and last points are always sampled.
// Sampling by distance keeps the (relatively expensive) nearest-place lookup off
// every single track point.
export function routeAreaMarkers(
  points: TrackPoint[],
  cumulative: number[],
  places: Place[],
  stepM = 250,
): AreaMarker[] {
  const out: AreaMarker[] = [];
  if (points.length === 0 || places.length === 0) return out;

  const last = points.length - 1;
  let lastName: string | null = null;
  let nextAt = 0;
  for (let i = 0; i < points.length; i++) {
    if (i !== 0 && i !== last && cumulative[i] < nextAt) continue;
    nextAt = cumulative[i] + stepM;
    const name = nearestPlace(points[i].lat, points[i].lon, places);
    if (name && name !== lastName) {
      out.push({ lat: points[i].lat, lon: points[i].lon, name });
      lastName = name;
    }
  }
  return out;
}
