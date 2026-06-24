import { describe, it, expect } from "vitest";
import { buildElevationProfile } from "../elevation";
import { cumulativeDistances } from "../geo";
import type { TrackPoint } from "../types";

function makePoint(lat: number, lon: number, ele: number | null, hr: number | null = null): TrackPoint {
  return { lat, lon, ele, time: new Date("2024-01-01T00:00:00Z"), hr };
}

const points: TrackPoint[] = [
  makePoint(51.0, 0.0, 100),
  makePoint(51.01, 0.0, 110),
  makePoint(51.02, 0.0, null), // null ele — carry forward
  makePoint(51.03, 0.0, 120),
];

const cumulative = cumulativeDistances(points);

describe("buildElevationProfile", () => {
  it("returns one sample per point (length === points.length)", () => {
    const samples = buildElevationProfile(points, cumulative);
    expect(samples.length).toBe(points.length);
  });

  it("distanceM equals the cumulative distance at each index", () => {
    const samples = buildElevationProfile(points, cumulative);
    for (let i = 0; i < points.length; i++) {
      expect(samples[i].distanceM).toBe(cumulative[i]);
    }
  });

  it("a null ele is filled by the previous known value", () => {
    const samples = buildElevationProfile(points, cumulative);
    // index 2 has null ele; last known was 110 (index 1)
    expect(samples[2].ele).toBe(110);
  });

  it("leading null (before any ele) is filled by the first available ele", () => {
    const leadingNullPoints: TrackPoint[] = [
      makePoint(51.0, 0.0, null),
      makePoint(51.01, 0.0, null),
      makePoint(51.02, 0.0, 200),
      makePoint(51.03, 0.0, 250),
    ];
    const cum = cumulativeDistances(leadingNullPoints);
    const samples = buildElevationProfile(leadingNullPoints, cum);
    // Leading nulls should be filled with the first known ele (200)
    expect(samples[0].ele).toBe(200);
    expect(samples[1].ele).toBe(200);
    expect(samples[2].ele).toBe(200);
    expect(samples[3].ele).toBe(250);
  });
});
