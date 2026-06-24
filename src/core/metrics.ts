import type { Run } from "./types";
import { paceMinPerKm as pace } from "./geo";
import { zoneForHr, type Profile, type ZoneId } from "./karvonen";

export interface LiveMetrics {
  elapsedSec: number;
  distanceMeters: number;
  paceMinPerKm: number | null;
  hr: number | null;
  zone: ZoneId | null;
}

export function deriveMetrics(
  run: Run,
  cumulative: number[],
  index: number,
  profile: Profile,
): LiveMetrics {
  const start = run.points[0].time.getTime();
  const elapsedSec = (run.points[index].time.getTime() - start) / 1000;
  const distanceMeters = cumulative[index];
  return {
    elapsedSec,
    distanceMeters,
    paceMinPerKm: pace(distanceMeters, elapsedSec),
    hr: run.points[index].hr,
    zone: zoneForHr(run.points[index].hr, profile),
  };
}
