import { describe, it, expect } from "vitest";
import { maxHr, hrr, effectiveHrr, zoneBoundaryHr, zoneForHr } from "../karvonen";

const profile = { age: 30, restingHr: 60 };
// maxHr = 211 - 0.64*30 = 191.8 ; HRR = 191.8 - 60 = 131.8
// 60% -> 0.6*131.8 + 60 = 139.08 ; 70% -> 152.26 ; 80% -> 165.44

describe("karvonen formulas", () => {
  it("maxHr", () => {
    expect(maxHr(30)).toBeCloseTo(191.8, 5);
  });
  it("hrr", () => {
    expect(hrr(profile)).toBeCloseTo(131.8, 5);
  });
  it("zone boundary at 60%", () => {
    expect(zoneBoundaryHr(profile, 0.6)).toBeCloseTo(139.08, 2);
  });
});

describe("zoneForHr", () => {
  it("below zone 2", () => {
    expect(zoneForHr(120, profile)).toBe("below");
  });
  it("inside zone 2", () => {
    expect(zoneForHr(145, profile)).toBe("zone2");
  });
  it("inside zone 3", () => {
    expect(zoneForHr(160, profile)).toBe("zone3");
  });
  it("above zone 3", () => {
    expect(zoneForHr(170, profile)).toBe("above");
  });
  it("null hr yields null zone", () => {
    expect(zoneForHr(null, profile)).toBeNull();
  });
  it("lower boundary is inclusive (60% -> zone2)", () => {
    expect(zoneForHr(zoneBoundaryHr(profile, 0.6), profile)).toBe("zone2");
  });
});

describe("effectiveHrr (readiness)", () => {
  it("equals raw HRR when rested (no sleepHours)", () => {
    expect(effectiveHrr(profile)).toBeCloseTo(hrr(profile), 5);
  });
  it("equals raw HRR at 7h+ sleep", () => {
    expect(effectiveHrr({ ...profile, sleepHours: 8 })).toBeCloseTo(hrr(profile), 5);
  });
  it("is larger than raw HRR when under-slept", () => {
    const tired = { ...profile, sleepHours: 4 };
    expect(effectiveHrr(tired)).toBeGreaterThan(hrr(tired));
  });
});

describe("zoneForHr under low sleep", () => {
  it("reads one zone easier when tired", () => {
    // rested HRR = 131.8 ; z3 lower boundary = 0.7*131.8 + 60 = 152.26
    const hrAt = zoneBoundaryHr(profile, 0.7) + 1; // just inside zone3 when rested
    expect(zoneForHr(hrAt, profile)).toBe("zone3");
    expect(zoneForHr(hrAt, { ...profile, sleepHours: 4 })).toBe("zone2");
  });
});
