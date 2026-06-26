import { describe, it, expect } from "vitest";
import { fatFraction, intensityFromHr, fuelSplit } from "../fuel";
import type { Profile } from "../karvonen";
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
