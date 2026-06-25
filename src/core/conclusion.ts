import type { ZoneDistribution } from "./zoneDistribution";
import type { Decoupling } from "./decoupling";

export type Grade = "A" | "B" | "C" | "D";

export interface Conclusion {
  grade: Grade | null;
  verdict: string;
  recommendation: string;
  tone: "good" | "watch" | "act";
}

export function runConclusion(zones: ZoneDistribution, dc: Decoupling): Conclusion {
  const hrMissing = zones.totalSec > 0 ? zones.unknownSec / zones.totalSec : 1;
  if (zones.totalSec === 0 || hrMissing > 0.5) {
    return {
      grade: null,
      verdict: "Incomplete — heart rate mostly missing.",
      recommendation: "Connect a heart-rate strap to grade this run.",
      tone: "watch",
    };
  }

  const aerobicShare = zones.pctByZone.below + zones.pctByZone.zone2;

  const driftPts =
    dc.rating === "good" ? 2 : dc.rating === "moderate" ? 1 : dc.rating === "high" ? 0 : 1;
  const aerobicPts = aerobicShare >= 70 ? 2 : aerobicShare >= 50 ? 1 : 0;
  const penalty = zones.pctByZone.above > 20 ? -1 : 0;
  const score = driftPts + aerobicPts + penalty;
  const grade: Grade = score >= 4 ? "A" : score === 3 ? "B" : score === 2 ? "C" : "D";

  if (dc.rating === "high" || zones.pctByZone.above > 20) {
    return {
      grade,
      verdict: "Ran too hard for base-building.",
      recommendation: "Slow down — start easier and spend more time in Zone 2.",
      tone: "act",
    };
  }
  if (dc.rating === "moderate" || (aerobicShare >= 50 && aerobicShare < 70)) {
    return {
      grade,
      verdict: "Decent aerobic session with some drift.",
      recommendation: "Hold the easy pace longer and ease your start.",
      tone: "watch",
    };
  }
  return {
    grade,
    verdict: "Solid Zone 2 aerobic session.",
    recommendation: "Great base work — repeat it and gradually extend the distance.",
    tone: "good",
  };
}
