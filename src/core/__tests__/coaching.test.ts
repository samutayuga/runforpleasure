import { describe, it, expect } from "vitest";
import { runInsights } from "../coaching";
import type { ZoneDistribution } from "../zoneDistribution";
import type { Decoupling } from "../decoupling";

function zones(over: Partial<ZoneDistribution> = {}): ZoneDistribution {
  return {
    secondsByZone: { below: 0, zone2: 0, zone3: 0, above: 0 },
    pctByZone: { below: 0, zone2: 0, zone3: 0, above: 0 },
    unknownSec: 0,
    totalSec: 0,
    ...over,
  };
}

function dc(pct: number | null): Decoupling {
  if (pct === null) return { firstEf: null, secondEf: null, pct: null, rating: null };
  const rating = pct < 5 ? "good" : pct < 10 ? "moderate" : "high";
  return { firstEf: 1, secondEf: 1, pct, rating };
}

describe("runInsights", () => {
  it("flags high drift as an action", () => {
    const out = runInsights(zones(), dc(12));
    expect(out.some((i) => i.severity === "act" && i.headline.includes("+12%"))).toBe(true);
  });

  it("flags mild drift as a watch", () => {
    const out = runInsights(zones(), dc(7));
    expect(out.some((i) => i.severity === "watch" && i.headline.includes("+7%"))).toBe(true);
  });

  it("praises strong coupling", () => {
    const out = runInsights(zones(), dc(2));
    expect(out.some((i) => i.severity === "good" && i.headline.includes("coupling"))).toBe(true);
  });

  it("drift bands are mutually exclusive", () => {
    const drift = runInsights(zones(), dc(12)).filter((i) => i.headline.includes("drift") || i.headline.includes("coupling"));
    expect(drift).toHaveLength(1);
  });

  it("zone rules co-fire with the drift rule", () => {
    const out = runInsights(
      zones({ pctByZone: { below: 0, zone2: 0, zone3: 0, above: 30 }, totalSec: 100 }),
      dc(12),
    );
    expect(out.some((i) => i.headline.includes("above Zone 3"))).toBe(true);
    expect(out.some((i) => i.headline.includes("drift"))).toBe(true);
  });

  it("praises a Zone 2 dominant session", () => {
    const out = runInsights(
      zones({ pctByZone: { below: 0, zone2: 65, zone3: 0, above: 0 }, totalSec: 100 }),
      dc(null),
    );
    expect(out.some((i) => i.severity === "good" && i.headline.includes("Zone 2"))).toBe(true);
  });

  it("warns when HR is mostly missing", () => {
    const out = runInsights(zones({ unknownSec: 30, totalSec: 100 }), dc(null));
    expect(out.some((i) => i.headline.includes("HR missing"))).toBe(true);
  });

  it("returns nothing for empty/degenerate input", () => {
    expect(runInsights(zones(), dc(null))).toHaveLength(0);
  });
});
