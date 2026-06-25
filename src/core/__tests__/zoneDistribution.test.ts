import { describe, it, expect } from "vitest";
import { zoneDistribution } from "../zoneDistribution";
import type { TrackPoint } from "../types";
import type { Profile } from "../karvonen";

// profile: maxHr = 211 - 0.64*30 = 191.8 ; HRR = 131.8
// 60% -> 139.08 ; 70% -> 152.26 ; 80% -> 165.44
const profile: Profile = { age: 30, restingHr: 60 };

function tp(sec: number, hr: number | null): TrackPoint {
  return { lat: 1.35, lon: 103.75, ele: null, time: new Date(sec * 1000), hr };
}

describe("zoneDistribution", () => {
  it("attributes dwell to the earlier point's zone", () => {
    // pairs: [0->60] hr120=below, [60->120] hr145=zone2, [120->180] hr160=zone3
    const pts = [tp(0, 120), tp(60, 145), tp(120, 160), tp(180, 170)];
    const d = zoneDistribution(pts, profile);
    expect(d.secondsByZone.below).toBe(60);
    expect(d.secondsByZone.zone2).toBe(60);
    expect(d.secondsByZone.zone3).toBe(60);
    expect(d.secondsByZone.above).toBe(0);
    expect(d.totalSec).toBe(180);
    expect(d.unknownSec).toBe(0);
  });

  it("counts null-HR dwell as unknown, not a zone", () => {
    const pts = [tp(0, null), tp(60, 145)];
    const d = zoneDistribution(pts, profile);
    expect(d.unknownSec).toBe(60);
    expect(d.secondsByZone.zone2).toBe(0);
    expect(d.totalSec).toBe(60);
  });

  it("pct (zones + unknown) sums to ~100 when total > 0", () => {
    const pts = [tp(0, 120), tp(60, 145), tp(120, null), tp(180, 170)];
    const d = zoneDistribution(pts, profile);
    const zonesPct =
      d.pctByZone.below + d.pctByZone.zone2 + d.pctByZone.zone3 + d.pctByZone.above;
    const unknownPct = (d.unknownSec / d.totalSec) * 100;
    expect(zonesPct + unknownPct).toBeCloseTo(100, 5);
  });

  it("honours endIndex slice (stops accumulation)", () => {
    const pts = [tp(0, 120), tp(60, 145), tp(120, 160), tp(180, 170)];
    const d = zoneDistribution(pts, profile, 1); // only pair [0->60]
    expect(d.totalSec).toBe(60);
    expect(d.secondsByZone.below).toBe(60);
    expect(d.secondsByZone.zone2).toBe(0);
  });

  it("returns all zeros for fewer than two points", () => {
    const d = zoneDistribution([tp(0, 150)], profile);
    expect(d.totalSec).toBe(0);
    expect(d.pctByZone.zone2).toBe(0);
    expect(d.unknownSec).toBe(0);
  });
});
