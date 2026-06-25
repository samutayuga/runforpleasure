export type TrendArrow = "up" | "flat" | "down";

export function gaugeFraction(pct: number | null, cap = 15): number {
  if (pct === null) return 0;
  return Math.min(Math.abs(pct), cap) / cap;
}

export function trendArrow(pct: number | null): TrendArrow {
  if (pct === null) return "flat";
  if (pct > 0.5) return "up";
  if (pct < -0.5) return "down";
  return "flat";
}
