import { describe, it, expect } from "vitest";
import { decoupling } from "../decoupling";
import { cumulativeDistances } from "../geo";
import type { TrackPoint } from "../types";

// Build a straight eastward track: each step advances lon so distance grows
// evenly. dtSec between samples is constant; hr is set per sample.
function track(hrs: (number | null)[], dtSec = 60, lonStep = 0.001): TrackPoint[] {
  return hrs.map((hr, i) => ({
    lat: 1.35,
    lon: 103.75 + i * lonStep,
    ele: null,
    time: new Date(i * dtSec * 1000),
    hr,
  }));
}

describe("decoupling", () => {
  it("is ~0% and good when HR and pace are flat over a long run", () => {
    // 20 samples * 60s = 19 min total; constant hr + constant spacing
    const pts = track(new Array(20).fill(150));
    const d = decoupling(pts, cumulativeDistances(pts));
    expect(d.pct).not.toBeNull();
    expect(Math.abs(d.pct as number)).toBeLessThan(1);
    expect(d.rating).toBe("good");
  });

  it("is positive (drift) when HR rises in the second half at equal pace", () => {
    // first half hr 140, second half hr 168 -> EF drops -> positive pct
    const hrs = [...new Array(10).fill(140), ...new Array(10).fill(168)];
    const pts = track(hrs);
    const d = decoupling(pts, cumulativeDistances(pts));
    expect(d.pct as number).toBeGreaterThan(10);
    expect(d.rating).toBe("high");
  });

  it("rates the moderate band", () => {
    // tune second-half hr so pct lands in [5,10): 150 -> ~159 ~ 5.6%
    const hrs = [...new Array(10).fill(150), ...new Array(10).fill(159)];
    const pts = track(hrs);
    const d = decoupling(pts, cumulativeDistances(pts));
    expect(d.pct as number).toBeGreaterThanOrEqual(5);
    expect(d.pct as number).toBeLessThan(10);
    expect(d.rating).toBe("moderate");
  });

  it("rates improvement (negative pct) as good", () => {
    const hrs = [...new Array(10).fill(168), ...new Array(10).fill(140)];
    const pts = track(hrs);
    const d = decoupling(pts, cumulativeDistances(pts));
    expect(d.pct as number).toBeLessThan(0);
    expect(d.rating).toBe("good");
  });

  it("returns all null below the 6-minute guard", () => {
    const pts = track(new Array(20).fill(150));
    // endIndex 4 -> elapsed 4*60s = 4 min < 6 min
    const d = decoupling(pts, cumulativeDistances(pts), 4);
    expect(d.pct).toBeNull();
    expect(d.rating).toBeNull();
    expect(d.firstEf).toBeNull();
  });

  it("returns null pct when a half has no HR", () => {
    const hrs = [...new Array(10).fill(null), ...new Array(10).fill(150)];
    const pts = track(hrs as (number | null)[]);
    const d = decoupling(pts, cumulativeDistances(pts));
    expect(d.firstEf).toBeNull();
    expect(d.pct).toBeNull();
    expect(d.rating).toBeNull();
  });
});
