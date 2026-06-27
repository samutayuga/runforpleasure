import { readinessFactor } from "./readiness";

export interface Profile {
  age: number;
  restingHr: number;
  sleepHours?: number;
  weightKg?: number;
  bodyFatPct?: number;
}

export type ZoneId = "below" | "zone2" | "zone3" | "above";

export function maxHr(age: number): number {
  return 211 - 0.64 * age;
}

export function hrr(profile: Profile): number {
  return maxHr(profile.age) - profile.restingHr;
}

// HRR inflated by poor sleep readiness: a tired runner's elevated HR is read as
// a smaller fraction of reserve, so the same HR lands in a lower (easier) zone.
export function effectiveHrr(profile: Profile): number {
  return hrr(profile) / readinessFactor(profile.sleepHours);
}

export function zoneBoundaryHr(profile: Profile, pct: number): number {
  return pct * effectiveHrr(profile) + profile.restingHr;
}

export function zoneForHr(hr: number | null, profile: Profile): ZoneId | null {
  if (hr === null) return null;
  const z2 = zoneBoundaryHr(profile, 0.6);
  const z3 = zoneBoundaryHr(profile, 0.7);
  const z4 = zoneBoundaryHr(profile, 0.8);
  if (hr < z2) return "below";
  if (hr < z3) return "zone2";
  if (hr < z4) return "zone3";
  return "above";
}
