import { describe, it, expect } from "vitest";
import { runConclusion } from "../conclusion";
import type { ZoneDistribution } from "../zoneDistribution";
import type { Decoupling } from "../decoupling";

function zones(over: Partial<ZoneDistribution> = {}): ZoneDistribution {
  return {
    secondsByZone: { below: 0, zone2: 0, zone3: 0, above: 0 },
    pctByZone: { below: 0, zone2: 0, zone3: 0, above: 0 },
    unknownSec: 0,
    totalSec: 1000,
    ...over,
  };
}

function dc(rating: Decoupling["rating"]): Decoupling {
  return { firstEf: 1, secondEf: 1, pct: rating === null ? null : 5, rating };
}

describe("runConclusion grade", () => {
  it("grades A for low drift and a strongly aerobic run", () => {
    // drift good(2) + aerobic 80 (>=70 -> 2) + no penalty = 4
    const c = runConclusion(zones({ pctByZone: { below: 30, zone2: 50, zone3: 20, above: 0 } }), dc("good"));
    expect(c.grade).toBe("A");
    expect(c.tone).toBe("good");
  });

  it("grades B for good drift with moderate aerobic share", () => {
    // drift good(2) + aerobic 60 (>=50 -> 1) = 3
    const c = runConclusion(zones({ pctByZone: { below: 20, zone2: 40, zone3: 40, above: 0 } }), dc("good"));
    expect(c.grade).toBe("B");
    expect(c.tone).toBe("watch"); // aerobicShare in [50,70)
  });

  it("grades C for good drift but low aerobic share", () => {
    // drift good(2) + aerobic 40 (<50 -> 0) = 2
    const c = runConclusion(zones({ pctByZone: { below: 20, zone2: 20, zone3: 60, above: 0 } }), dc("good"));
    expect(c.grade).toBe("C");
    expect(c.tone).toBe("good");
  });

  it("grades D for high drift and low aerobic share", () => {
    // drift high(0) + aerobic 30 (0) = 0
    const c = runConclusion(zones({ pctByZone: { below: 10, zone2: 20, zone3: 70, above: 0 } }), dc("high"));
    expect(c.grade).toBe("D");
    expect(c.tone).toBe("act");
  });
});

describe("runConclusion verdict/tone", () => {
  it("flags too-hard when above Zone 3 exceeds 20%", () => {
    const c = runConclusion(zones({ pctByZone: { below: 10, zone2: 20, zone3: 30, above: 40 } }), dc("good"));
    expect(c.tone).toBe("act");
    expect(c.verdict).toContain("too hard");
  });

  it("flags drift as a watch for moderate decoupling", () => {
    const c = runConclusion(zones({ pctByZone: { below: 40, zone2: 40, zone3: 20, above: 0 } }), dc("moderate"));
    expect(c.tone).toBe("watch");
    expect(c.verdict).toContain("some drift");
  });

  it("praises a solid aerobic session", () => {
    const c = runConclusion(zones({ pctByZone: { below: 30, zone2: 50, zone3: 20, above: 0 } }), dc("good"));
    expect(c.tone).toBe("good");
    expect(c.verdict).toContain("Solid");
  });
});

describe("runConclusion insufficient data", () => {
  it("returns no grade when there is no timed data", () => {
    const c = runConclusion(zones({ totalSec: 0 }), dc("good"));
    expect(c.grade).toBeNull();
    expect(c.verdict).toContain("Incomplete");
    expect(c.tone).toBe("watch");
  });

  it("returns no grade when HR is missing for more than half the run", () => {
    const c = runConclusion(
      zones({ unknownSec: 600, totalSec: 1000, pctByZone: { below: 20, zone2: 20, zone3: 0, above: 0 } }),
      dc("good"),
    );
    expect(c.grade).toBeNull();
  });

  it("always provides a non-empty verdict and recommendation", () => {
    for (const r of ["good", "moderate", "high", null] as Decoupling["rating"][]) {
      const c = runConclusion(zones({ pctByZone: { below: 25, zone2: 25, zone3: 25, above: 25 } }), dc(r));
      expect(c.verdict.length).toBeGreaterThan(0);
      expect(c.recommendation.length).toBeGreaterThan(0);
    }
  });
});
