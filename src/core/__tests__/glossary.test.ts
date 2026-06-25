import { describe, it, expect } from "vitest";
import { ZONE_INFO, DRIFT_BANDS, DRIFT_INTRO } from "../glossary";
import type { ZoneId } from "../karvonen";
import type { DecouplingRating } from "../decoupling";

describe("glossary content", () => {
  it("covers exactly the four zones in canonical order", () => {
    const ids = ZONE_INFO.map((z) => z.id);
    expect(ids).toEqual<ZoneId[]>(["below", "zone2", "zone3", "above"]);
  });

  it("covers exactly the three drift ratings in order", () => {
    const ratings = DRIFT_BANDS.map((b) => b.rating);
    expect(ratings).toEqual<DecouplingRating[]>(["good", "moderate", "high"]);
  });

  it("gives every zone a non-empty label, range, fuel, and meaning", () => {
    for (const z of ZONE_INFO) {
      expect(z.label.length).toBeGreaterThan(0);
      expect(z.range.length).toBeGreaterThan(0);
      expect(z.fuel.length).toBeGreaterThan(0);
      expect(z.meaning.length).toBeGreaterThan(0);
    }
  });

  it("gives every drift band a non-empty range and meaning", () => {
    for (const b of DRIFT_BANDS) {
      expect(b.range.length).toBeGreaterThan(0);
      expect(b.meaning.length).toBeGreaterThan(0);
    }
  });

  it("mentions the carb/fat fuel split across the zones", () => {
    const fuels = ZONE_INFO.map((z) => z.fuel.toLowerCase()).join(" ");
    expect(fuels).toContain("fat");
    expect(fuels).toContain("carb");
  });

  it("has a non-empty drift intro", () => {
    expect(DRIFT_INTRO.length).toBeGreaterThan(0);
  });
});
