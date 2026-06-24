import { describe, it, expect } from "vitest";
import { characterizeRun } from "../characterize";
import { cumulativeDistances } from "../geo";
import type { TrackPoint } from "../types";
import type { Profile } from "../karvonen";

const profile: Profile = { age: 30, restingHr: 60 };
// maxHr=191.8, HRR=131.8 → zone3 lower≈152.26, upper≈165.44 → hr 160 = zone3 "Tempo"

function makePoint(
  lat: number,
  lon: number,
  ele: number | null,
  time: Date,
  hr: number | null,
): TrackPoint {
  return { lat, lon, ele, time, hr };
}

describe("characterizeRun", () => {
  it("Morning + Tempo: start hour 8, all hr=160 → title starts with Morning and contains Tempo", () => {
    const t0 = new Date(2026, 0, 1, 8, 0, 0);
    const t1 = new Date(2026, 0, 1, 8, 5, 0);
    const points: TrackPoint[] = [
      makePoint(51.5, -0.1, 10, t0, 160),
      makePoint(51.5, -0.09, 10, t1, 160),
    ];
    const cumulative = cumulativeDistances(points);
    const title = characterizeRun(points, cumulative, profile);
    expect(title).toMatch(/^Morning/);
    expect(title).toContain("Tempo");
  });

  it("Evening: start hour 19 → title starts with Evening", () => {
    const t0 = new Date(2026, 0, 1, 19, 0, 0);
    const t1 = new Date(2026, 0, 1, 19, 5, 0);
    const points: TrackPoint[] = [
      makePoint(51.5, -0.1, 10, t0, 160),
      makePoint(51.5, -0.09, 10, t1, 160),
    ];
    const cumulative = cumulativeDistances(points);
    const title = characterizeRun(points, cumulative, profile);
    expect(title).toMatch(/^Evening/);
  });

  it("Distance appended: ~1km route → title contains 'km' with correct distance", () => {
    const t0 = new Date(2026, 0, 1, 8, 0, 0);
    const t1 = new Date(2026, 0, 1, 8, 10, 0);
    // ~1.11 km apart (1 degree lat ≈ 111 km → 0.01 deg ≈ 1.11 km)
    const points: TrackPoint[] = [
      makePoint(51.5, -0.1, 10, t0, 160),
      makePoint(51.51, -0.1, 10, t1, 160),
    ];
    const cumulative = cumulativeDistances(points);
    const title = characterizeRun(points, cumulative, profile);
    expect(title).toContain("km");
    const kmValue = (cumulative[cumulative.length - 1] / 1000).toFixed(1);
    expect(title).toContain(kmValue);
  });

  it("Hilly: elevation rising >200m total gain → title contains Hilly", () => {
    const t0 = new Date(2026, 0, 1, 8, 0, 0);
    const t1 = new Date(2026, 0, 1, 8, 30, 0);
    const points: TrackPoint[] = [
      makePoint(51.5, -0.1, 0, t0, 160),
      makePoint(51.5, -0.09, 201, t1, 160),
    ];
    const cumulative = cumulativeDistances(points);
    const title = characterizeRun(points, cumulative, profile);
    expect(title).toContain("Hilly");
  });

  it("Empty points → 'Run'", () => {
    const title = characterizeRun([], [], profile);
    expect(title).toBe("Run");
  });
});
