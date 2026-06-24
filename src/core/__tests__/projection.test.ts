import { describe, it, expect } from "vitest";
import { projectRoute } from "../projection";
import type { TrackPoint } from "../types";

function tp(lat: number, lon: number): TrackPoint {
  return { lat, lon, ele: null, time: new Date(0), hr: null };
}

const pts = [tp(1.350, 103.750), tp(1.352, 103.752), tp(1.351, 103.751)];

describe("projectRoute", () => {
  const xy = projectRoute(pts, 200, 200, 10);

  it("returns one XY per point", () => {
    expect(xy).toHaveLength(3);
  });

  it("keeps every point inside the padded box", () => {
    for (const p of xy) {
      expect(p.x).toBeGreaterThanOrEqual(10);
      expect(p.x).toBeLessThanOrEqual(190);
      expect(p.y).toBeGreaterThanOrEqual(10);
      expect(p.y).toBeLessThanOrEqual(190);
    }
  });

  it("puts higher latitude at a smaller y (north is up)", () => {
    // pts[1] has the highest lat -> smallest y
    expect(xy[1].y).toBeLessThan(xy[0].y);
  });
});
