# Zone Timeline Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stepped zone-vs-distance chart to the post-run summary (showing when/where the runner was in each Karvonen zone) and remove the now-duplicate cumulative zone bar from the live dashboard.

**Architecture:** A pure tested core function (`buildZoneTimeline`) produces the per-distance zone series; a new `ZoneTimeline` SVG component (mirroring `ElevationProfile`) renders the stepped line; `RunSummary` gains `points`/`cumulative`/`profile` props and renders it (supplied by `RunScreen`); the live `AnalysisStrip` drops its `ZoneBar` so the live view shows only the instantaneous "now" zone (the `Dashboard` centre meter) plus the drift gauge.

**Tech Stack:** TypeScript (strict), vitest (core test), Expo / React Native, `react-native-svg` 15.15.4 (as used by `ElevationProfile`), existing `ZONE_THEME` / `zoneForHr` / `cumulativeDistances` / `formatDuration`.

## Global Constraints

- TypeScript strict mode on; no `any` in committed code.
- `src/core/` MUST NOT import from `react`, `react-native`, `expo`, or `ui/` — pure & platform-agnostic.
- No new dependencies (`react-native-svg`, `@expo/vector-icons` already in use).
- Reuse `ZONE_THEME` (`src/ui/theme.ts`), `ZoneId`/`zoneForHr`/`Profile` (`src/core/karvonen.ts`), `TrackPoint` (`src/core/types.ts`), `formatDuration` (`src/core/format.ts`); cumulative distances come from the existing `cumulativeDistances` (`src/core/geo.ts`).
- Component return types use `React.JSX.Element`.
- Accessibility: zone read off the labeled y-axis rows AND color (never color alone); the chart carries an `accessibilityLabel`.
- Zone→level mapping: `below 0, zone2 1, zone3 2, above 3`.
- `tsconfig` is `strict: true` only — `noUnusedLocals`/`noUnusedParameters` are NOT enabled (an unread prop kept in a type is fine).
- TDD for the core module: failing test first, run red, minimal code, run green, commit. UI verified by `npx tsc --noEmit` + manual smoke (project convention — no RN render tests).

---

### Task 1: Timeline data (core)

**Files:**
- Create: `src/core/zoneTimeline.ts`
- Test: `src/core/__tests__/zoneTimeline.test.ts`

**Interfaces:**
- Consumes: `TrackPoint` from `./types`; `zoneForHr`, `Profile`, `ZoneId` from `./karvonen`.
- Produces:
  - `interface ZonePoint { distanceM: number; elapsedSec: number; zone: ZoneId; level: number }`
  - `function buildZoneTimeline(points: TrackPoint[], cumulative: number[], profile: Profile, maxSamples?: number): ZonePoint[]` — `maxSamples` default 240; downsample (`STEP = max(1, ceil(points.length/maxSamples))`, always include last index); skip null-HR points; `level` = below 0 / zone2 1 / zone3 2 / above 3.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/zoneTimeline.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildZoneTimeline } from "../zoneTimeline";
import type { TrackPoint } from "../types";
import type { Profile } from "../karvonen";

// profile: maxHr = 211 - 0.64*30 = 191.8 ; HRR = 131.8
// 60% -> 139.08 ; 70% -> 152.26 ; 80% -> 165.44
const profile: Profile = { age: 30, restingHr: 60 };

function tp(sec: number, lon: number, hr: number | null): TrackPoint {
  return { lat: 1.35, lon, ele: null, time: new Date(sec * 1000), hr };
}

// cumulative distances are supplied directly (the function does not compute geo)
describe("buildZoneTimeline", () => {
  it("maps each zone to its level with distance and elapsed time", () => {
    const points = [tp(0, 103.75, 120), tp(60, 103.76, 145), tp(120, 103.77, 160), tp(180, 103.78, 170)];
    const cumulative = [0, 100, 250, 500];
    const out = buildZoneTimeline(points, cumulative, profile);
    expect(out.map((p) => p.zone)).toEqual(["below", "zone2", "zone3", "above"]);
    expect(out.map((p) => p.level)).toEqual([0, 1, 2, 3]);
    expect(out.map((p) => p.distanceM)).toEqual([0, 100, 250, 500]);
    expect(out.map((p) => p.elapsedSec)).toEqual([0, 60, 120, 180]);
  });

  it("skips points with no heart rate", () => {
    const points = [tp(0, 103.75, 145), tp(60, 103.76, null), tp(120, 103.77, 160)];
    const cumulative = [0, 100, 200];
    const out = buildZoneTimeline(points, cumulative, profile);
    expect(out.map((p) => p.zone)).toEqual(["zone2", "zone3"]);
    expect(out.map((p) => p.distanceM)).toEqual([0, 200]);
  });

  it("downsamples to <= maxSamples and always keeps the last point", () => {
    const points: TrackPoint[] = [];
    const cumulative: number[] = [];
    for (let i = 0; i < 1000; i++) {
      points.push(tp(i, 103.75 + i * 0.0001, 150));
      cumulative.push(i * 10);
    }
    const out = buildZoneTimeline(points, cumulative, profile, 240);
    expect(out.length).toBeLessThanOrEqual(241);
    expect(out[out.length - 1].distanceM).toBe(cumulative[999]);
  });

  it("returns an empty array for no points", () => {
    expect(buildZoneTimeline([], [], profile)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/zoneTimeline.test.ts`
Expected: FAIL — cannot find module `../zoneTimeline`.

- [ ] **Step 3: Write the implementation**

Create `src/core/zoneTimeline.ts`:
```ts
import type { TrackPoint } from "./types";
import { zoneForHr, type Profile, type ZoneId } from "./karvonen";

export interface ZonePoint {
  distanceM: number;
  elapsedSec: number;
  zone: ZoneId;
  level: number;
}

const LEVEL: Record<ZoneId, number> = { below: 0, zone2: 1, zone3: 2, above: 3 };

export function buildZoneTimeline(
  points: TrackPoint[],
  cumulative: number[],
  profile: Profile,
  maxSamples = 240,
): ZonePoint[] {
  if (points.length < 1) return [];

  const start = points[0].time.getTime();
  const step = Math.max(1, Math.ceil(points.length / maxSamples));
  const idxs: number[] = [];
  for (let i = 0; i < points.length; i += step) idxs.push(i);
  const lastIdx = points.length - 1;
  if (idxs[idxs.length - 1] !== lastIdx) idxs.push(lastIdx);

  const out: ZonePoint[] = [];
  for (const i of idxs) {
    const zone = zoneForHr(points[i].hr, profile);
    if (zone === null) continue;
    out.push({
      distanceM: cumulative[i],
      elapsedSec: (points[i].time.getTime() - start) / 1000,
      zone,
      level: LEVEL[zone],
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/zoneTimeline.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the full core suite (no regressions)**

Run: `npm test`
Expected: PASS — all prior suites plus zoneTimeline green.

- [ ] **Step 6: Commit**

```bash
git add src/core/zoneTimeline.ts src/core/__tests__/zoneTimeline.test.ts
git commit -m "feat: add zone-timeline series (zone level per distance/time)"
```

---

### Task 2: ZoneTimeline component (UI)

**Files:**
- Create: `src/ui/ZoneTimeline.tsx`

**Interfaces:**
- Consumes: `buildZoneTimeline` from `../core/zoneTimeline`; `formatDuration` from `../core/format`; `ZONE_THEME` from `./theme`; `TrackPoint` from `../core/types`; `Profile` from `../core/karvonen`; `Svg`/`Line`/`Text as SvgText` from `react-native-svg`.
- Produces: `function ZoneTimeline(props: { points: TrackPoint[]; cumulative: number[]; profile: Profile; width: number; height?: number }): React.JSX.Element` (default `height = 132`) — a stepped zone line over distance with four labeled y-rows, km + elapsed-time tick labels, and a "No heart-rate data" placeholder when the series is empty.

- [ ] **Step 1: Implement the component**

Create `src/ui/ZoneTimeline.tsx`:
```tsx
import React from "react";
import { View } from "react-native";
import Svg, { Line, Text as SvgText } from "react-native-svg";
import { buildZoneTimeline } from "../core/zoneTimeline";
import { formatDuration } from "../core/format";
import { ZONE_THEME } from "./theme";
import type { TrackPoint } from "../core/types";
import type { Profile } from "../core/karvonen";

const ROW_LABELS: { level: number; label: string }[] = [
  { level: 3, label: "Above" },
  { level: 2, label: "Z3" },
  { level: 1, label: "Z2" },
  { level: 0, label: "Below" },
];

export function ZoneTimeline({
  points,
  cumulative,
  profile,
  width,
  height = 132,
}: {
  points: TrackPoint[];
  cumulative: number[];
  profile: Profile;
  width: number;
  height?: number;
}): React.JSX.Element {
  const series = buildZoneTimeline(points, cumulative, profile);
  const pad = 16;
  const leftAxis = 34;
  const totalDist = cumulative[cumulative.length - 1] || 1;

  const x = (d: number) => leftAxis + (d / totalDist) * (width - leftAxis - pad);
  const y = (level: number) => height - pad - (level / 3) * (height - 2 * pad);

  const containerStyle = {
    width: "100%" as const,
    maxWidth: width,
    alignSelf: "center" as const,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
  };

  if (series.length === 0) {
    return (
      <View style={containerStyle}>
        <Svg width={width} height={height}>
          <SvgText x={width / 2} y={height / 2} fill="#94A3B8" fontSize={12} textAnchor="middle">
            No heart-rate data
          </SvgText>
        </Svg>
      </View>
    );
  }

  const rows = ROW_LABELS.map((r) => (
    <React.Fragment key={r.level}>
      <Line x1={leftAxis} y1={y(r.level)} x2={width - pad} y2={y(r.level)} stroke="#1E293B" strokeWidth={1} />
      <SvgText x={2} y={y(r.level) + 3} fill="#94A3B8" fontSize={10}>
        {r.label}
      </SvgText>
    </React.Fragment>
  ));

  const steps: React.JSX.Element[] = [];
  for (let i = 0; i < series.length - 1; i++) {
    const a = series[i];
    const b = series[i + 1];
    const color = ZONE_THEME[a.zone].color;
    steps.push(
      <Line key={`h${i}`} x1={x(a.distanceM)} y1={y(a.level)} x2={x(b.distanceM)} y2={y(a.level)} stroke={color} strokeWidth={2.5} strokeLinecap="round" />,
    );
    if (a.level !== b.level) {
      steps.push(
        <Line key={`v${i}`} x1={x(b.distanceM)} y1={y(a.level)} x2={x(b.distanceM)} y2={y(b.level)} stroke={color} strokeWidth={2.5} strokeLinecap="round" />,
      );
    }
  }
  const lastP = series[series.length - 1];
  steps.push(
    <Line key="hlast" x1={x(lastP.distanceM) - 3} y1={y(lastP.level)} x2={x(lastP.distanceM)} y2={y(lastP.level)} stroke={ZONE_THEME[lastP.zone].color} strokeWidth={2.5} strokeLinecap="round" />,
  );

  const ticks = [0, 1 / 3, 2 / 3, 1].map((f, i) => {
    const d = f * totalDist;
    let nearest = series[0];
    for (const p of series) {
      if (Math.abs(p.distanceM - d) < Math.abs(nearest.distanceM - d)) nearest = p;
    }
    const tx = x(d);
    const anchor = i === 0 ? "start" : i === 3 ? "end" : "middle";
    return (
      <React.Fragment key={`t${i}`}>
        <SvgText x={tx} y={height + 1} fill="#94A3B8" fontSize={9} textAnchor={anchor}>
          {(d / 1000).toFixed(1)}km
        </SvgText>
        <SvgText x={tx} y={height - pad + 10} fill="#64748B" fontSize={8} textAnchor={anchor}>
          {formatDuration(nearest.elapsedSec)}
        </SvgText>
      </React.Fragment>
    );
  });

  return (
    <View style={containerStyle} accessibilityLabel="Zone over distance chart">
      <Svg width={width} height={height + 6}>
        {rows}
        {steps}
        {ticks}
        <SvgText x={width - pad} y={11} fill="#94A3B8" fontSize={10} textAnchor="end">
          Zone over distance
        </SvgText>
      </Svg>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/ZoneTimeline.tsx
git commit -m "feat: add ZoneTimeline stepped-line chart (zone over distance)"
```

---

### Task 3: Wire ZoneTimeline into the summary

**Files:**
- Modify: `src/ui/RunSummary.tsx` (add 3 props + imports + render the chart)
- Modify: `src/ui/RunScreen.tsx` (pass the 3 new props in the finished branch)

**Interfaces:**
- Consumes: `ZoneTimeline` from `./ZoneTimeline` (Task 2); `TrackPoint` from `../core/types`; `Profile` from `../core/karvonen`.
- Produces: `RunSummary` gains `points: TrackPoint[]`, `cumulative: number[]`, `profile: Profile` props; the chart renders below the existing `ZoneBar`. No other call sites (`RunSummary` is only rendered in `RunScreen`'s finished branch).

- [ ] **Step 1: Add imports to RunSummary**

In `src/ui/RunSummary.tsx`, the existing imports (lines 1-11) include `import type { ZoneId } from "../core/karvonen";`. Add after the existing component imports (after `import { DriftGauge } from "./DriftGauge";`):
```tsx
import { ZoneTimeline } from "./ZoneTimeline";
import type { TrackPoint } from "../core/types";
import type { Profile } from "../core/karvonen";
```

- [ ] **Step 2: Add the three props to RunSummary**

In the `RunSummary` signature, add the new props to BOTH the destructure and the type block. The current destructure is `{ zones, decoupling, insights, onInfo, onRestart }` and the type block lists `zones`/`decoupling`/`insights`/`onInfo?`/`onRestart`. Change them to:
```tsx
export function RunSummary({
  zones,
  decoupling,
  insights,
  points,
  cumulative,
  profile,
  onInfo,
  onRestart,
}: {
  zones: ZoneDistribution;
  decoupling: Decoupling;
  insights: Insight[];
  points: TrackPoint[];
  cumulative: number[];
  profile: Profile;
  onInfo?: () => void;
  onRestart: () => void;
}): React.JSX.Element {
```

- [ ] **Step 3: Render the chart below the ZoneBar**

In `src/ui/RunSummary.tsx`, the existing line is `<ZoneBar zones={zones} height={18} />`. Add the chart immediately after it:
```tsx
      <ZoneBar zones={zones} height={18} />
      <ZoneTimeline points={points} cumulative={cumulative} profile={profile} width={440} />
```

- [ ] **Step 4: Pass the new props from RunScreen**

In `src/ui/RunScreen.tsx`, the finished branch renders `<RunSummary>` with `zones`/`decoupling`/`insights`/`onInfo`/`onRestart` (around lines 169-179), and `run`, `cumulative`, `profile` are all in scope there. Add the three new props to that `<RunSummary>` element:
```tsx
          points={run.points}
          cumulative={cumulative}
          profile={profile}
```
(Place them alongside the existing props — e.g. right after `insights={insights}`. Do not change the existing `onInfo`/`onRestart` handlers.)

- [ ] **Step 5: Type-check the whole app**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full core suite (no regressions)**

Run: `npm test`
Expected: PASS — all suites green (no core code changed in this task).

- [ ] **Step 7: Commit**

```bash
git add src/ui/RunSummary.tsx src/ui/RunScreen.tsx
git commit -m "feat: show zone-over-distance timeline in the run summary"
```

---

### Task 4: Remove the duplicate ZoneBar from the live strip

**Files:**
- Modify: `src/ui/AnalysisStrip.tsx` (full rewrite below)

**Interfaces:**
- Consumes: `DriftGauge` from `./DriftGauge` (unchanged); no longer uses `ZoneBar`.
- Produces: the live `AnalysisStrip` renders only the drift gauge + info icon. Its prop CONTRACT is unchanged (`zones` stays in the type so `Dashboard`'s `<AnalysisStrip zones={zones} … />` call keeps compiling) — so `Dashboard.tsx` and `RunScreen.tsx` need NO changes.

- [ ] **Step 1: Rewrite AnalysisStrip without the ZoneBar**

Replace the entire contents of `src/ui/AnalysisStrip.tsx` with (drops the `ZoneBar` import and element, drops `zones` from the destructure but KEEPS it in the prop type, keeps the `onInfo` `Pressable` + `DriftGauge` + info icon):
```tsx
import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { Decoupling } from "../core/decoupling";
import { DriftGauge } from "./DriftGauge";

export function AnalysisStrip({
  decoupling,
  onInfo,
}: {
  zones: ZoneDistribution;
  decoupling: Decoupling;
  onInfo?: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={styles.wrap}
      onPress={onInfo}
      accessibilityRole="button"
      accessibilityLabel="Drift — what does this mean?"
    >
      <View style={styles.driftRow}>
        <DriftGauge decoupling={decoupling} size={64} />
        <MaterialCommunityIcons name="information-outline" size={14} color="#94A3B8" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 8, alignItems: "center" },
  driftRow: { flexDirection: "row", alignItems: "center", gap: 6 },
});
```

Note: `zones` remains in the prop TYPE (so `Dashboard.tsx:138`'s `<AnalysisStrip zones={zones} decoupling={decoupling} onInfo={onInfo} />` stays valid) but is dropped from the destructure because it is no longer read. `ZoneDistribution` is still imported because the type annotation uses it. `tsconfig` does not enable `noUnusedLocals`, so the kept-but-unread type is clean.

- [ ] **Step 2: Type-check the whole app**

Run: `npx tsc --noEmit`
Expected: no errors. (`Dashboard`/`RunScreen` unchanged and still compile because the `AnalysisStrip` prop type is unchanged.)

- [ ] **Step 3: Run the full core suite (no regressions)**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 4: Manual smoke on web**

Run: `npm run web` (or reload http://localhost:8081)
Expected: on the LIVE dashboard, the analysis strip now shows only the drift gauge + info icon (no cumulative zone bar); the centre column's instantaneous zone meter remains the live "now" indicator. At the END (summary), the cumulative zone bar, the per-zone time list, and the new stepped zone-over-distance chart all appear; the chart's stepped line tracks the zones across the route with the four y-rows (Below/Z2/Z3/Above) and km + time tick labels; a run with no HR shows "No heart-rate data". Tapping either panel still opens the explainer. (If any chart label visibly overlaps the axis, nudge the `pad`/label `y` values in `ZoneTimeline.tsx` — the data geometry is fixed; only label placement is cosmetic.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/AnalysisStrip.tsx
git commit -m "refactor: drop duplicate cumulative zone bar from live strip"
```

---

## Self-Review

**Spec coverage (spec §s → tasks):**
- §1 Timeline data (pure core `buildZoneTimeline`, level mapping, downsample, null-HR skip, empty) → Task 1. ✓
- §2 ZoneTimeline component (stepped line, 4 y-rows, km+time ticks, empty placeholder) → Task 2. ✓
- §3 Wiring (RunSummary gains points/cumulative/profile; RunScreen passes them) → Task 3. ✓
- §4 States (all-null → placeholder; short run → single step; gaps → long hold) → Task 1 (empty/skip) + Task 2 (placeholder render). ✓
- §5 Testing (zoneTimeline vitest; tsc + manual smoke) → Task 1 Step 4/5, Tasks 2-4 tsc + Task 4 smoke. ✓
- §6 Live de-duplication (AnalysisStrip drops ZoneBar; zones kept in type; Dashboard/RunScreen untouched) → Task 4. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. The two cosmetic notes (Task 2/Task 4 label nudges) are bounded contingencies, not deferred work. ✓

**Type consistency:** `ZonePoint`/`buildZoneTimeline(points, cumulative, profile, maxSamples?)` defined in Task 1, consumed verbatim in Task 2. `ZoneTimeline({ points, cumulative, profile, width, height? })` defined Task 2, called identically in Task 3. `RunSummary` new props `points: TrackPoint[]`/`cumulative: number[]`/`profile: Profile` consistent between its definition (Task 3) and the `RunScreen` call site (Task 3 Step 4). `LEVEL`/`ROW_LABELS` levels match (`below 0…above 3`). `AnalysisStrip` prop type unchanged in Task 4 (so `Dashboard` call still valid). ✓

**Scope:** Single slice — one chart + its wiring + one de-dup. No decomposition needed. Additive except the intentional ZoneBar removal from the live strip (§6). ✓
```
