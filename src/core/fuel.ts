import type { TrackPoint } from "./types";
import { effectiveHrr, zoneForHr, type Profile, type ZoneId } from "./karvonen";

// Crossover anchors: [intensity (fraction of HRR), fat fraction of energy].
// Grounded in the crossover concept (Brooks & Mercier 1994): fat dominates at
// easy intensity and the body shifts to carbohydrate as intensity rises. The
// ~50/50 crossover lands near 0.65 HRR — the top of Zone 2.
const ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.85],
  [0.6, 0.6],
  [0.8, 0.25],
  [1.0, 0.05],
];

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// Fraction (0..1) of energy from fat at a given intensity (fraction of HRR).
// Piecewise-linear between ANCHORS; flat outside the [0,1] range.
export function fatFraction(intensity: number): number {
  const x = clamp01(intensity);
  for (let i = 1; i < ANCHORS.length; i++) {
    const [x0, y0] = ANCHORS[i - 1];
    const [x1, y1] = ANCHORS[i];
    if (x <= x1) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return ANCHORS[ANCHORS.length - 1][1];
}

// Intensity as a fraction of heart-rate reserve, clamped to [0,1].
// Null when HR is missing or HRR is non-positive.
export function intensityFromHr(hr: number | null, profile: Profile): number | null {
  if (hr === null) return null;
  const reserve = effectiveHrr(profile);
  if (reserve <= 0) return null;
  return clamp01((hr - profile.restingHr) / reserve);
}

export interface FuelSplit {
  fatPct: number; // % of energy from fat across the run (0..100)
  carbPct: number; // 100 - fatPct when known, else 0
  fatPctByZone: Record<ZoneId, number>; // mean fat % within each zone (0..100)
  knownSec: number; // seconds with usable HR
  unknownSec: number; // seconds without HR
  totalSec: number;
}

function emptyByZone(): Record<ZoneId, number> {
  return { below: 0, zone2: 0, zone3: 0, above: 0 };
}

const ZONES: ZoneId[] = ["below", "zone2", "zone3", "above"];

// Energy-weighted fat/carb split over [0, endIndex]. Each interval's fat
// fraction is weighted by its relative energy rate (proportional to intensity),
// so harder seconds — which burn more energy — count more, without needing body
// weight. Per-zone fat % is a plain time-weighted mean within each zone.
export function fuelSplit(
  points: TrackPoint[],
  profile: Profile,
  endIndex?: number,
): FuelSplit {
  const fatTimeByZone = emptyByZone();
  const zoneSec = emptyByZone();
  let fatEnergy = 0;
  let totalEnergy = 0;
  let knownSec = 0;
  let unknownSec = 0;
  let totalSec = 0;

  if (points.length >= 2) {
    const last = points.length - 1;
    const end = Math.max(0, Math.min(endIndex ?? last, last));
    for (let i = 0; i < end; i++) {
      const dt = (points[i + 1].time.getTime() - points[i].time.getTime()) / 1000;
      totalSec += dt;
      const intensity = intensityFromHr(points[i].hr, profile);
      if (intensity === null) {
        unknownSec += dt;
        continue;
      }
      knownSec += dt;
      const fat = fatFraction(intensity);
      const rate = Math.max(intensity, 0.01); // relative energy rate, floored
      fatEnergy += fat * rate * dt;
      totalEnergy += rate * dt;
      const zone = zoneForHr(points[i].hr, profile);
      if (zone !== null) {
        fatTimeByZone[zone] += fat * dt;
        zoneSec[zone] += dt;
      }
    }
  }

  const fatPct = totalEnergy > 0 ? (fatEnergy / totalEnergy) * 100 : 0;
  const fatPctByZone = emptyByZone();
  for (const z of ZONES) {
    fatPctByZone[z] = zoneSec[z] > 0 ? (fatTimeByZone[z] / zoneSec[z]) * 100 : 0;
  }

  return {
    fatPct,
    carbPct: totalEnergy > 0 ? 100 - fatPct : 0,
    fatPctByZone,
    knownSec,
    unknownSec,
    totalSec,
  };
}
