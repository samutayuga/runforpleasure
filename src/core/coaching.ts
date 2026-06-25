import type { ZoneDistribution } from "./zoneDistribution";
import type { Decoupling } from "./decoupling";

export type InsightSeverity = "good" | "watch" | "act";

export interface Insight {
  headline: string;
  detail: string;
  severity: InsightSeverity;
}

export function runInsights(zones: ZoneDistribution, dc: Decoupling): Insight[] {
  const out: Insight[] = [];

  if (dc.pct !== null) {
    const n = Math.round(dc.pct);
    if (dc.pct >= 10) {
      out.push({
        severity: "act",
        headline: `High cardiac drift (+${n}%)`,
        detail: "HR climbed late in the run. Start easier and add slow Zone 2 volume.",
      });
    } else if (dc.pct >= 5) {
      out.push({
        severity: "watch",
        headline: `Mild cardiac drift (+${n}%)`,
        detail: "Aerobic base is building. Keep easy days genuinely easy.",
      });
    } else {
      out.push({
        severity: "good",
        headline: `Strong aerobic coupling (${n}%)`,
        detail: "Efficiency held across the run — well paced.",
      });
    }
  }

  if (zones.pctByZone.above > 20) {
    out.push({
      severity: "act",
      headline: `${Math.round(zones.pctByZone.above)}% above Zone 3`,
      detail: "Too hard for base-building. Slow down to spend more time in Zone 2.",
    });
  }

  if (zones.pctByZone.zone2 >= 60) {
    out.push({
      severity: "good",
      headline: `${Math.round(zones.pctByZone.zone2)}% in Zone 2`,
      detail: "Textbook aerobic session — this builds your engine.",
    });
  }

  if (zones.totalSec > 0 && zones.unknownSec / zones.totalSec > 0.2) {
    out.push({
      severity: "watch",
      headline: `HR missing for ${Math.round((zones.unknownSec / zones.totalSec) * 100)}% of the run`,
      detail: "Connect a strap for accurate zones and drift.",
    });
  }

  return out;
}
