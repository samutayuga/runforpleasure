import { describe, it, expect } from "vitest";
import {
  fatFraction,
  intensityFromHr,
  fuelSplit,
  fuelEnergy,
  fatmaxHr,
  sleepFatFactor,
  fatMassGrams,
  fatLossPlan,
  dynamicFatLossPlan,
} from "../fuel";
import { maxHr, type Profile } from "../karvonen";
import type { TrackPoint } from "../types";

const profile: Profile = { age: 30, restingHr: 60 };
// maxHr = 211 - 0.64*30 = 191.8 ; HRR = 191.8 - 60 = 131.8

function tp(sec: number, hr: number | null): TrackPoint {
  return { lat: 1.35, lon: 103.75, ele: null, time: new Date(sec * 1000), hr };
}

describe("fatFraction", () => {
  it("is fat-dominant and flat at very easy intensity", () => {
    expect(fatFraction(0)).toBeCloseTo(0.85, 5);
    expect(fatFraction(-1)).toBeCloseTo(0.85, 5); // clamps below 0
  });
  it("hits the anchor points", () => {
    expect(fatFraction(0.6)).toBeCloseTo(0.6, 5);
    expect(fatFraction(0.8)).toBeCloseTo(0.25, 5);
    expect(fatFraction(1)).toBeCloseTo(0.05, 5);
    expect(fatFraction(2)).toBeCloseTo(0.05, 5); // clamps above 1
  });
  it("interpolates linearly between anchors", () => {
    // midpoint of [0.6,0.8]: fat = (0.6 + 0.25) / 2 = 0.425
    expect(fatFraction(0.7)).toBeCloseTo(0.425, 5);
  });
  it("women oxidise more fat at the same intensity (+0.05, clamped ≤1)", () => {
    expect(fatFraction(0.7, "female")).toBeCloseTo(0.475, 5); // 0.425 + 0.05
    expect(fatFraction(0.7, "male")).toBeCloseTo(0.425, 5);
    expect(fatFraction(0, "female")).toBeCloseTo(0.9, 5); // 0.85 + 0.05
  });
  it("decreases monotonically as intensity rises", () => {
    expect(fatFraction(0.3)).toBeGreaterThan(fatFraction(0.7));
    expect(fatFraction(0.7)).toBeGreaterThan(fatFraction(0.9));
  });
});

describe("intensityFromHr", () => {
  it("returns null for missing HR", () => {
    expect(intensityFromHr(null, profile)).toBeNull();
  });
  it("computes the fraction of HRR", () => {
    expect(intensityFromHr(150, profile)).toBeCloseTo(90 / 131.8, 5);
  });
  it("clamps above max and below rest", () => {
    expect(intensityFromHr(250, profile)).toBe(1);
    expect(intensityFromHr(40, profile)).toBe(0);
  });
});

describe("fuelSplit", () => {
  it("returns zeros for an empty track", () => {
    const r = fuelSplit([], profile);
    expect(r.fatPct).toBe(0);
    expect(r.carbPct).toBe(0);
    expect(r.totalSec).toBe(0);
  });

  it("at constant HR the run fat% equals the point fat fraction", () => {
    const pts = [tp(0, 150), tp(60, 150), tp(120, 150)];
    const i = intensityFromHr(150, profile)!;
    const expectedFatPct = fatFraction(i) * 100;
    const r = fuelSplit(pts, profile);
    expect(r.fatPct).toBeCloseTo(expectedFatPct, 4);
    expect(r.carbPct).toBeCloseTo(100 - expectedFatPct, 4);
    expect(r.knownSec).toBe(120);
  });

  it("an easy run burns a higher fat % than a hard run", () => {
    const easy = fuelSplit([tp(0, 120), tp(60, 120)], profile);
    const hard = fuelSplit([tp(0, 175), tp(60, 175)], profile);
    expect(easy.fatPct).toBeGreaterThan(hard.fatPct);
  });

  it("counts intervals without HR as unknown seconds", () => {
    const r = fuelSplit([tp(0, null), tp(60, 150)], profile);
    expect(r.unknownSec).toBe(60);
    expect(r.knownSec).toBe(0);
    expect(r.fatPct).toBe(0);
  });

  it("reports per-zone fat % for the zone the HR falls in", () => {
    // 150 bpm -> zone2 (z2=139.08, z3=152.26)
    const r = fuelSplit([tp(0, 150), tp(60, 150)], profile);
    const i = intensityFromHr(150, profile)!;
    expect(r.fatPctByZone.zone2).toBeCloseTo(fatFraction(i) * 100, 4);
    expect(r.fatPctByZone.above).toBe(0);
  });
});

describe("intensityFromHr under low sleep", () => {
  it("reads a lower intensity for the same HR when tired", () => {
    const rested = intensityFromHr(150, profile)!;
    const tired = intensityFromHr(150, { ...profile, sleepHours: 4 })!;
    expect(tired).toBeLessThan(rested);
  });
});

const heavy: Profile = { age: 30, restingHr: 60, weightKg: 70 };

describe("fuelEnergy", () => {
  it("returns null without a usable body weight", () => {
    expect(fuelEnergy([tp(0, 150), tp(60, 150)], [0, 1000], profile)).toBeNull();
    expect(fuelEnergy([tp(0, 150), tp(60, 150)], [0, 1000], { ...heavy, weightKg: 0 })).toBeNull();
  });

  it("computes total kcal from distance × weight", () => {
    // 1 km at 70 kg: 1.036 * 70 * 1 = 72.52 kcal
    const r = fuelEnergy([tp(0, 150), tp(60, 150)], [0, 1000], heavy)!;
    expect(r.totalKcal).toBeCloseTo(72.52, 2);
    expect(r.knownSec).toBe(60);
  });

  it("splits kcal into fat/carb by the interval fat fraction and converts to grams", () => {
    const fat = fatFraction(intensityFromHr(150, profile)!);
    const r = fuelEnergy([tp(0, 150), tp(60, 150)], [0, 1000], heavy)!;
    expect(r.fatKcal).toBeCloseTo(fat * 72.52, 2);
    expect(r.carbKcal).toBeCloseTo((1 - fat) * 72.52, 2);
    expect(r.fatKcal + r.carbKcal).toBeCloseTo(r.totalKcal, 4); // all HR known
    expect(r.fatGrams).toBeCloseTo(r.fatKcal / 9, 4);
    expect(r.carbGrams).toBeCloseTo(r.carbKcal / 4, 4);
  });

  it("counts no-HR intervals as unknown energy: in total but not in fat/carb", () => {
    const r = fuelEnergy([tp(0, null), tp(60, 150)], [0, 1000], heavy)!;
    expect(r.totalKcal).toBeCloseTo(72.52, 2);
    expect(r.unknownSec).toBe(60);
    expect(r.knownSec).toBe(0);
    expect(r.fatKcal).toBe(0);
    expect(r.carbKcal).toBe(0);
  });

  it("burns more fat grams on an easy run than a hard one over the same distance", () => {
    const easy = fuelEnergy([tp(0, 120), tp(60, 120)], [0, 1000], heavy)!;
    const hard = fuelEnergy([tp(0, 175), tp(60, 175)], [0, 1000], heavy)!;
    expect(easy.fatGrams).toBeGreaterThan(hard.fatGrams);
  });

  it("reports the peak fat-burn rate; equal to the average on a uniform run", () => {
    const r = fuelEnergy([tp(0, 150), tp(60, 150)], [0, 1000], heavy)!;
    const avg = r.fatGrams / (r.knownSec / 60);
    expect(r.peakFatGramsPerMin).toBeCloseTo(avg, 6);
  });

  it("peak >= average when one interval burns fat faster than the rest", () => {
    // interval 0: 60s, 1000 m (fast, fat-rich at easy HR) ; interval 1: 60s, 100 m (slow)
    const pts = [tp(0, 130), tp(60, 130), tp(120, 130)];
    const r = fuelEnergy(pts, [0, 1000, 1100], heavy)!;
    const avg = r.fatGrams / (r.knownSec / 60);
    expect(r.peakFatGramsPerMin).toBeGreaterThan(avg);
  });
});

describe("fatmaxHr", () => {
  it("targets the top of Zone 2 — between z2 and z3 boundaries", () => {
    // z2 = 0.6*131.8+60 = 139.08 ; z3 = 0.7*131.8+60 = 152.26
    const hr = fatmaxHr(profile);
    expect(hr).toBeGreaterThan(139);
    expect(hr).toBeLessThan(153);
  });
});

describe("sleepFatFactor", () => {
  it("is full (1.0) when well rested or sleep unknown", () => {
    expect(sleepFatFactor(undefined)).toBe(1);
    expect(sleepFatFactor(8)).toBe(1);
    expect(sleepFatFactor(7)).toBe(1);
  });
  it("penalises poor sleep, floored at 0.8", () => {
    expect(sleepFatFactor(5.5)).toBeCloseTo(0.9, 6); // midpoint of 4..7
    expect(sleepFatFactor(4)).toBeCloseTo(0.8, 6);
    expect(sleepFatFactor(2)).toBeCloseTo(0.8, 6); // floor
  });
});

describe("fuelEnergy sleep coupling (physiology-correct)", () => {
  it("burns more fat on the same run after a good night's sleep", () => {
    const pts = [tp(0, 145), tp(60, 145)];
    const rested = fuelEnergy(pts, [0, 1000], { ...heavy, sleepHours: 8 })!;
    const tired = fuelEnergy(pts, [0, 1000], { ...heavy, sleepHours: 4 })!;
    expect(rested.fatGrams).toBeGreaterThan(tired.fatGrams);
  });
  it("burns more fat at higher body weight over the same distance", () => {
    const pts = [tp(0, 145), tp(60, 145)];
    const heavier = fuelEnergy(pts, [0, 1000], { ...heavy, weightKg: 90 })!;
    const lighter = fuelEnergy(pts, [0, 1000], { ...heavy, weightKg: 60 })!;
    expect(heavier.fatGrams).toBeGreaterThan(lighter.fatGrams);
  });
  it("applies the female substrate uplift at equal relative intensity", () => {
    // Same %HRR for both: feed each their own 65%-HRR heart rate so the maxHr
    // difference is normalised out and only the +0.05 fat uplift remains.
    const hrAt = (p: Profile) => Math.round(p.restingHr + 0.65 * (maxHr(p.age, p.sex) - p.restingHr));
    const fProf: Profile = { ...heavy, sex: "female" };
    const mProf: Profile = { ...heavy, sex: "male" };
    const female = fuelEnergy([tp(0, hrAt(fProf)), tp(60, hrAt(fProf))], [0, 1000], fProf)!;
    const male = fuelEnergy([tp(0, hrAt(mProf)), tp(60, hrAt(mProf))], [0, 1000], mProf)!;
    expect(female.fatGrams).toBeGreaterThan(male.fatGrams);
  });
});

describe("fatMassGrams", () => {
  it("is weight × body-fat fraction, in grams", () => {
    expect(fatMassGrams(70, 25)).toBeCloseTo(70 * 0.25 * 1000, 3); // 17500 g
  });
});

describe("fatLossPlan", () => {
  it("counts runs (ceil) and weeks to burn the target fat", () => {
    const p = fatLossPlan(2100, 20, 4); // 2100 g target, 20 g/run, 4 runs/wk
    expect(p.runs).toBe(105);
    expect(p.weeks).toBeCloseTo(26.25, 4);
  });
  it("returns Infinity when nothing is burned per run", () => {
    const p = fatLossPlan(2100, 0, 4);
    expect(p.runs).toBe(Infinity);
    expect(p.weeks).toBe(Infinity);
  });
});

describe("dynamicFatLossPlan", () => {
  it("needs at least as many runs as the static plan (burn slows as weight drops)", () => {
    const target = 2100;
    const stat = fatLossPlan(target, 20, 4);
    const dyn = dynamicFatLossPlan(target, 20, 70, 4);
    expect(dyn.runs).toBeGreaterThanOrEqual(stat.runs);
    expect(dyn.endWeightKg).toBeLessThan(70);
    expect(dyn.endWeightKg).toBeGreaterThan(60);
  });

  it("loses exactly the burned fat from body weight", () => {
    // small target hit in one run: 20 g burned -> 0.02 kg off
    const dyn = dynamicFatLossPlan(10, 20, 70, 4);
    expect(dyn.runs).toBe(1);
    expect(dyn.endWeightKg).toBeCloseTo(70 - 20 / 1000, 6);
  });

  it("returns Infinity when nothing is burned per run", () => {
    const dyn = dynamicFatLossPlan(2100, 0, 70, 4);
    expect(dyn.runs).toBe(Infinity);
    expect(dyn.weeks).toBe(Infinity);
    expect(dyn.endWeightKg).toBe(70);
  });
});
