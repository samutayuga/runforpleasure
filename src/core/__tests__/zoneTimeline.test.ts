import { describe, it, expect } from "vitest";
import { buildZoneTimeline } from "../zoneTimeline";
import type { TrackPoint } from "../types";
import type { Profile } from "../karvonen";

// profile: maxHr = 211 - 0.64*30 = 191.8 ; HRR = 131.8
// 60% -> 139.08 ; 70% -> 152.26 ; 80% -> 165.44
const profile: Profile = { age: 30, restingHr: 60 };

function tp(sec: number, lon: number, hr: number | null): TrackPoint {
  return { lat: 1.35, lon, ele: null, time: new Date(sec * 1000), hr };
}

// cumulative distances are supplied directly (the function does not compute geo)
describe("buildZoneTimeline", () => {
  it("maps each zone to its level with distance and elapsed time", () => {
    const points = [tp(0, 103.75, 120), tp(60, 103.76, 145), tp(120, 103.77, 160), tp(180, 103.78, 170)];
    const cumulative = [0, 100, 250, 500];
    const out = buildZoneTimeline(points, cumulative, profile);
    expect(out.map((p) => p.zone)).toEqual(["below", "zone2", "zone3", "above"]);
    expect(out.map((p) => p.level)).toEqual([0, 1, 2, 3]);
    expect(out.map((p) => p.distanceM)).toEqual([0, 100, 250, 500]);
    expect(out.map((p) => p.elapsedSec)).toEqual([0, 60, 120, 180]);
  });

  it("skips points with no heart rate", () => {
    const points = [tp(0, 103.75, 145), tp(60, 103.76, null), tp(120, 103.77, 160)];
    const cumulative = [0, 100, 200];
    const out = buildZoneTimeline(points, cumulative, profile);
    expect(out.map((p) => p.zone)).toEqual(["zone2", "zone3"]);
    expect(out.map((p) => p.distanceM)).toEqual([0, 200]);
  });

  it("downsamples to <= maxSamples and always keeps the last point", () => {
    const points: TrackPoint[] = [];
    const cumulative: number[] = [];
    for (let i = 0; i < 1000; i++) {
      points.push(tp(i, 103.75 + i * 0.0001, 150));
      cumulative.push(i * 10);
    }
    const out = buildZoneTimeline(points, cumulative, profile, 240);
    expect(out.length).toBeLessThanOrEqual(241);
    expect(out[out.length - 1].distanceM).toBe(cumulative[999]);
  });

  it("returns an empty array for no points", () => {
    expect(buildZoneTimeline([], [], profile)).toEqual([]);
  });
});
