import type { TrackPoint } from "./types";
import { effectiveHrr, hrr, zoneForHr, type Profile, type Sex, type ZoneId } from "./karvonen";

// Gross running energy cost: ~1.036 kcal burned per kg of body mass per km,
// roughly pace-independent for running (di Prampero). Lets us turn distance +
// weight into absolute kcal without a power meter.
const RUN_KCAL_PER_KG_KM = 1.036;
const KCAL_PER_G_FAT = 9; // Atwater factors
const KCAL_PER_G_CARB = 4;
// Fraction of HRR where fat oxidation rate (grams/min) peaks — "Fatmax",
// empirically near the top of Zone 2.
const FATMAX_HRR = 0.62;
// Sleep penalty on fat oxidation. Poor sleep raises RER and shifts substrate
// use toward carbohydrate, so the SAME effort burns less fat. Full (1.0) at
// >= 7 h, linear down to a 0.8 floor at <= 4 h. Separate from the zone-easing
// in effectiveHrr — this models the metabolic hit, not the HR reading.
const SLEEP_FAT_FLOOR = 0.8;

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

// Women oxidise more fat than men at the same relative intensity (higher
// estrogen spares glycogen). Lift the fat share a few points for female.
const FEMALE_FAT_UPLIFT = 0.05;

// Fraction (0..1) of energy from fat at a given intensity (fraction of HRR).
// Piecewise-linear between ANCHORS; flat outside the [0,1] range. Female gets a
// small substrate uplift, clamped to 1.
export function fatFraction(intensity: number, sex?: Sex): number {
  const x = clamp01(intensity);
  const uplift = sex === "female" ? FEMALE_FAT_UPLIFT : 0;
  for (let i = 1; i < ANCHORS.length; i++) {
    const [x0, y0] = ANCHORS[i - 1];
    const [x1, y1] = ANCHORS[i];
    if (x <= x1) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return clamp01(y0 + t * (y1 - y0) + uplift);
    }
  }
  return clamp01(ANCHORS[ANCHORS.length - 1][1] + uplift);
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
      const fat = fatFraction(intensity, profile.sex);
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

// Fat-oxidation multiplier (0.8..1.0) from last night's sleep. 1.0 when rested
// (>= 7 h) or unknown; linear to a 0.8 floor at <= 4 h.
export function sleepFatFactor(sleepHours?: number): number {
  if (sleepHours === undefined) return 1;
  const f = SLEEP_FAT_FLOOR + ((sleepHours - 4) / 3) * (1 - SLEEP_FAT_FLOOR);
  if (f < SLEEP_FAT_FLOOR) return SLEEP_FAT_FLOOR;
  if (f > 1) return 1;
  return f;
}

export interface FuelEnergy {
  totalKcal: number; // all distance energy over the run (HR-known or not)
  fatKcal: number; // kcal from fat across HR-known intervals
  carbKcal: number; // kcal from carbohydrate across HR-known intervals
  fatGrams: number;
  carbGrams: number;
  peakFatGramsPerMin: number; // best single-interval fat-burn rate (g/min)
  knownSec: number; // seconds with usable HR
  unknownSec: number; // seconds without HR
}

// Absolute energy split for a run. Unlike fuelSplit (ratio-only), this needs
// body weight to scale distance into kcal. Each interval's kcal = cost × weight
// × distance; the fat/carb share comes from the HRR-intensity fat fraction.
// No weight -> null, so callers can prompt for it. Distance comes from the
// cumulative-distance array aligned to `points` (cumulativeDistances).
export function fuelEnergy(
  points: TrackPoint[],
  cumulative: number[],
  profile: Profile,
  endIndex?: number,
): FuelEnergy | null {
  const weight = profile.weightKg;
  if (weight === undefined || weight <= 0) return null;
  const sleepFat = sleepFatFactor(profile.sleepHours);

  let totalKcal = 0;
  let fatKcal = 0;
  let carbKcal = 0;
  let peakFatGramsPerMin = 0;
  let knownSec = 0;
  let unknownSec = 0;

  if (points.length >= 2) {
    const last = Math.min(points.length, cumulative.length) - 1;
    const end = Math.max(0, Math.min(endIndex ?? last, last));
    for (let i = 0; i < end; i++) {
      const dt = (points[i + 1].time.getTime() - points[i].time.getTime()) / 1000;
      const dMeters = Math.max(0, cumulative[i + 1] - cumulative[i]);
      const kcal = (RUN_KCAL_PER_KG_KM * weight * dMeters) / 1000;
      totalKcal += kcal;
      const intensity = intensityFromHr(points[i].hr, profile);
      if (intensity === null) {
        unknownSec += dt;
        continue;
      }
      knownSec += dt;
      const fat = fatFraction(intensity, profile.sex) * sleepFat;
      const fatKcalHere = fat * kcal;
      fatKcal += fatKcalHere;
      carbKcal += (1 - fat) * kcal;
      if (dt > 0) {
        const rate = fatKcalHere / KCAL_PER_G_FAT / (dt / 60); // g/min this interval
        if (rate > peakFatGramsPerMin) peakFatGramsPerMin = rate;
      }
    }
  }

  return {
    totalKcal,
    fatKcal,
    carbKcal,
    fatGrams: fatKcal / KCAL_PER_G_FAT,
    carbGrams: carbKcal / KCAL_PER_G_CARB,
    peakFatGramsPerMin,
    knownSec,
    unknownSec,
  };
}

// Heart rate that maximises fat-burning RATE (grams/min) — the "Fatmax"
// training target. Uses plain HRR (not sleep-adjusted) so the target pace is
// stable night to night.
export function fatmaxHr(profile: Profile): number {
  return profile.restingHr + FATMAX_HRR * hrr(profile);
}

// Current fat mass in grams from body weight and a body-fat percentage (0..100),
// e.g. from a recent body-composition test.
export function fatMassGrams(weightKg: number, bodyFatPct: number): number {
  return weightKg * (bodyFatPct / 100) * 1000;
}

export interface FatLossPlan {
  runs: number; // runs needed to burn the target fat (Infinity if none/run)
  weeks: number; // calendar weeks at the planned cadence
}

// How long a continuous program takes: ceil(target / per-run) runs, spread over
// the weekly cadence. Burning 0 per run never finishes -> Infinity.
export function fatLossPlan(
  targetFatGrams: number,
  fatGramsPerRun: number,
  runsPerWeek: number,
): FatLossPlan {
  if (fatGramsPerRun <= 0 || runsPerWeek <= 0) {
    return { runs: Infinity, weeks: Infinity };
  }
  const runs = Math.ceil(targetFatGrams / fatGramsPerRun);
  return { runs, weeks: runs / runsPerWeek };
}

export interface DynamicFatLossPlan extends FatLossPlan {
  endWeightKg: number; // body weight once the target fat is burned
}

const DYNAMIC_RUN_CAP = 100000; // safety bound; beyond this we call it unreachable

// Same goal, but integrated run-by-run: fat burned per run is proportional to
// body weight (kcal = cost × weight × distance), so as you lose fat the weight
// drops and each subsequent run burns a little less. Every gram of fat burned
// comes off body weight. Converges because the target is a slice of fat mass.
export function dynamicFatLossPlan(
  targetFatGrams: number,
  fatGramsPerRunAtRefWeight: number,
  refWeightKg: number,
  runsPerWeek: number,
): DynamicFatLossPlan {
  if (fatGramsPerRunAtRefWeight <= 0 || refWeightKg <= 0 || runsPerWeek <= 0) {
    return { runs: Infinity, weeks: Infinity, endWeightKg: refWeightKg };
  }
  const gramsPerKgPerRun = fatGramsPerRunAtRefWeight / refWeightKg;
  let weight = refWeightKg;
  let burned = 0;
  let runs = 0;
  while (burned < targetFatGrams && runs < DYNAMIC_RUN_CAP) {
    const g = gramsPerKgPerRun * weight;
    if (g <= 0) break;
    burned += g;
    weight -= g / 1000; // fat grams off body weight
    runs++;
  }
  if (burned < targetFatGrams) {
    return { runs: Infinity, weeks: Infinity, endWeightKg: weight };
  }
  return { runs, weeks: runs / runsPerWeek, endWeightKg: weight };
}
