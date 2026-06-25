import type { TrackPoint } from "./types";

export type DecouplingRating = "good" | "moderate" | "high";

export interface Decoupling {
  firstEf: number | null;
  secondEf: number | null;
  pct: number | null;
  rating: DecouplingRating | null;
}

const NULL_RESULT: Decoupling = {
  firstEf: null,
  secondEf: null,
  pct: null,
  rating: null,
};

const GUARD_MS = 6 * 60 * 1000;

// Efficiency factor for the index span [from, to] inclusive:
// metres covered divided by Σ(hr · Δt) over pairs whose earlier point has HR.
function ef(points: TrackPoint[], cumulative: number[], from: number, to: number): number | null {
  if (to <= from) return null;
  const meters = cumulative[to] - cumulative[from];
  if (meters <= 0) return null;
  let hrSeconds = 0;
  for (let i = from; i < to; i++) {
    const hr = points[i].hr;
    if (hr === null) continue;
    const dt = (points[i + 1].time.getTime() - points[i].time.getTime()) / 1000;
    hrSeconds += hr * dt;
  }
  if (hrSeconds <= 0) return null;
  return meters / hrSeconds;
}

function rate(pct: number): DecouplingRating {
  if (pct < 5) return "good";
  if (pct < 10) return "moderate";
  return "high";
}

export function decoupling(
  points: TrackPoint[],
  cumulative: number[],
  endIndex?: number,
): Decoupling {
  if (points.length < 3) return NULL_RESULT;
  const last = points.length - 1;
  const end = Math.max(0, Math.min(endIndex ?? last, last));
  if (end < 2) return NULL_RESULT;

  const start = points[0].time.getTime();
  const elapsed = points[end].time.getTime() - start;
  if (elapsed < GUARD_MS) return NULL_RESULT;

  const mid = start + elapsed / 2;
  // midIdx = last index whose time <= mid; first half [0, midIdx], second [midIdx, end]
  let midIdx = 0;
  for (let i = 0; i <= end; i++) {
    if (points[i].time.getTime() <= mid) midIdx = i;
  }
  if (midIdx <= 0 || midIdx >= end) return NULL_RESULT;

  const firstEf = ef(points, cumulative, 0, midIdx);
  const secondEf = ef(points, cumulative, midIdx, end);
  if (firstEf === null || secondEf === null || firstEf <= 0) {
    return { firstEf, secondEf, pct: null, rating: null };
  }

  const pct = ((firstEf - secondEf) / firstEf) * 100;
  return { firstEf, secondEf, pct, rating: rate(pct) };
}
