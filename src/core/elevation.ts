import type { TrackPoint } from "./types";

export interface ElevationSample {
  index: number;
  distanceM: number; // cumulative distance at this point
  ele: number; // metres, nulls filled
}

export function buildElevationProfile(points: TrackPoint[], cumulative: number[]): ElevationSample[] {
  // Seed `last` with the first non-null ele (forward fill for leading nulls)
  let last = 0;
  for (const p of points) {
    if (p.ele !== null) {
      last = p.ele;
      break;
    }
  }

  const out: ElevationSample[] = [];
  for (let i = 0; i < points.length; i++) {
    const e = points[i].ele;
    if (e !== null) last = e;
    out.push({ index: i, distanceM: cumulative[i], ele: last });
  }
  return out;
}
