import { describe, it, expect } from "vitest";
import { deriveMetrics } from "../metrics";
import { cumulativeDistances } from "../geo";
import type { Run, TrackPoint } from "../types";

function tp(lat: number, sec: number, hr: number | null): TrackPoint {
  return { lat, lon: 103.75, ele: null, time: new Date(sec * 1000), hr };
}

const run: Run = {
  name: "t",
  points: [tp(1.35, 0, 130), tp(1.351, 60, 145), tp(1.352, 120, 160)],
};
const cum = cumulativeDistances(run.points);
const profile = { age: 30, restingHr: 60 };

describe("deriveMetrics", () => {
  it("reports elapsed seconds at the index", () => {
    expect(deriveMetrics(run, cum, 2, profile).elapsedSec).toBe(120);
  });

  it("reports cumulative distance at the index", () => {
    expect(deriveMetrics(run, cum, 2, profile).distanceMeters).toBeCloseTo(cum[2], 5);
  });

  it("reports hr and Karvonen zone", () => {
    const m = deriveMetrics(run, cum, 1, profile);
    expect(m.hr).toBe(145);
    expect(m.zone).toBe("zone2");
  });

  it("pace is null at the start (zero distance)", () => {
    expect(deriveMetrics(run, cum, 0, profile).paceMinPerKm).toBeNull();
  });
});
