import { describe, it, expect } from "vitest";
import { haversineMeters, cumulativeDistances, paceMinPerKm } from "../geo";
import type { TrackPoint } from "../types";

function tp(lat: number, lon: number): TrackPoint {
  return { lat, lon, ele: null, time: new Date(0), hr: null };
}

describe("haversineMeters", () => {
  it("matches a known ~111.2m-per-0.001deg latitude step", () => {
    const d = haversineMeters({ lat: 1.35, lon: 103.75 }, { lat: 1.351, lon: 103.75 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it("is zero for identical points", () => {
    expect(haversineMeters({ lat: 1.35, lon: 103.75 }, { lat: 1.35, lon: 103.75 })).toBe(0);
  });
});

describe("cumulativeDistances", () => {
  it("starts at zero and grows monotonically", () => {
    const cum = cumulativeDistances([tp(1.35, 103.75), tp(1.351, 103.75), tp(1.352, 103.75)]);
    expect(cum).toHaveLength(3);
    expect(cum[0]).toBe(0);
    expect(cum[1]).toBeGreaterThan(0);
    expect(cum[2]).toBeGreaterThan(cum[1]);
  });
});

describe("paceMinPerKm", () => {
  it("computes 5 min/km for 1000m in 300s", () => {
    expect(paceMinPerKm(1000, 300)).toBeCloseTo(5, 5);
  });

  it("returns null for zero distance", () => {
    expect(paceMinPerKm(0, 10)).toBeNull();
  });
});
