import type { TrackPoint } from "./types";
import { zoneForHr, type Profile, type ZoneId } from "./karvonen";

export interface ZonePoint {
  distanceM: number;
  elapsedSec: number;
  zone: ZoneId;
  level: number;
}

const LEVEL: Record<ZoneId, number> = { below: 0, zone2: 1, zone3: 2, above: 3 };

export function buildZoneTimeline(
  points: TrackPoint[],
  cumulative: number[],
  profile: Profile,
  maxSamples = 240,
): ZonePoint[] {
  if (points.length < 1) return [];

  const start = points[0].time.getTime();
  const step = Math.max(1, Math.ceil(points.length / maxSamples));
  const idxs: number[] = [];
  for (let i = 0; i < points.length; i += step) idxs.push(i);
  const lastIdx = points.length - 1;
  if (idxs[idxs.length - 1] !== lastIdx) idxs.push(lastIdx);

  const out: ZonePoint[] = [];
  for (const i of idxs) {
    const zone = zoneForHr(points[i].hr, profile);
    if (zone === null) continue;
    out.push({
      distanceM: cumulative[i],
      elapsedSec: (points[i].time.getTime() - start) / 1000,
      zone,
      level: LEVEL[zone],
    });
  }
  return out;
}
