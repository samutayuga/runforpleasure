import { XMLParser } from "fast-xml-parser";
import type { Run, TrackPoint } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function parseGpx(xml: string): Run {
  const doc = parser.parse(xml);
  const trk = doc?.gpx?.trk ?? {};
  const seg = trk.trkseg ?? {};
  const rawPoints = Array.isArray(seg.trkpt) ? seg.trkpt : seg.trkpt ? [seg.trkpt] : [];

  const points: TrackPoint[] = rawPoints.map((pt: Record<string, unknown>) => {
    const ext = (pt.extensions as Record<string, unknown>) ?? {};
    const tpx = (ext["gpxtpx:TrackPointExtension"] as Record<string, unknown>) ?? {};
    return {
      lat: Number(pt["@_lat"]),
      lon: Number(pt["@_lon"]),
      ele: num(pt.ele),
      time: new Date(String(pt.time)),
      hr: num(tpx["gpxtpx:hr"]),
    };
  });

  return { name: String(trk.name ?? "Untitled Run"), points };
}
