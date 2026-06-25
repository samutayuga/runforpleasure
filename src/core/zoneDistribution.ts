import type { TrackPoint } from "./types";
import { zoneForHr, type Profile, type ZoneId } from "./karvonen";

export interface ZoneDistribution {
  secondsByZone: Record<ZoneId, number>;
  pctByZone: Record<ZoneId, number>;
  unknownSec: number;
  totalSec: number;
}

export function zoneDistribution(
  points: TrackPoint[],
  profile: Profile,
  endIndex?: number,
): ZoneDistribution {
  const secondsByZone: Record<ZoneId, number> = {
    below: 0,
    zone2: 0,
    zone3: 0,
    above: 0,
  };
  let unknownSec = 0;
  let totalSec = 0;

  if (points.length >= 2) {
    const last = points.length - 1;
    const end = Math.max(0, Math.min(endIndex ?? last, last));
    for (let i = 0; i < end; i++) {
      const dwell = (points[i + 1].time.getTime() - points[i].time.getTime()) / 1000;
      totalSec += dwell;
      const zone = zoneForHr(points[i].hr, profile);
      if (zone === null) unknownSec += dwell;
      else secondsByZone[zone] += dwell;
    }
  }

  const pctByZone: Record<ZoneId, number> = {
    below: totalSec > 0 ? (secondsByZone.below / totalSec) * 100 : 0,
    zone2: totalSec > 0 ? (secondsByZone.zone2 / totalSec) * 100 : 0,
    zone3: totalSec > 0 ? (secondsByZone.zone3 / totalSec) * 100 : 0,
    above: totalSec > 0 ? (secondsByZone.above / totalSec) * 100 : 0,
  };

  return { secondsByZone, pctByZone, unknownSec, totalSec };
}
