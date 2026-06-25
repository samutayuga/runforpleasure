# Drift Gauge + Zone Bar Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat "Drift +N%" text + thin bar with a circular SVG drift gauge and a thick rounded zone bar with icon dots, shared by the live dashboard strip and the post-run summary.

**Architecture:** One pure tested core module (`src/core/driftGauge.ts`) holds the gauge math; two new presentational components (`DriftGauge` SVG ring, `ZoneBar` bar+dots) consume it and the existing analysis structs; `AnalysisStrip` and `RunSummary` are rewired to use them while keeping their `onInfo` tap-to-explain behaviour.

**Tech Stack:** TypeScript (strict), vitest (core test), Expo / React Native, `react-native-svg` 15.15.4 (already used by RouteView/ElevationProfile), `@expo/vector-icons` `MaterialCommunityIcons`, existing `ZONE_THEME` / `Decoupling` / `ZoneDistribution`.

## Global Constraints

- TypeScript strict mode on; no `any` in committed code.
- `src/core/` MUST NOT import from `react`, `react-native`, `expo`, or `ui/` — pure & platform-agnostic.
- No new dependencies (`react-native-svg` and `@expo/vector-icons` already in use).
- Reuse `ZONE_THEME` (`src/ui/theme.ts`), `ZoneId` (`src/core/karvonen.ts`), `Decoupling`/`DecouplingRating` (`src/core/decoupling.ts`), `ZoneDistribution` (`src/core/zoneDistribution.ts`).
- Rating→color palette EXACTLY: `good → "#0E7C7B"`, `moderate → "#B45309"`, `high → "#9D174D"`; neutral/guard → `"#475569"`.
- Component return types use `React.JSX.Element`.
- Accessibility: zone conveyed by color AND icon/label (the dot row), never color alone; the gauge carries an `accessibilityLabel`.
- TDD for the core module: failing test first, run red, minimal code, run green, commit. UI verified by `npx tsc --noEmit` + manual smoke (project convention — no RN render tests).

---

### Task 1: Gauge mapping (core)

**Files:**
- Create: `src/core/driftGauge.ts`
- Test: `src/core/__tests__/driftGauge.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type TrendArrow = "up" | "flat" | "down"`
  - `function gaugeFraction(pct: number | null, cap?: number): number` — `cap` default 15; `null`→0; else `Math.min(Math.abs(pct), cap) / cap` (0..1).
  - `function trendArrow(pct: number | null): TrendArrow` — `null`→"flat"; `pct > 0.5`→"up"; `pct < -0.5`→"down"; else "flat".

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/driftGauge.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { gaugeFraction, trendArrow } from "../driftGauge";

describe("gaugeFraction", () => {
  it("is 0 for null", () => {
    expect(gaugeFraction(null)).toBe(0);
  });
  it("is 0 at 0%", () => {
    expect(gaugeFraction(0)).toBe(0);
  });
  it("maps 5% to ~0.333 against the default cap of 15", () => {
    expect(gaugeFraction(5)).toBeCloseTo(1 / 3, 5);
  });
  it("maps 10% to ~0.667", () => {
    expect(gaugeFraction(10)).toBeCloseTo(2 / 3, 5);
  });
  it("is full at the cap", () => {
    expect(gaugeFraction(15)).toBe(1);
  });
  it("clamps above the cap", () => {
    expect(gaugeFraction(20)).toBe(1);
  });
  it("uses magnitude for negative drift", () => {
    expect(gaugeFraction(-6)).toBeCloseTo(0.4, 5);
  });
  it("honours a custom cap", () => {
    expect(gaugeFraction(5, 10)).toBeCloseTo(0.5, 5);
  });
});

describe("trendArrow", () => {
  it("is flat for null", () => {
    expect(trendArrow(null)).toBe("flat");
  });
  it("is up for positive drift", () => {
    expect(trendArrow(4)).toBe("up");
  });
  it("is down for negative drift", () => {
    expect(trendArrow(-4)).toBe("down");
  });
  it("is flat at zero", () => {
    expect(trendArrow(0)).toBe("flat");
  });
  it("treats the deadband as flat", () => {
    expect(trendArrow(0.4)).toBe("flat");
    expect(trendArrow(-0.4)).toBe("flat");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/driftGauge.test.ts`
Expected: FAIL — cannot find module `../driftGauge`.

- [ ] **Step 3: Write the implementation**

Create `src/core/driftGauge.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/driftGauge.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Run the full core suite (no regressions)**

Run: `npm test`
Expected: PASS — all prior suites plus driftGauge green.

- [ ] **Step 6: Commit**

```bash
git add src/core/driftGauge.ts src/core/__tests__/driftGauge.test.ts
git commit -m "feat: add drift-gauge fraction and trend-arrow mapping"
```

---

### Task 2: ZoneBar component (UI)

**Files:**
- Create: `src/ui/ZoneBar.tsx`

**Interfaces:**
- Consumes: `ZoneDistribution` from `../core/zoneDistribution`; `ZoneId` from `../core/karvonen`; `ZONE_THEME` from `./theme`.
- Produces: `function ZoneBar(props: { zones: ZoneDistribution; height?: number; showDots?: boolean }): React.JSX.Element` (defaults `height = 16`, `showDots = true`) — a rounded track with flex segments per zone (`pctByZone`) plus, when `showDots`, a wrapped dot row (color dot + `ZONE_THEME` icon + label + `N%`) for each present zone.

- [ ] **Step 1: Implement the component**

Create `src/ui/ZoneBar.tsx`:
```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { ZoneId } from "../core/karvonen";
import { ZONE_THEME } from "./theme";

const ORDER: ZoneId[] = ["below", "zone2", "zone3", "above"];

export function ZoneBar({
  zones,
  height = 16,
  showDots = true,
}: {
  zones: ZoneDistribution;
  height?: number;
  showDots?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { height, borderRadius: height / 2 }]}>
        {ORDER.map((z) => {
          const pct = zones.pctByZone[z];
          if (pct <= 0) return null;
          return (
            <View key={z} style={{ flex: pct, backgroundColor: ZONE_THEME[z].color }}>
              <View style={styles.highlight} />
            </View>
          );
        })}
      </View>
      {showDots ? (
        <View style={styles.dots}>
          {ORDER.filter((z) => zones.pctByZone[z] > 0).map((z) => (
            <View key={z} style={styles.dotItem}>
              <View style={[styles.dot, { backgroundColor: ZONE_THEME[z].color }]} />
              <Text style={styles.dotText}>
                {ZONE_THEME[z].icon} {ZONE_THEME[z].label} {Math.round(zones.pctByZone[z])}%
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 8 },
  bar: { flexDirection: "row", overflow: "hidden", backgroundColor: "#1E293B" },
  highlight: { height: "40%", backgroundColor: "rgba(255,255,255,0.12)" },
  dots: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  dotItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotText: { fontSize: 11, color: "#94A3B8" },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/ZoneBar.tsx
git commit -m "feat: add shared ZoneBar (rounded bar + icon dots)"
```

---

### Task 3: DriftGauge component (UI)

**Files:**
- Create: `src/ui/DriftGauge.tsx`

**Interfaces:**
- Consumes: `Decoupling`/`DecouplingRating` from `../core/decoupling`; `gaugeFraction`/`trendArrow` from `../core/driftGauge` (Task 1); `Svg`/`Circle` from `react-native-svg`; `MaterialCommunityIcons` from `@expo/vector-icons`.
- Produces: `function DriftGauge(props: { decoupling: Decoupling; size?: number }): React.JSX.Element` (default `size = 96`) — a 270° donut-arc gauge (grey track + rating-colored progress arc filled by `gaugeFraction`) with a centred heart icon + signed value + rating word + trend arrow.

**Notes for the implementer:**
- Use react-native-svg's `rotation` / `originX` / `originY` props on `Circle` to rotate the arc so the 90° gap sits at the bottom (do NOT use a `transform` string — the numeric rotation props are the reliable API in this version).
- The arc is drawn with `strokeDasharray={`${len} ${circumference}`}` (the standard donut technique: draw `len`, then a gap longer than the rest so only one segment shows).
- `MaterialCommunityIcons` glyph names used: `heart-pulse`, `trending-up`, `trending-neutral`, `trending-down` — all valid in this icon set.

- [ ] **Step 1: Implement the component**

Create `src/ui/DriftGauge.tsx`:
```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Decoupling, DecouplingRating } from "../core/decoupling";
import { gaugeFraction, trendArrow } from "../core/driftGauge";

const RATING_COLOR: Record<DecouplingRating, string> = {
  good: "#0E7C7B",
  moderate: "#B45309",
  high: "#9D174D",
};
const NEUTRAL = "#475569";

const ARROW_ICON = {
  up: "trending-up",
  flat: "trending-neutral",
  down: "trending-down",
} as const;

export function DriftGauge({
  decoupling,
  size = 96,
}: {
  decoupling: Decoupling;
  size?: number;
}): React.JSX.Element {
  const { pct, rating } = decoupling;
  const color = rating ? RATING_COLOR[rating] : NEUTRAL;

  const stroke = Math.max(6, size * 0.09);
  const r = size / 2 - stroke;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const arcLen = 0.75 * circ; // 270° sweep
  const frac = gaugeFraction(pct);
  const arrow = trendArrow(pct);

  const valueText = pct === null ? "—" : `${pct >= 0 ? "+" : ""}${Math.round(pct)}%`;
  const word =
    pct === null ? "warming up" : rating ? rating[0].toUpperCase() + rating.slice(1) : "";
  const a11y = pct === null ? "Drift not available yet" : `Drift ${valueText}, ${rating ?? ""}`;

  return (
    <View style={{ width: size, height: size }} accessibilityLabel={a11y}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="#1E293B"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${arcLen} ${circ}`}
          strokeLinecap="round"
          rotation={135}
          originX={cx}
          originY={cy}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${frac * arcLen} ${circ}`}
          strokeLinecap="round"
          rotation={135}
          originX={cx}
          originY={cy}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <MaterialCommunityIcons name="heart-pulse" size={size * 0.18} color={color} />
        <Text style={{ fontSize: size * 0.22, fontWeight: "800", color: "#F1F5F9" }}>
          {valueText}
        </Text>
        <Text style={{ fontSize: size * 0.11, color: "#94A3B8" }}>{word}</Text>
        <MaterialCommunityIcons name={ARROW_ICON[arrow]} size={size * 0.16} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: 1 },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If `MaterialCommunityIcons` `name` rejects the `ARROW_ICON[arrow]` union, the names are valid glyphs — the value is correctly typed via `as const`; do not loosen with `any`. If a stubborn type error appears, annotate the map as `Record<TrendArrow, React.ComponentProps<typeof MaterialCommunityIcons>["name"]>` importing `TrendArrow` from `../core/driftGauge`.)

- [ ] **Step 3: Commit**

```bash
git add src/ui/DriftGauge.tsx
git commit -m "feat: add SVG drift gauge (ring + heart + trend arrow)"
```

---

### Task 4: Rewire AnalysisStrip + RunSummary

**Files:**
- Modify: `src/ui/AnalysisStrip.tsx` (full rewrite below)
- Modify: `src/ui/RunSummary.tsx` (full rewrite below)

**Interfaces:**
- Consumes: `ZoneBar` from `./ZoneBar` (Task 2); `DriftGauge` from `./DriftGauge` (Task 3). No prop-shape changes to either component (`AnalysisStrip` and `RunSummary` keep their existing props, including `onInfo`), so `Dashboard.tsx` and `RunScreen.tsx` need NO changes.
- Produces: the restyled panels. The analysis math, `onInfo` tap, insights, and "Run again" are unchanged.

- [ ] **Step 1: Rewrite AnalysisStrip**

Replace the entire contents of `src/ui/AnalysisStrip.tsx` with:
```tsx
import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { Decoupling } from "../core/decoupling";
import { ZoneBar } from "./ZoneBar";
import { DriftGauge } from "./DriftGauge";

export function AnalysisStrip({
  zones,
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
      accessibilityLabel="What do these mean?"
    >
      <ZoneBar zones={zones} height={14} />
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

- [ ] **Step 2: Rewrite RunSummary**

Replace the entire contents of `src/ui/RunSummary.tsx` with (keeps the title, the per-zone time list, insights, and "Run again"; swaps the stacked bar for `ZoneBar` and the text drift card for `DriftGauge`):
```tsx
import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { Decoupling } from "../core/decoupling";
import type { Insight } from "../core/coaching";
import type { ZoneId } from "../core/karvonen";
import { formatDuration } from "../core/format";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ZONE_THEME } from "./theme";
import { ZoneBar } from "./ZoneBar";
import { DriftGauge } from "./DriftGauge";

const ORDER: ZoneId[] = ["below", "zone2", "zone3", "above"];

const SEVERITY_COLOR: Record<Insight["severity"], string> = {
  good: "#0E7C7B",
  watch: "#B45309",
  act: "#9D174D",
};

export function RunSummary({
  zones,
  decoupling,
  insights,
  onInfo,
  onRestart,
}: {
  zones: ZoneDistribution;
  decoupling: Decoupling;
  insights: Insight[];
  onInfo?: () => void;
  onRestart: () => void;
}): React.JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Run analysis</Text>

      <ZoneBar zones={zones} height={18} />

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

      <Pressable
        style={styles.driftWrap}
        onPress={onInfo}
        accessibilityRole="button"
        accessibilityLabel="What does decoupling mean?"
      >
        <DriftGauge decoupling={decoupling} size={120} />
        <View style={styles.driftHint}>
          <Text style={styles.driftHintText}>Aerobic decoupling</Text>
          <MaterialCommunityIcons name="information-outline" size={15} color="#94A3B8" />
        </View>
      </Pressable>

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
  zoneList: { gap: 6 },
  zoneRow: { flexDirection: "row", justifyContent: "space-between" },
  zoneLabel: { fontSize: 14, color: "#F1F5F9" },
  zoneValue: { fontSize: 14, color: "#94A3B8" },
  driftWrap: { alignItems: "center", gap: 6 },
  driftHint: { flexDirection: "row", alignItems: "center", gap: 6 },
  driftHintText: { fontSize: 13, color: "#94A3B8" },
  insight: { borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 6, gap: 2 },
  insightHead: { fontSize: 15, fontWeight: "700", color: "#F1F5F9" },
  insightDetail: { fontSize: 13, color: "#94A3B8" },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: "#0E7C7B", alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 3: Type-check the whole app**

Run: `npx tsc --noEmit`
Expected: no errors. (Both rewrites drop the now-unused imports — AnalysisStrip no longer imports `Text`/`ZoneId`/`ZONE_THEME`; RunSummary no longer imports the old `RATING_COLOR` or references `styles.bar`/`driftCard` — so no unused-symbol errors.)

- [ ] **Step 4: Run the full core suite (no regressions)**

Run: `npm test`
Expected: PASS — all suites green (no core code changed in this task).

- [ ] **Step 5: Manual smoke on web**

Run: `npm run web` (or reload the running server at http://localhost:8081)
Expected: load a run, press Play at 8× — the live strip shows the thick rounded zone bar with icon dots and a small circular gauge whose ring fills/colors by rating once past ~6 min (before that it reads `—` / "warming up" with a grey ring); at the end, the summary shows a large gauge + the zone bar + dots, the per-zone time list, insights, and "Run again"; tapping the panel still opens the explainer modal. Verify the gauge's open gap sits at the bottom; if it is noticeably rotated, adjust the `rotation` value in `DriftGauge.tsx` within 90–135 and re-check (the 270° sweep math is fixed; only the gap orientation depends on rotation).

- [ ] **Step 6: Commit**

```bash
git add src/ui/AnalysisStrip.tsx src/ui/RunSummary.tsx
git commit -m "feat: restyle analysis panels with drift gauge and zone bar"
```

---

## Self-Review

**Spec coverage (spec §s → tasks):**
- §1 Gauge mapping (pure core: `gaugeFraction`, `trendArrow`) → Task 1. ✓
- §2 DriftGauge component (270° SVG arc, rating color, heart + value + word + arrow, null state) → Task 3. ✓
- §3 ZoneBar component (thick rounded bar + highlight + dot row with icon/label/%) → Task 2. ✓
- §4 Wiring + states (AnalysisStrip small gauge + ZoneBar; RunSummary large gauge + ZoneBar; guard/null + negative + empty handled) → Task 4 (+ null state from Task 3 component). ✓
- §5 Testing (driftGauge vitest; tsc + manual smoke) → Task 1 Step 4/5, Task 4 Step 3-5. ✓
- No change to `decoupling`/`zoneDistribution`/`coaching`/`AnalysisInfoModal`/`onInfo`/`Dashboard`/`RunScreen` contracts — Task 4 keeps prop shapes, so no upstream edits. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full file/code content. The two conditional notes (Task 3 Step 2 type fallback, Task 4 Step 5 rotation tweak) are bounded contingencies with exact values, not deferred work. ✓

**Type consistency:** `gaugeFraction(pct, cap?)`/`trendArrow(pct)`/`TrendArrow` defined in Task 1, consumed verbatim in Task 3. `RATING_COLOR: Record<DecouplingRating, string>` palette identical to the spec and to RunSummary's prior palette. `DriftGauge({ decoupling, size? })` and `ZoneBar({ zones, height?, showDots? })` signatures identical at definition (Tasks 2/3) and call sites (Task 4). `ZONE_THEME[z].color`/`.icon` matches the theme shape. `ORDER` array `["below","zone2","zone3","above"]` identical across ZoneBar and RunSummary. ✓

**Scope:** Single restyle slice, two presentational components + their two consumers, no decomposition needed. Additive — no prop-contract breakage. ✓
```
