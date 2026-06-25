# Run Analysis (Aerobic Decoupling + Zone Distribution) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn parsed run data into zone-distribution + aerobic-decoupling analyses and plain-language coaching, surfaced live during replay and in a post-run summary.

**Architecture:** Three new pure-TypeScript `core/` modules (`zoneDistribution`, `decoupling`, `coaching`), each vitest-TDD'd, consumed by two thin `ui/` surfaces — a live strip in the existing `Dashboard` and a new `RunSummary` shown when `ReplayEngine.finished`. Live and summary share one code path: live passes an `endIndex` slice (`engine.index`); summary omits it (full run).

**Tech Stack:** TypeScript (strict), vitest (core tests), Expo / React Native + react-native-svg + react-native-paper (UI), existing `core/karvonen` + `core/geo` + `core/format` + `ui/theme`.

## Global Constraints

- TypeScript strict mode on; no `any` in committed code.
- `core/` modules MUST NOT import from `react`, `react-native`, `expo`, or `ui/`. Core stays pure and platform-agnostic.
- No new dependencies.
- Reuse the existing 4 zone buckets: `ZoneId = "below" | "zone2" | "zone3" | "above"` from `src/core/karvonen.ts`. No new zone model, no new colors.
- Reuse `ZONE_THEME` (`src/ui/theme.ts`), `zoneForHr`/`Profile` (`src/core/karvonen.ts`), `cumulativeDistances` (`src/core/geo.ts`), `formatDuration` (`src/core/format.ts`), `ReplayEngine.index`/`.finished` (`src/core/replayEngine.ts`).
- Accessibility: zone conveyed by color **and** icon/label, never color alone.
- UI return types use `React.JSX.Element` (the project dropped the global `JSX` namespace under @types/react v19).
- TDD: failing test first, run it red, minimal code, run it green, commit — every core task.
- Percentages shown in coaching copy are rounded to integers.

---

### Task 1: Zone distribution (core)

**Files:**
- Create: `src/core/zoneDistribution.ts`
- Test: `src/core/__tests__/zoneDistribution.test.ts`

**Interfaces:**
- Consumes: `TrackPoint` from `./types`; `zoneForHr`, `Profile`, `ZoneId` from `./karvonen`.
- Produces:
  - `interface ZoneDistribution { secondsByZone: Record<ZoneId, number>; pctByZone: Record<ZoneId, number>; unknownSec: number; totalSec: number }`
  - `function zoneDistribution(points: TrackPoint[], profile: Profile, endIndex?: number): ZoneDistribution`
    - Range `[0 .. end]`, `end = endIndex ?? points.length - 1`, clamped to `[0, points.length-1]`.
    - For each consecutive pair `(i, i+1)` in range: `dwell = (points[i+1].time - points[i].time) / 1000` sec, attributed to `zoneForHr(points[i].hr, profile)` — non-null zone adds to `secondsByZone`, null adds to `unknownSec`.
    - `totalSec` = sum of all dwell (zones + unknown). `pctByZone[z] = totalSec > 0 ? secondsByZone[z]/totalSec*100 : 0`.
    - `points.length < 2` or `end === 0` → all zeros, `totalSec === 0`.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/zoneDistribution.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { zoneDistribution } from "../zoneDistribution";
import type { TrackPoint } from "../types";
import type { Profile } from "../karvonen";

// profile: maxHr = 211 - 0.64*30 = 191.8 ; HRR = 131.8
// 60% -> 139.08 ; 70% -> 152.26 ; 80% -> 165.44
const profile: Profile = { age: 30, restingHr: 60 };

function tp(sec: number, hr: number | null): TrackPoint {
  return { lat: 1.35, lon: 103.75, ele: null, time: new Date(sec * 1000), hr };
}

describe("zoneDistribution", () => {
  it("attributes dwell to the earlier point's zone", () => {
    // pairs: [0->60] hr120=below, [60->120] hr145=zone2, [120->180] hr160=zone3
    const pts = [tp(0, 120), tp(60, 145), tp(120, 160), tp(180, 170)];
    const d = zoneDistribution(pts, profile);
    expect(d.secondsByZone.below).toBe(60);
    expect(d.secondsByZone.zone2).toBe(60);
    expect(d.secondsByZone.zone3).toBe(60);
    expect(d.secondsByZone.above).toBe(0);
    expect(d.totalSec).toBe(180);
    expect(d.unknownSec).toBe(0);
  });

  it("counts null-HR dwell as unknown, not a zone", () => {
    const pts = [tp(0, null), tp(60, 145)];
    const d = zoneDistribution(pts, profile);
    expect(d.unknownSec).toBe(60);
    expect(d.secondsByZone.zone2).toBe(0);
    expect(d.totalSec).toBe(60);
  });

  it("pct (zones + unknown) sums to ~100 when total > 0", () => {
    const pts = [tp(0, 120), tp(60, 145), tp(120, null), tp(180, 170)];
    const d = zoneDistribution(pts, profile);
    const zonesPct =
      d.pctByZone.below + d.pctByZone.zone2 + d.pctByZone.zone3 + d.pctByZone.above;
    const unknownPct = (d.unknownSec / d.totalSec) * 100;
    expect(zonesPct + unknownPct).toBeCloseTo(100, 5);
  });

  it("honours endIndex slice (stops accumulation)", () => {
    const pts = [tp(0, 120), tp(60, 145), tp(120, 160), tp(180, 170)];
    const d = zoneDistribution(pts, profile, 1); // only pair [0->60]
    expect(d.totalSec).toBe(60);
    expect(d.secondsByZone.below).toBe(60);
    expect(d.secondsByZone.zone2).toBe(0);
  });

  it("returns all zeros for fewer than two points", () => {
    const d = zoneDistribution([tp(0, 150)], profile);
    expect(d.totalSec).toBe(0);
    expect(d.pctByZone.zone2).toBe(0);
    expect(d.unknownSec).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/zoneDistribution.test.ts`
Expected: FAIL — cannot find module `../zoneDistribution`.

- [ ] **Step 3: Write the implementation**

Create `src/core/zoneDistribution.ts`:
```ts
import type { TrackPoint } from "./types";
import { zoneForHr, type Profile, type ZoneId } from "./karvonen";

export interface ZoneDistribution {
  secondsByZone: Record<ZoneId, number>;
  pctByZone: Record<ZoneId, number>;
  unknownSec: number;
  totalSec: number;
}

export function zoneDistribution(
  points: TrackPoint[],
  profile: Profile,
  endIndex?: number,
): ZoneDistribution {
  const secondsByZone: Record<ZoneId, number> = {
    below: 0,
    zone2: 0,
    zone3: 0,
    above: 0,
  };
  let unknownSec = 0;
  let totalSec = 0;

  if (points.length >= 2) {
    const last = points.length - 1;
    const end = Math.max(0, Math.min(endIndex ?? last, last));
    for (let i = 0; i < end; i++) {
      const dwell = (points[i + 1].time.getTime() - points[i].time.getTime()) / 1000;
      totalSec += dwell;
      const zone = zoneForHr(points[i].hr, profile);
      if (zone === null) unknownSec += dwell;
      else secondsByZone[zone] += dwell;
    }
  }

  const pctByZone: Record<ZoneId, number> = {
    below: totalSec > 0 ? (secondsByZone.below / totalSec) * 100 : 0,
    zone2: totalSec > 0 ? (secondsByZone.zone2 / totalSec) * 100 : 0,
    zone3: totalSec > 0 ? (secondsByZone.zone3 / totalSec) * 100 : 0,
    above: totalSec > 0 ? (secondsByZone.above / totalSec) * 100 : 0,
  };

  return { secondsByZone, pctByZone, unknownSec, totalSec };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/zoneDistribution.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/zoneDistribution.ts src/core/__tests__/zoneDistribution.test.ts
git commit -m "feat: add Karvonen zone-distribution analysis"
```

---

### Task 2: Aerobic decoupling (core)

**Files:**
- Create: `src/core/decoupling.ts`
- Test: `src/core/__tests__/decoupling.test.ts`

**Interfaces:**
- Consumes: `TrackPoint` from `./types`; a precomputed `cumulative` distances array (from `cumulativeDistances` in `./geo`).
- Produces:
  - `type DecouplingRating = "good" | "moderate" | "high"`
  - `interface Decoupling { firstEf: number | null; secondEf: number | null; pct: number | null; rating: DecouplingRating | null }`
  - `function decoupling(points: TrackPoint[], cumulative: number[], endIndex?: number): Decoupling`
    - Range `[0 .. end]`, `end = endIndex ?? points.length - 1`, clamped.
    - `elapsed = points[end].time - points[0].time` (ms); split at `mid = start + elapsed/2` by `time <= mid` (first half) vs `> mid` (second half), as contiguous index spans.
    - EF per half = `meters / hrSeconds`, where `meters = cumulative[lastIdx] - cumulative[firstIdx]` of the half, and `hrSeconds = Σ (hr_earlier · Δt_seconds)` over consecutive pairs in the half whose earlier point has non-null HR. EF is `null` when `hrSeconds <= 0` or `meters <= 0`.
    - `pct = (firstEf - secondEf)/firstEf*100` when both non-null and `firstEf > 0`, else `null`.
    - Rating (only when `pct !== null`): `pct < 5` → `good`; `5 <= pct < 10` → `moderate`; `pct >= 10` → `high`. (Negative pct → `good`.)
    - **Live guard:** return all-null unless `elapsed >= 360000` (6 min) AND both halves yield non-null EF.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/decoupling.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { decoupling } from "../decoupling";
import { cumulativeDistances } from "../geo";
import type { TrackPoint } from "../types";

// Build a straight eastward track: each step advances lon so distance grows
// evenly. dtSec between samples is constant; hr is set per sample.
function track(hrs: (number | null)[], dtSec = 60, lonStep = 0.001): TrackPoint[] {
  return hrs.map((hr, i) => ({
    lat: 1.35,
    lon: 103.75 + i * lonStep,
    ele: null,
    time: new Date(i * dtSec * 1000),
    hr,
  }));
}

describe("decoupling", () => {
  it("is ~0% and good when HR and pace are flat over a long run", () => {
    // 20 samples * 60s = 19 min total; constant hr + constant spacing
    const pts = track(new Array(20).fill(150));
    const d = decoupling(pts, cumulativeDistances(pts));
    expect(d.pct).not.toBeNull();
    expect(Math.abs(d.pct as number)).toBeLessThan(1);
    expect(d.rating).toBe("good");
  });

  it("is positive (drift) when HR rises in the second half at equal pace", () => {
    // first half hr 140, second half hr 168 -> EF drops -> positive pct
    const hrs = [...new Array(10).fill(140), ...new Array(10).fill(168)];
    const pts = track(hrs);
    const d = decoupling(pts, cumulativeDistances(pts));
    expect(d.pct as number).toBeGreaterThan(10);
    expect(d.rating).toBe("high");
  });

  it("rates the moderate band", () => {
    // tune second-half hr so pct lands in [5,10): 150 -> ~157.9 ~ 5%
    const hrs = [...new Array(10).fill(150), ...new Array(10).fill(158)];
    const pts = track(hrs);
    const d = decoupling(pts, cumulativeDistances(pts));
    expect(d.pct as number).toBeGreaterThanOrEqual(5);
    expect(d.pct as number).toBeLessThan(10);
    expect(d.rating).toBe("moderate");
  });

  it("rates improvement (negative pct) as good", () => {
    const hrs = [...new Array(10).fill(168), ...new Array(10).fill(140)];
    const pts = track(hrs);
    const d = decoupling(pts, cumulativeDistances(pts));
    expect(d.pct as number).toBeLessThan(0);
    expect(d.rating).toBe("good");
  });

  it("returns all null below the 6-minute guard", () => {
    const pts = track(new Array(20).fill(150));
    // endIndex 4 -> elapsed 4*60s = 4 min < 6 min
    const d = decoupling(pts, cumulativeDistances(pts), 4);
    expect(d.pct).toBeNull();
    expect(d.rating).toBeNull();
    expect(d.firstEf).toBeNull();
  });

  it("returns null pct when a half has no HR", () => {
    const hrs = [...new Array(10).fill(null), ...new Array(10).fill(150)];
    const pts = track(hrs as (number | null)[]);
    const d = decoupling(pts, cumulativeDistances(pts));
    expect(d.firstEf).toBeNull();
    expect(d.pct).toBeNull();
    expect(d.rating).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/decoupling.test.ts`
Expected: FAIL — cannot find module `../decoupling`.

- [ ] **Step 3: Write the implementation**

Create `src/core/decoupling.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/decoupling.test.ts`
Expected: PASS, 6 tests.

If the "moderate band" test lands outside `[5,10)`, adjust ONLY that test's second-half HR constant (e.g. 156–160) until `pct` falls in band — the production code is correct; the fixture just needs a value that produces a 5–10% drop. Do not change `decoupling.ts` for this.

- [ ] **Step 5: Commit**

```bash
git add src/core/decoupling.ts src/core/__tests__/decoupling.test.ts
git commit -m "feat: add aerobic decoupling (Pa:HR drift) analysis"
```

---

### Task 3: Coaching insights (core)

**Files:**
- Create: `src/core/coaching.ts`
- Test: `src/core/__tests__/coaching.test.ts`

**Interfaces:**
- Consumes: `ZoneDistribution` from `./zoneDistribution` (Task 1); `Decoupling` from `./decoupling` (Task 2).
- Produces:
  - `type InsightSeverity = "good" | "watch" | "act"`
  - `interface Insight { headline: string; detail: string; severity: InsightSeverity }`
  - `function runInsights(zones: ZoneDistribution, dc: Decoupling): Insight[]`
    - Rules, in order; every matching rule emits one Insight. `N` = `Math.round(...)`.
      1. `dc.pct !== null && dc.pct >= 10` → act, `"High cardiac drift (+N%)"` / `"HR climbed late in the run. Start easier and add slow Zone 2 volume."`
      2. `dc.pct !== null && dc.pct >= 5 && dc.pct < 10` → watch, `"Mild cardiac drift (+N%)"` / `"Aerobic base is building. Keep easy days genuinely easy."`
      3. `dc.pct !== null && dc.pct < 5` → good, `"Strong aerobic coupling (N%)"` / `"Efficiency held across the run — well paced."`
      4. `zones.pctByZone.above > 20` → act, `"N% above Zone 3"` / `"Too hard for base-building. Slow down to spend more time in Zone 2."`
      5. `zones.pctByZone.zone2 >= 60` → good, `"N% in Zone 2"` / `"Textbook aerobic session — this builds your engine."`
      6. `zones.totalSec > 0 && zones.unknownSec / zones.totalSec > 0.2` → watch, `"HR missing for N% of the run"` / `"Connect a strap for accurate zones and drift."`
    - Rules 1–3 mutually exclusive (band); 4–6 independent. `N` in rules 1/2 uses `+` prefix; rule 3 uses raw rounded value (no forced `+`).

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/coaching.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/coaching.test.ts`
Expected: FAIL — cannot find module `../coaching`.

- [ ] **Step 3: Write the implementation**

Create `src/core/coaching.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/coaching.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Run the full core suite (no regressions)**

Run: `npm test`
Expected: PASS — all prior suites plus the 3 new ones green.

- [ ] **Step 6: Commit**

```bash
git add src/core/coaching.ts src/core/__tests__/coaching.test.ts
git commit -m "feat: derive coaching insights from zones + decoupling"
```

---

### Task 4: Live analysis strip (UI, in Dashboard)

**Files:**
- Create: `src/ui/AnalysisStrip.tsx`
- Modify: `src/ui/Dashboard.tsx` (render `<AnalysisStrip>` and extend props)
- Modify: `src/ui/RunScreen.tsx` (compute live analyses, pass to Dashboard)

**Interfaces:**
- Consumes: `ZoneDistribution` from `../core/zoneDistribution`; `Decoupling` from `../core/decoupling`; `ZoneId` from `../core/karvonen`; `ZONE_THEME` from `./theme`.
- Produces: `function AnalysisStrip(props: { zones: ZoneDistribution; decoupling: Decoupling }): React.JSX.Element`
  - A horizontal 4-segment stacked bar widthed by `pctByZone` (flex), each segment colored `ZONE_THEME[z].color`; a legend row of `icon + label + N%` per non-zero zone (zone conveyed by icon/label, not color alone); a "Drift" readout showing `+N%` (rounded) or `—` when `decoupling.pct === null`.

- [ ] **Step 1: Implement the component**

Create `src/ui/AnalysisStrip.tsx`:
```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { Decoupling } from "../core/decoupling";
import type { ZoneId } from "../core/karvonen";
import { ZONE_THEME } from "./theme";

const ORDER: ZoneId[] = ["below", "zone2", "zone3", "above"];

export function AnalysisStrip({
  zones,
  decoupling,
}: {
  zones: ZoneDistribution;
  decoupling: Decoupling;
}): React.JSX.Element {
  const drift =
    decoupling.pct === null
      ? "—"
      : `${decoupling.pct >= 0 ? "+" : ""}${Math.round(decoupling.pct)}%`;

  return (
    <View style={styles.wrap} accessibilityLabel="Live run analysis">
      <View style={styles.bar}>
        {ORDER.map((z) => {
          const pct = zones.pctByZone[z];
          if (pct <= 0) return null;
          return (
            <View key={z} style={{ flex: pct, backgroundColor: ZONE_THEME[z].color }} />
          );
        })}
      </View>
      <View style={styles.legend}>
        {ORDER.filter((z) => zones.pctByZone[z] > 0).map((z) => (
          <Text key={z} style={styles.legendItem}>
            {ZONE_THEME[z].icon} {ZONE_THEME[z].label} {Math.round(zones.pctByZone[z])}%
          </Text>
        ))}
      </View>
      <Text style={styles.drift}>Drift {drift}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 6 },
  bar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: "#1E293B" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  legendItem: { fontSize: 11, color: "#94A3B8" },
  drift: { fontSize: 13, color: "#94A3B8", textAlign: "center", fontWeight: "600" },
});
```

- [ ] **Step 2: Extend Dashboard to render the strip**

In `src/ui/Dashboard.tsx`, add the imports near the top (after the existing imports):
```tsx
import { AnalysisStrip } from "./AnalysisStrip";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { Decoupling } from "../core/decoupling";
```

Add two fields to the `Dashboard` parameter object type (the type block currently lists `metrics`, `playing`, `speed`, `startTime`, `endTime`, `weather`, `startPlace`, `endPlace`, and the three `on*` handlers — append these two):
```tsx
  zones: ZoneDistribution;
  decoupling: Decoupling;
```
Add `zones` and `decoupling` to the destructured parameter list at the top of `export function Dashboard({ ... })`. Then render the strip **inside** the `<Surface style={styles.hrCard}>`, immediately after the closing `</View>` of the 3-column `columnsRow` block and immediately before the `{/* Controls row */}` comment / `<View style={styles.controls}>`:
```tsx
      <AnalysisStrip zones={zones} decoupling={decoupling} />
```

- [ ] **Step 3: Compute live analyses in RunScreen and pass them down**

In `src/ui/RunScreen.tsx`, add imports (after the existing core imports):
```tsx
import { zoneDistribution } from "../core/zoneDistribution";
import { decoupling } from "../core/decoupling";
```

After the existing `const metrics = deriveMetrics(run, cumulative, engine.index, profile);` line, add:
```tsx
  const zones = zoneDistribution(run.points, profile, engine.index);
  const dc = decoupling(run.points, cumulative, engine.index);
```

Add the two new props to the existing `<Dashboard ... />` element:
```tsx
        zones={zones}
        decoupling={dc}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/AnalysisStrip.tsx src/ui/Dashboard.tsx src/ui/RunScreen.tsx
git commit -m "feat: live zone-distribution + drift strip on the dashboard"
```

---

### Task 5: Post-run summary screen (UI)

**Files:**
- Create: `src/ui/RunSummary.tsx`
- Modify: `src/ui/RunScreen.tsx` (render summary when `engine.finished`)

**Interfaces:**
- Consumes: `ZoneDistribution` from `../core/zoneDistribution`; `Decoupling` from `../core/decoupling`; `runInsights`/`Insight` from `../core/coaching`; `ZoneId` from `../core/karvonen`; `formatDuration` from `../core/format`; `ZONE_THEME` from `./theme`.
- Produces: `function RunSummary(props: { zones: ZoneDistribution; decoupling: Decoupling; insights: Insight[]; onRestart: () => void }): React.JSX.Element`
  - Full-run stacked zone bar (same shape as the live strip); a per-zone row list (`icon + label + mm:ss + N%`); a decoupling block (`pct` + rating, colored); insight cards (severity → color). A "Run again" button calling `onRestart`.

- [ ] **Step 1: Implement the component**

Create `src/ui/RunSummary.tsx`:
```tsx
import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { Decoupling } from "../core/decoupling";
import type { Insight } from "../core/coaching";
import type { ZoneId } from "../core/karvonen";
import { formatDuration } from "../core/format";
import { ZONE_THEME } from "./theme";

const ORDER: ZoneId[] = ["below", "zone2", "zone3", "above"];

const SEVERITY_COLOR: Record<Insight["severity"], string> = {
  good: "#0E7C7B",
  watch: "#B45309",
  act: "#9D174D",
};

const RATING_COLOR: Record<NonNullable<Decoupling["rating"]>, string> = {
  good: "#0E7C7B",
  moderate: "#B45309",
  high: "#9D174D",
};

export function RunSummary({
  zones,
  decoupling,
  insights,
  onRestart,
}: {
  zones: ZoneDistribution;
  decoupling: Decoupling;
  insights: Insight[];
  onRestart: () => void;
}): React.JSX.Element {
  const driftColor = decoupling.rating ? RATING_COLOR[decoupling.rating] : "#94A3B8";
  const driftText =
    decoupling.pct === null
      ? "Not enough data"
      : `${decoupling.pct >= 0 ? "+" : ""}${Math.round(decoupling.pct)}%  ·  ${decoupling.rating ?? ""}`;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Run analysis</Text>

      <View style={styles.bar}>
        {ORDER.map((z) =>
          zones.pctByZone[z] > 0 ? (
            <View key={z} style={{ flex: zones.pctByZone[z], backgroundColor: ZONE_THEME[z].color }} />
          ) : null,
        )}
      </View>

      <View style={styles.zoneList}>
        {ORDER.map((z) => (
          <View key={z} style={styles.zoneRow}>
            <Text style={styles.zoneLabel}>
              {ZONE_THEME[z].icon} {ZONE_THEME[z].label}
            </Text>
            <Text style={styles.zoneValue}>
              {formatDuration(zones.secondsByZone[z])} · {Math.round(zones.pctByZone[z])}%
            </Text>
          </View>
        ))}
        {zones.unknownSec > 0 ? (
          <View style={styles.zoneRow}>
            <Text style={styles.zoneLabel}>❔ No HR</Text>
            <Text style={styles.zoneValue}>{formatDuration(zones.unknownSec)}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.driftCard, { borderColor: driftColor }]}>
        <Text style={styles.driftLabel}>Aerobic decoupling</Text>
        <Text style={[styles.driftValue, { color: driftColor }]}>{driftText}</Text>
      </View>

      {insights.map((ins, i) => (
        <View key={i} style={[styles.insight, { borderLeftColor: SEVERITY_COLOR[ins.severity] }]}>
          <Text style={styles.insightHead}>{ins.headline}</Text>
          <Text style={styles.insightDetail}>{ins.detail}</Text>
        </View>
      ))}

      <Pressable onPress={onRestart} accessibilityRole="button" accessibilityLabel="Run again" style={styles.btn}>
        <Text style={styles.btnText}>Run again</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 16, padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#F1F5F9" },
  bar: { flexDirection: "row", height: 16, borderRadius: 8, overflow: "hidden", backgroundColor: "#1E293B" },
  zoneList: { gap: 6 },
  zoneRow: { flexDirection: "row", justifyContent: "space-between" },
  zoneLabel: { fontSize: 14, color: "#F1F5F9" },
  zoneValue: { fontSize: 14, color: "#94A3B8" },
  driftCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  driftLabel: { fontSize: 13, color: "#94A3B8" },
  driftValue: { fontSize: 24, fontWeight: "800" },
  insight: { borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 6, gap: 2 },
  insightHead: { fontSize: 15, fontWeight: "700", color: "#F1F5F9" },
  insightDetail: { fontSize: 13, color: "#94A3B8" },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: "#0E7C7B", alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 2: Render the summary when the replay finishes**

In `src/ui/RunScreen.tsx`, add imports (after the existing core imports):
```tsx
import { runInsights } from "../core/coaching";
import { RunSummary } from "./RunSummary";
```

After the live `zones`/`dc` lines from Task 4, compute the full-run analyses + insights (omit `endIndex` for the settled full-run numbers):
```tsx
  const fullZones = zoneDistribution(run.points, profile);
  const fullDc = decoupling(run.points, cumulative);
  const insights = runInsights(fullZones, fullDc);
```

Then, immediately before the existing `return (` of the main run view, add an early return for the finished state:
```tsx
  if (engine.finished) {
    return (
      <RunSummary
        zones={fullZones}
        decoupling={fullDc}
        insights={insights}
        onRestart={() => {
          engine.seekToStart();
          engine.play();
          force((n) => n + 1);
        }}
      />
    );
  }
```

- [ ] **Step 3: Type-check the whole app**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full core suite**

Run: `npm test`
Expected: PASS — all suites green (3 new + existing).

- [ ] **Step 5: Manual smoke on web**

Run: `npx expo start --web`
Expected: load a run, press Play — live strip's zone bar fills and Drift shows `—` then `+N%` after ~6 min of replay time (use 8× speed); let replay reach the end → summary screen appears with the zone breakdown, decoupling rating, and coaching cards; "Run again" restarts.

- [ ] **Step 6: Commit**

```bash
git add src/ui/RunSummary.tsx src/ui/RunScreen.tsx
git commit -m "feat: post-run summary with zones, decoupling, and coaching"
```

---

## Self-Review

**Spec coverage (spec §s → tasks):**
- §1 Zone distribution (core) → Task 1. ✓
- §2 Aerobic decoupling (core, time-halves, 6-min guard) → Task 2. ✓
- §3 Coaching insights (6 rules, ordering, integer copy) → Task 3. ✓
- §4 UI surfaces: live strip → Task 4 (AnalysisStrip + Dashboard + RunScreen wiring); summary → Task 5 (RunSummary, gated on `engine.finished`). ✓
- §5 Testing: core TDD in Tasks 1–3; UI `tsc --noEmit` + manual web smoke in Tasks 4–5. ✓
- Cross-module contract summary (zoneDistribution / decoupling / runInsights signatures) → defined Task 1/2/3, consumed verbatim in 4/5. ✓
- `ReplayEngine.finished` consumed (closes the prior-slice open thread) → Task 5. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. The one tuning note (Task 2 Step 4) adjusts a TEST fixture constant only, not production code, and bounds the allowed range. ✓

**Type consistency:** `ZoneDistribution` (Task 1) consumed by Tasks 3/4/5 with the same shape. `Decoupling`/`DecouplingRating` (Task 2) consumed by 3/4/5; `rating` non-null map in Task 5 uses `NonNullable<Decoupling["rating"]>`. `Insight`/`InsightSeverity` (Task 3) consumed by Task 5. `ZoneId` order array `["below","zone2","zone3","above"]` identical in Tasks 4 and 5. `zoneDistribution(points, profile, endIndex?)`, `decoupling(points, cumulative, endIndex?)`, `runInsights(zones, dc)` signatures identical at definition and all call sites. ✓

**Scope:** Single feature slice (analysis + coaching + two UI surfaces), no decomposition needed. ✓
```
