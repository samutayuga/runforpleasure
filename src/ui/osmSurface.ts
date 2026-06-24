import type { TrackPoint } from "../core/types";

export interface SurfaceSample { distanceM: number; surface: string | null; } // surface = bucket label or null

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Map a raw OSM surface tag to a coarse bucket label.
export function bucket(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (["asphalt", "paved", "concrete", "concrete:plates", "paving_stones", "sett", "chipseal"].includes(s)) return "Paved";
  if (["gravel", "fine_gravel", "compacted", "pebblestone"].includes(s)) return "Gravel";
  if (["ground", "dirt", "earth", "mud"].includes(s)) return "Dirt";
  if (["sand"].includes(s)) return "Sand";
  if (["grass", "grass_paver"].includes(s)) return "Grass";
  if (["wood", "boardwalk"].includes(s)) return "Boardwalk";
  if (["cobblestone", "unhewn_cobblestone"].includes(s)) return "Cobble";
  return "Other";
}

// meters between point p and segment a-b, via local equirectangular projection
function segDistM(p: TrackPoint, a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const lat0 = (p.lat * Math.PI) / 180;
  const mx = (lon: number) => (lon * Math.PI / 180) * Math.cos(lat0) * 6371000;
  const my = (lat: number) => (lat * Math.PI / 180) * 6371000;
  const px = mx(p.lon), py = my(p.lat);
  const ax = mx(a.lon), ay = my(a.lat);
  const bx = mx(b.lon), by = my(b.lat);
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

interface OverpassWay { geometry?: Array<{ lat: number; lon: number }>; tags?: { surface?: string } }

async function queryOverpass(url: string, q: string): Promise<OverpassWay[]> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: q,
    });
    if (!res.ok) return [];
    const data: { elements?: OverpassWay[] } = await res.json();
    return (data.elements ?? []).filter((w) => w.geometry && w.geometry.length >= 2 && w.tags?.surface);
  } catch {
    return [];
  }
}

// Fetch surface category along the route. Returns ~N samples by distance, surface=null where unknown.
// Returns [] on any failure (offline, query error) — caller treats empty as "unavailable".
export async function fetchSurfaceAlongRoute(points: TrackPoint[], cumulative: number[]): Promise<SurfaceSample[]> {
  try {
    if (points.length === 0) return [];
    const lats = points.map((p) => p.lat);
    const lons = points.map((p) => p.lon);
    const south = Math.min(...lats), north = Math.max(...lats);
    const west = Math.min(...lons), east = Math.max(...lons);
    const q = `[out:json][timeout:30];way[highway][surface](${south},${west},${north},${east});out geom;`;

    let ways: OverpassWay[] = [];
    for (const url of ENDPOINTS) {
      ways = await queryOverpass(url, q);
      if (ways.length > 0) break;
    }
    if (ways.length === 0) return [];

    const N = Math.min(80, points.length);
    const step = Math.max(1, Math.floor(points.length / N));
    const out: SurfaceSample[] = [];
    const THRESHOLD = 40; // metres
    for (let i = 0; i < points.length; i += step) {
      const p = points[i];
      let best = Infinity;
      let bestSurface: string | undefined;
      for (const w of ways) {
        const g = w.geometry as Array<{ lat: number; lon: number }>;
        for (let k = 1; k < g.length; k++) {
          const d = segDistM(p, g[k - 1], g[k]);
          if (d < best) { best = d; bestSurface = w.tags?.surface; }
        }
      }
      out.push({ distanceM: cumulative[i], surface: best <= THRESHOLD ? bucket(bestSurface) : null });
    }
    return out;
  } catch {
    return [];
  }
}
