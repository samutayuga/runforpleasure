import type { TrackPoint } from "./types";
import { zoneForHr, type Profile, type ZoneId } from "./karvonen";

// Generate a human title describing the run from its trajectory characteristics.
export function characterizeRun(points: TrackPoint[], cumulative: number[], profile: Profile): string {
  if (points.length === 0) return "Run";

  const h = points[0].time.getHours();
  const tod = h < 5 ? "Night" : h < 11 ? "Morning" : h < 17 ? "Afternoon" : h < 21 ? "Evening" : "Night";

  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].ele;
    const b = points[i].ele;
    if (a !== null && b !== null && b > a) gain += b - a;
  }
  const terrain = gain > 200 ? "Hilly" : gain > 80 ? "Rolling" : "";

  const counts: Partial<Record<ZoneId, number>> = {};
  for (const p of points) {
    const z = zoneForHr(p.hr, profile);
    if (z) counts[z] = (counts[z] ?? 0) + 1;
  }
  let dom: ZoneId | null = null;
  let max = 0;
  (Object.keys(counts) as ZoneId[]).forEach((k) => {
    const c = counts[k] ?? 0;
    if (c > max) { max = c; dom = k; }
  });
  const intensity =
    dom === "below" ? "Recovery" :
    dom === "zone2" ? "Aerobic" :
    dom === "zone3" ? "Tempo" :
    dom === "above" ? "Hard" : "Easy";

  const km = (cumulative[cumulative.length - 1] ?? 0) / 1000;
  const parts = [tod, terrain, intensity, "Run"].filter((s) => s.length > 0);
  let title = parts.join(" ");
  if (km >= 0.1) title += ` · ${km.toFixed(1)} km`;
  return title;
}
