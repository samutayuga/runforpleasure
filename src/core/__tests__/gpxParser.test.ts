import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseGpx } from "../gpxParser";

const xml = readFileSync("assets/Morning_Run.gpx", "utf8");

describe("parseGpx", () => {
  const run = parseGpx(xml);

  it("reads the track name", () => {
    expect(run.name).toBe("Morning Run");
  });

  it("reads all track points", () => {
    expect(run.points.length).toBe(6381);
  });

  it("parses the first point lat/lon/ele/time/hr", () => {
    const p = run.points[0];
    expect(p.lat).toBeCloseTo(1.3525410, 6);
    expect(p.lon).toBeCloseTo(103.7562650, 6);
    expect(p.ele).toBeCloseTo(36.5, 1);
    expect(p.time.toISOString()).toBe("2026-06-20T22:41:55.000Z");
    expect(p.hr).toBe(161);
  });

  it("parses the last point time and hr", () => {
    const p = run.points[run.points.length - 1];
    expect(p.time.toISOString()).toBe("2026-06-21T00:29:15.000Z");
    expect(p.hr).toBe(167);
  });
});
