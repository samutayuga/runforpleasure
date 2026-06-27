# Metabolic Fuel Splits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estimate and display the fat-vs-carbohydrate energy split of a finished run (PRD FR-5.3) on the post-run Run analysis screen.

**Architecture:** A pure-TypeScript core module (`src/core/fuel.ts`) maps each track point's intensity — fraction of Heart-Rate Reserve, reusing the existing Karvonen `hrr()` — to a fat fraction via a piecewise-linear crossover curve, then energy-weights it across the run to a fat%/carb% split plus a per-zone breakdown. A thin SVG-free `FuelSplit` bar component (mirroring the existing `ZoneBar`) renders it inside `RunSummary`, with explanatory copy added to the existing `AnalysisInfoModal`.

**Tech Stack:** TypeScript (strict), React Native / Expo, react-native-paper (already used by the info modal), vitest (core unit tests). No new dependencies.

## Global Constraints

- TypeScript strict mode on; no `any` in committed code.
- `src/core/` modules MUST NOT import from `react`, `react-native`, `expo`, or `src/ui/`. Core is pure and platform-agnostic.
- Ratio-only output: fat% vs carb%. NO body weight, NO absolute kcal, NO `Profile` changes. `Profile` stays `{ age: number; restingHr: number }`.
- Intensity basis is fraction of HRR (Karvonen), reusing `hrr(profile)` from `src/core/karvonen.ts`. No new profile inputs.
- Surfaced on the post-run `RunSummary` only. NOT on the live `Dashboard`.
- Per-interval HR is read from the **earlier** point (`points[i].hr`) over interval `[i, i+1]`, consistent with `zoneDistribution.ts` and `decoupling.ts`.
- TDD for core: failing test first, minimal code, passing test, commit. UI tasks type-check + manual-smoke (matching the project's existing analysis slices).

---

### Task 1: Core fuel-split model

**Files:**
- Create: `src/core/fuel.ts`
- Test: `src/core/__tests__/fuel.test.ts`

**Interfaces:**
- Consumes: `TrackPoint` from `./types`; `hrr`, `zoneForHr`, `Profile`, `ZoneId` from `./karvonen`.
- Produces:
  - `function fatFraction(intensity: number): number` — fat share of energy (0..1) at a given intensity (fraction of HRR). Clamps intensity to `[0,1]`; piecewise-linear between anchors `(0,0.85) (0.6,0.6) (0.8,0.25) (1,0.05)`.
  - `function intensityFromHr(hr: number | null, profile: Profile): number | null` — `(hr − restingHr) / hrr(profile)`, clamped to `[0,1]`; null when `hr` is null or HRR ≤ 0.
  - `interface FuelSplit { fatPct: number; carbPct: number; fatPctByZone: Record<ZoneId, number>; knownSec: number; unknownSec: number; totalSec: number }`
  - `function fuelSplit(points: TrackPoint[], profile: Profile, endIndex?: number): FuelSplit` — energy-weighted fat/carb split over `[0, endIndex]`.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/fuel.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fatFraction, intensityFromHr, fuelSplit } from "../fuel";
import type { Profile } from "../karvonen";
import type { TrackPoint } from "../types";

const profile: Profile = { age: 30, restingHr: 60 };
// maxHr = 211 - 0.64*30 = 191.8 ; HRR = 191.8 - 60 = 131.8

function tp(sec: number, hr: number | null): TrackPoint {
  return { lat: 1.35, lon: 103.75, ele: null, time: new Date(sec * 1000), hr };
}

describe("fatFraction", () => {
  it("is fat-dominant and flat at very easy intensity", () => {
    expect(fatFraction(0)).toBeCloseTo(0.85, 5);
    expect(fatFraction(-1)).toBeCloseTo(0.85, 5); // clamps below 0
  });
  it("hits the anchor points", () => {
    expect(fatFraction(0.6)).toBeCloseTo(0.6, 5);
    expect(fatFraction(0.8)).toBeCloseTo(0.25, 5);
    expect(fatFraction(1)).toBeCloseTo(0.05, 5);
    expect(fatFraction(2)).toBeCloseTo(0.05, 5); // clamps above 1
  });
  it("interpolates linearly between anchors", () => {
    // midpoint of [0.6,0.8]: fat = (0.6 + 0.25) / 2 = 0.425
    expect(fatFraction(0.7)).toBeCloseTo(0.425, 5);
  });
  it("decreases monotonically as intensity rises", () => {
    expect(fatFraction(0.3)).toBeGreaterThan(fatFraction(0.7));
    expect(fatFraction(0.7)).toBeGreaterThan(fatFraction(0.9));
  });
});

describe("intensityFromHr", () => {
  it("returns null for missing HR", () => {
    expect(intensityFromHr(null, profile)).toBeNull();
  });
  it("computes the fraction of HRR", () => {
    expect(intensityFromHr(150, profile)).toBeCloseTo(90 / 131.8, 5);
  });
  it("clamps above max and below rest", () => {
    expect(intensityFromHr(250, profile)).toBe(1);
    expect(intensityFromHr(40, profile)).toBe(0);
  });
});

describe("fuelSplit", () => {
  it("returns zeros for an empty track", () => {
    const r = fuelSplit([], profile);
    expect(r.fatPct).toBe(0);
    expect(r.carbPct).toBe(0);
    expect(r.totalSec).toBe(0);
  });

  it("at constant HR the run fat% equals the point fat fraction", () => {
    const pts = [tp(0, 150), tp(60, 150), tp(120, 150)];
    const i = intensityFromHr(150, profile)!;
    const expectedFatPct = fatFraction(i) * 100;
    const r = fuelSplit(pts, profile);
    expect(r.fatPct).toBeCloseTo(expectedFatPct, 4);
    expect(r.carbPct).toBeCloseTo(100 - expectedFatPct, 4);
    expect(r.knownSec).toBe(120);
  });

  it("an easy run burns a higher fat % than a hard run", () => {
    const easy = fuelSplit([tp(0, 120), tp(60, 120)], profile);
    const hard = fuelSplit([tp(0, 175), tp(60, 175)], profile);
    expect(easy.fatPct).toBeGreaterThan(hard.fatPct);
  });

  it("counts intervals without HR as unknown seconds", () => {
    const r = fuelSplit([tp(0, null), tp(60, 150)], profile);
    expect(r.unknownSec).toBe(60);
    expect(r.knownSec).toBe(0);
    expect(r.fatPct).toBe(0);
  });

  it("reports per-zone fat % for the zone the HR falls in", () => {
    // 150 bpm -> zone2 (z2=139.08, z3=152.26)
    const r = fuelSplit([tp(0, 150), tp(60, 150)], profile);
    const i = intensityFromHr(150, profile)!;
    expect(r.fatPctByZone.zone2).toBeCloseTo(fatFraction(i) * 100, 4);
    expect(r.fatPctByZone.above).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/fuel.test.ts`
Expected: FAIL — cannot find module `../fuel`.

- [ ] **Step 3: Write the implementation**

Create `src/core/fuel.ts`:
```ts
import type { TrackPoint } from "./types";
import { hrr, zoneForHr, type Profile, type ZoneId } from "./karvonen";

// Crossover anchors: [intensity (fraction of HRR), fat fraction of energy].
// Grounded in the crossover concept (Brooks & Mercier 1994): fat dominates at
// easy intensity and the body shifts to carbohydrate as intensity rises. The
// ~50/50 crossover lands near 0.65 HRR — the top of Zone 2.
const ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.85],
  [0.6, 0.6],
  [0.8, 0.25],
  [1.0, 0.05],
];

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// Fraction (0..1) of energy from fat at a given intensity (fraction of HRR).
// Piecewise-linear between ANCHORS; flat outside the [0,1] range.
export function fatFraction(intensity: number): number {
  const x = clamp01(intensity);
  for (let i = 1; i < ANCHORS.length; i++) {
    const [x0, y0] = ANCHORS[i - 1];
    const [x1, y1] = ANCHORS[i];
    if (x <= x1) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return ANCHORS[ANCHORS.length - 1][1];
}

// Intensity as a fraction of heart-rate reserve, clamped to [0,1].
// Null when HR is missing or HRR is non-positive.
export function intensityFromHr(hr: number | null, profile: Profile): number | null {
  if (hr === null) return null;
  const reserve = hrr(profile);
  if (reserve <= 0) return null;
  return clamp01((hr - profile.restingHr) / reserve);
}

export interface FuelSplit {
  fatPct: number; // % of energy from fat across the run (0..100)
  carbPct: number; // 100 - fatPct when known, else 0
  fatPctByZone: Record<ZoneId, number>; // mean fat % within each zone (0..100)
  knownSec: number; // seconds with usable HR
  unknownSec: number; // seconds without HR
  totalSec: number;
}

function emptyByZone(): Record<ZoneId, number> {
  return { below: 0, zone2: 0, zone3: 0, above: 0 };
}

const ZONES: ZoneId[] = ["below", "zone2", "zone3", "above"];

// Energy-weighted fat/carb split over [0, endIndex]. Each interval's fat
// fraction is weighted by its relative energy rate (proportional to intensity),
// so harder seconds — which burn more energy — count more, without needing body
// weight. Per-zone fat % is a plain time-weighted mean within each zone.
export function fuelSplit(
  points: TrackPoint[],
  profile: Profile,
  endIndex?: number,
): FuelSplit {
  const fatTimeByZone = emptyByZone();
  const zoneSec = emptyByZone();
  let fatEnergy = 0;
  let totalEnergy = 0;
  let knownSec = 0;
  let unknownSec = 0;
  let totalSec = 0;

  if (points.length >= 2) {
    const last = points.length - 1;
    const end = Math.max(0, Math.min(endIndex ?? last, last));
    for (let i = 0; i < end; i++) {
      const dt = (points[i + 1].time.getTime() - points[i].time.getTime()) / 1000;
      totalSec += dt;
      const intensity = intensityFromHr(points[i].hr, profile);
      if (intensity === null) {
        unknownSec += dt;
        continue;
      }
      knownSec += dt;
      const fat = fatFraction(intensity);
      const rate = Math.max(intensity, 0.01); // relative energy rate, floored
      fatEnergy += fat * rate * dt;
      totalEnergy += rate * dt;
      const zone = zoneForHr(points[i].hr, profile);
      if (zone !== null) {
        fatTimeByZone[zone] += fat * dt;
        zoneSec[zone] += dt;
      }
    }
  }

  const fatPct = totalEnergy > 0 ? (fatEnergy / totalEnergy) * 100 : 0;
  const fatPctByZone = emptyByZone();
  for (const z of ZONES) {
    fatPctByZone[z] = zoneSec[z] > 0 ? (fatTimeByZone[z] / zoneSec[z]) * 100 : 0;
  }

  return {
    fatPct,
    carbPct: totalEnergy > 0 ? 100 - fatPct : 0,
    fatPctByZone,
    knownSec,
    unknownSec,
    totalSec,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/fuel.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/fuel.ts src/core/__tests__/fuel.test.ts
git commit -m "feat: add fat/carb fuel-split model from HRR intensity"
```

---

### Task 2: FuelSplit bar component + RunSummary wiring

**Files:**
- Modify: `src/ui/theme.ts`
- Create: `src/ui/FuelSplit.tsx`
- Modify: `src/ui/RunSummary.tsx`

**Interfaces:**
- Consumes: `FuelSplit` type + `fuelSplit` function from `../core/fuel`; `FUEL_THEME` from `./theme`.
- Produces: `function FuelSplit(props: { fuel: FuelSplitData; height?: number }): React.JSX.Element` — a two-segment fat/carb bar with a legend, mirroring `ZoneBar`. `const FUEL_THEME` (fat + carb label/color/icon).

- [ ] **Step 1: Add the fuel theme**

In `src/ui/theme.ts`, append after the `ZONE_THEME` declaration:
```ts
export const FUEL_THEME: {
  fat: { label: string; color: string; icon: string };
  carb: { label: string; color: string; icon: string };
} = {
  fat: { label: "Fat", color: "#15803D", icon: "🥑" },
  carb: { label: "Carbs", color: "#1D4ED8", icon: "🍞" },
};
```

- [ ] **Step 2: Create the component**

Create `src/ui/FuelSplit.tsx`:
```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { FuelSplit as FuelSplitData } from "../core/fuel";
import { FUEL_THEME } from "./theme";

export function FuelSplit({
  fuel,
  height = 18,
}: {
  fuel: FuelSplitData;
  height?: number;
}): React.JSX.Element {
  if (fuel.knownSec <= 0) {
    return <Text style={styles.empty}>Fuel mix needs heart-rate data.</Text>;
  }

  const fat = Math.round(fuel.fatPct);
  const carb = Math.round(fuel.carbPct);

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { height, borderRadius: height / 2 }]}>
        {fuel.fatPct > 0 ? (
          <View style={{ flex: fuel.fatPct, backgroundColor: FUEL_THEME.fat.color }}>
            <View style={styles.highlight} />
          </View>
        ) : null}
        {fuel.carbPct > 0 ? (
          <View style={{ flex: fuel.carbPct, backgroundColor: FUEL_THEME.carb.color }}>
            <View style={styles.highlight} />
          </View>
        ) : null}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>
          {FUEL_THEME.fat.icon} {FUEL_THEME.fat.label} {fat}%
        </Text>
        <Text style={styles.legendText}>
          {FUEL_THEME.carb.icon} {FUEL_THEME.carb.label} {carb}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 8 },
  bar: { flexDirection: "row", overflow: "hidden", backgroundColor: "#1E293B" },
  highlight: { height: "40%", backgroundColor: "rgba(255,255,255,0.12)" },
  legend: { flexDirection: "row", gap: 16, justifyContent: "center" },
  legendText: { fontSize: 12, color: "#94A3B8" },
  empty: { fontSize: 13, color: "#94A3B8", textAlign: "center" },
});
```

- [ ] **Step 3: Wire into RunSummary — imports**

In `src/ui/RunSummary.tsx`, add after the line `import { ConclusionCard } from "./ConclusionCard";`:
```ts
import { fuelSplit } from "../core/fuel";
import { FuelSplit } from "./FuelSplit";
```

- [ ] **Step 4: Wire into RunSummary — compute**

In `src/ui/RunSummary.tsx`, immediately after the line `const conclusion = runConclusion(zones, decoupling);` add:
```ts
  const fuel = fuelSplit(points, profile);
```

- [ ] **Step 5: Wire into RunSummary — render**

In `src/ui/RunSummary.tsx`, find the drift `Pressable` close tag followed by the insights map:
```tsx
      </Pressable>

      {insights.map((ins, i) => (
```
Replace with (insert the fuel block between them):
```tsx
      </Pressable>

      <View style={styles.fuelWrap}>
        <Text style={styles.fuelTitle}>Fuel mix · fat vs carbs</Text>
        <FuelSplit fuel={fuel} />
      </View>

      {insights.map((ins, i) => (
```

- [ ] **Step 6: Wire into RunSummary — styles**

In `src/ui/RunSummary.tsx`, inside the `StyleSheet.create({ ... })` block, add after the `driftHintText` style entry:
```ts
  fuelWrap: { gap: 8 },
  fuelTitle: { fontSize: 14, fontWeight: "600", color: "#F1F5F9" },
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/ui/theme.ts src/ui/FuelSplit.tsx src/ui/RunSummary.tsx
git commit -m "feat: show fat/carb fuel-split bar on the run summary"
```

---

### Task 3: Glossary copy + info-modal section

**Files:**
- Modify: `src/core/glossary.ts`
- Test: `src/core/__tests__/glossary.test.ts`
- Modify: `src/ui/AnalysisInfoModal.tsx`

**Interfaces:**
- Consumes: `FUEL_INTRO` from `../core/glossary`.
- Produces: `const FUEL_INTRO: string` exported from `src/core/glossary.ts`, rendered as a new "Fuel mix" section in `AnalysisInfoModal`.

- [ ] **Step 1: Write the failing test**

In `src/core/__tests__/glossary.test.ts`, add an import for `FUEL_INTRO` to the existing import from `../glossary`, then add this block:
```ts
describe("FUEL_INTRO", () => {
  it("explains the fat-vs-carb crossover", () => {
    expect(FUEL_INTRO.toLowerCase()).toContain("fat");
    expect(FUEL_INTRO.toLowerCase()).toContain("carbohydrate");
    expect(FUEL_INTRO.toLowerCase()).toContain("crossover");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/glossary.test.ts`
Expected: FAIL — `FUEL_INTRO` is undefined (or not exported).

- [ ] **Step 3: Add the glossary copy**

In `src/core/glossary.ts`, append:
```ts
export const FUEL_INTRO =
  "Fuel mix estimates how much of your energy came from fat versus carbohydrate, " +
  "based on how hard you ran. Easy running burns mostly fat; as intensity climbs, " +
  "your body shifts to carbohydrate (glycogen). The crossover to mostly-carbs sits " +
  "around the top of Zone 2. A higher fat share means a more aerobic, base-building run.";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/glossary.test.ts`
Expected: PASS (existing glossary tests + the new FUEL_INTRO test).

- [ ] **Step 5: Render the section in the info modal**

In `src/ui/AnalysisInfoModal.tsx`, change the glossary import:
```ts
import { DRIFT_INTRO, ZONE_INFO, DRIFT_BANDS } from "../core/glossary";
```
to:
```ts
import { DRIFT_INTRO, ZONE_INFO, DRIFT_BANDS, FUEL_INTRO } from "../core/glossary";
```
Then find the closing of the zones map and the "Got it" button:
```tsx
            ))}

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Got it"
              style={styles.btn}
            >
```
Insert the fuel section between them:
```tsx
            ))}

            <Text style={styles.heading}>Fuel mix — fat vs carbs</Text>
            <Text style={styles.intro}>{FUEL_INTRO}</Text>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Got it"
              style={styles.btn}
            >
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run the full core suite**

Run: `npm test`
Expected: PASS — all core tests green, including the new `fuel` and updated `glossary` suites.

- [ ] **Step 8: Manual smoke on web**

Run: `npx expo start --web`
Expected: complete a replay run → Run analysis screen shows a "Fuel mix · fat vs carbs" bar (green fat / blue carb) with percentages; tapping the analysis info opens the modal with a new "Fuel mix — fat vs carbs" section; an easier run shows a higher fat %.

- [ ] **Step 9: Commit**

```bash
git add src/core/glossary.ts src/core/__tests__/glossary.test.ts src/ui/AnalysisInfoModal.tsx
git commit -m "feat: explain fuel mix in the run analysis info modal"
```

---

## Self-Review

**Spec coverage (PRD FR-5.3 → tasks):**
- "ratio of energy consumption derived from body fat versus active carbohydrates" → Task 1 `fuelSplit.fatPct`/`carbPct`. ✓
- "calculated against intensity distributions across the route metrics" → Task 1 energy-weighting by intensity (fraction of HRR) per interval; per-zone breakdown via `fatPctByZone`. ✓
- "display a chart" → Task 2 `FuelSplit` bar in `RunSummary`. ✓
- Ratio-only / no body weight (design decision) → enforced in Global Constraints; `Profile` untouched. ✓
- Explainability (matches the analysis-explainer slice) → Task 3 `FUEL_INTRO` + info-modal section. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code or an exact find/replace anchor. ✓

**Type consistency:** `FuelSplit` interface (`fatPct`, `carbPct`, `fatPctByZone`, `knownSec`, `unknownSec`, `totalSec`) defined in Task 1 and consumed verbatim in Task 2 (`fuel.knownSec`, `fuel.fatPct`, `fuel.carbPct`). `fatFraction` / `intensityFromHr` / `fuelSplit` signatures match between Task 1 definition and Task 1 tests. `FUEL_THEME` shape defined in Task 2 `theme.ts`, consumed in Task 2 `FuelSplit.tsx`. `FUEL_INTRO` exported in Task 3 `glossary.ts`, consumed in Task 3 `AnalysisInfoModal.tsx`. Per-interval HR uses `points[i].hr` consistently with `zoneDistribution.ts`/`decoupling.ts`. ✓

**Deferred (not this slice, beyond FR-5.3):** absolute kcal split (needs body weight → `Profile` + `ProfileScreen` change, partial FR-3.1); live fuel mix on the on-run `Dashboard`; %VO2max-based substrate model. Recorded here so a near-future slice can pick them up.
