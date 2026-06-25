# Analysis Explainer + README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tappable in-app explainer for the analysis panel (Drift + Karvonen zones, with each zone's fat/carb fuel source) plus a README, both fed by one pure-core glossary module.

**Architecture:** A pure `src/core/glossary.ts` holds the explainer copy as data (vitest-tested). A new `src/ui/AnalysisInfoModal.tsx` renders it using the existing `RoutesPanel` modal pattern (React Native core `Modal` + `Pressable` backdrop — not react-native-paper Dialog). `AnalysisStrip`, `RunSummary`, and `Dashboard` get an ⓘ affordance and an OPTIONAL `onInfo` callback; `RunScreen` owns the modal's open state. The README is written from the same glossary content.

**Tech Stack:** TypeScript (strict), vitest (core test), Expo / React Native, react-native-paper (`Text`), `@expo/vector-icons` `MaterialCommunityIcons`, existing `ZONE_THEME` (`src/ui/theme.ts`) and `ZoneId`/`DecouplingRating` types.

## Global Constraints

- TypeScript strict mode on; no `any` in committed code.
- `src/core/` modules MUST NOT import from `react`, `react-native`, `expo`, or `ui/` — pure & platform-agnostic (type-only imports from sibling core modules are fine).
- No new dependencies. (`MaterialCommunityIcons` from `@expo/vector-icons` and react-native-paper are already in use.)
- Reuse existing `ZoneId` (`src/core/karvonen.ts`), `DecouplingRating` (`src/core/decoupling.ts`), `ZONE_THEME` (`src/ui/theme.ts`), and the dark-modal pattern from `src/ui/RoutesPanel.tsx`.
- Component return types use `React.JSX.Element` (project dropped the global `JSX` namespace under @types/react v19).
- All new `onInfo` props are OPTIONAL (`onInfo?: () => void`) so existing call sites keep compiling.
- Rating→color palette (reuse RunSummary's): `good → "#0E7C7B"`, `moderate → "#B45309"`, `high → "#9D174D"`.
- Accessibility: tappable panels are `Pressable` with `accessibilityRole="button"` and a label; the ⓘ icon is informational.
- TDD for the core module: failing test first, run red, minimal code, run green, commit. UI tasks verify with `npx tsc --noEmit` + manual smoke (project convention — no RN render tests).

---

### Task 1: Glossary content (core)

**Files:**
- Create: `src/core/glossary.ts`
- Test: `src/core/__tests__/glossary.test.ts`

**Interfaces:**
- Consumes: `ZoneId` from `./karvonen`; `DecouplingRating` from `./decoupling` (type-only).
- Produces:
  - `interface ZoneInfo { id: ZoneId; label: string; range: string; fuel: string; meaning: string }`
  - `interface DriftBand { rating: DecouplingRating; range: string; meaning: string }`
  - `const DRIFT_INTRO: string`
  - `const ZONE_INFO: ZoneInfo[]` — exactly the 4 `ZoneId`s in order `below, zone2, zone3, above`.
  - `const DRIFT_BANDS: DriftBand[]` — exactly the 3 ratings in order `good, moderate, high`.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/glossary.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ZONE_INFO, DRIFT_BANDS, DRIFT_INTRO } from "../glossary";
import type { ZoneId } from "../karvonen";
import type { DecouplingRating } from "../decoupling";

describe("glossary content", () => {
  it("covers exactly the four zones in canonical order", () => {
    const ids = ZONE_INFO.map((z) => z.id);
    expect(ids).toEqual<ZoneId[]>(["below", "zone2", "zone3", "above"]);
  });

  it("covers exactly the three drift ratings in order", () => {
    const ratings = DRIFT_BANDS.map((b) => b.rating);
    expect(ratings).toEqual<DecouplingRating[]>(["good", "moderate", "high"]);
  });

  it("gives every zone a non-empty label, range, fuel, and meaning", () => {
    for (const z of ZONE_INFO) {
      expect(z.label.length).toBeGreaterThan(0);
      expect(z.range.length).toBeGreaterThan(0);
      expect(z.fuel.length).toBeGreaterThan(0);
      expect(z.meaning.length).toBeGreaterThan(0);
    }
  });

  it("gives every drift band a non-empty range and meaning", () => {
    for (const b of DRIFT_BANDS) {
      expect(b.range.length).toBeGreaterThan(0);
      expect(b.meaning.length).toBeGreaterThan(0);
    }
  });

  it("mentions the carb/fat fuel split across the zones", () => {
    const fuels = ZONE_INFO.map((z) => z.fuel.toLowerCase()).join(" ");
    expect(fuels).toContain("fat");
    expect(fuels).toContain("carb");
  });

  it("has a non-empty drift intro", () => {
    expect(DRIFT_INTRO.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/glossary.test.ts`
Expected: FAIL — cannot find module `../glossary`.

- [ ] **Step 3: Write the implementation**

Create `src/core/glossary.ts`:
```ts
import type { ZoneId } from "./karvonen";
import type { DecouplingRating } from "./decoupling";

export interface ZoneInfo {
  id: ZoneId;
  label: string;
  range: string;
  fuel: string;
  meaning: string;
}

export interface DriftBand {
  rating: DecouplingRating;
  range: string;
  meaning: string;
}

export const DRIFT_INTRO =
  "Drift (aerobic decoupling) compares the first and second half of your run. " +
  "It measures how much your heart rate crept up to hold the same pace. Lower is " +
  "better — under 5% is a solid, well-paced aerobic run. It needs about 6 minutes " +
  "of running before it can show a number.";

export const ZONE_INFO: ZoneInfo[] = [
  {
    id: "below",
    label: "Below Zone 2",
    range: "Under 60% HRR",
    fuel: "Mostly fat",
    meaning: "Very easy — warm-up or recovery pace.",
  },
  {
    id: "zone2",
    label: "Zone 2 · Aerobic",
    range: "60–70% HRR",
    fuel: "Mostly fat",
    meaning: "Easy aerobic base. Builds endurance and fat-burning efficiency.",
  },
  {
    id: "zone3",
    label: "Zone 3 · Tempo",
    range: "70–80% HRR",
    fuel: "Fat + carbs",
    meaning: "Comfortably hard. Shifts toward burning carbohydrate (glycogen).",
  },
  {
    id: "above",
    label: "Above Zone 3",
    range: "Over 80% HRR",
    fuel: "Mostly carbs",
    meaning: "Hard effort. Burns mostly carbohydrate; not for base-building.",
  },
];

export const DRIFT_BANDS: DriftBand[] = [
  {
    rating: "good",
    range: "< 5%",
    meaning: "Heart rate held steady. Strong aerobic base, well paced.",
  },
  {
    rating: "moderate",
    range: "5–10%",
    meaning: "Mild drift. Base still building, or you started too fast.",
  },
  {
    rating: "high",
    range: "≥ 10%",
    meaning: "Heart rate climbed to hold pace. Went too hard, under-trained, hot, or under-fuelled.",
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/glossary.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run the full core suite (no regressions)**

Run: `npm test`
Expected: PASS — all prior suites plus glossary green.

- [ ] **Step 6: Commit**

```bash
git add src/core/glossary.ts src/core/__tests__/glossary.test.ts
git commit -m "feat: add run-metrics glossary content (drift bands + zones + fuel)"
```

---

### Task 2: Explainer modal (UI)

**Files:**
- Create: `src/ui/AnalysisInfoModal.tsx`

**Interfaces:**
- Consumes: `DRIFT_INTRO`, `ZONE_INFO`, `DRIFT_BANDS` from `../core/glossary`; `ZONE_THEME` from `./theme`; `DecouplingRating` from `../core/decoupling`; RN `Modal`/`View`/`ScrollView`/`Pressable`/`StyleSheet`; `Text` from `react-native-paper`.
- Produces: `function AnalysisInfoModal(props: { visible: boolean; onClose: () => void }): React.JSX.Element`
  - Modeled on `src/ui/RoutesPanel.tsx`: `<Modal transparent animationType="fade">`, full-screen `Pressable` backdrop closes on press, dark panel with a `ScrollView`. Renders a Drift section (`DRIFT_INTRO` + `DRIFT_BANDS` rows colored by rating) and a Zones section (`ZONE_INFO` rows with `ZONE_THEME` color dot + icon, label, range, fuel, meaning), plus a "Got it" close button.

- [ ] **Step 1: Implement the component**

Create `src/ui/AnalysisInfoModal.tsx`:
```tsx
import React from "react";
import { Modal, View, ScrollView, Pressable, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { DRIFT_INTRO, ZONE_INFO, DRIFT_BANDS } from "../core/glossary";
import type { DecouplingRating } from "../core/decoupling";
import { ZONE_THEME } from "./theme";

const RATING_COLOR: Record<DecouplingRating, string> = {
  good: "#0E7C7B",
  moderate: "#B45309",
  high: "#9D174D",
};

export function AnalysisInfoModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* stop backdrop press from closing when tapping the panel body */}
        <Pressable style={styles.panel} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>Understanding your run</Text>

            <Text style={styles.heading}>Drift — aerobic decoupling</Text>
            <Text style={styles.intro}>{DRIFT_INTRO}</Text>
            {DRIFT_BANDS.map((b) => (
              <View key={b.rating} style={styles.row}>
                <View style={[styles.chip, { backgroundColor: RATING_COLOR[b.rating] }]}>
                  <Text style={styles.chipText}>{b.range}</Text>
                </View>
                <Text style={styles.rowText}>{b.meaning}</Text>
              </View>
            ))}

            <Text style={styles.heading}>Heart-rate zones & fuel</Text>
            {ZONE_INFO.map((z) => (
              <View key={z.id} style={styles.zoneRow}>
                <View style={styles.zoneHead}>
                  <View style={[styles.dot, { backgroundColor: ZONE_THEME[z.id].color }]} />
                  <Text style={styles.zoneLabel}>
                    {ZONE_THEME[z.id].icon} {z.label}
                  </Text>
                  <Text style={styles.zoneRange}>{z.range}</Text>
                </View>
                <Text style={styles.zoneFuel}>Fuel: {z.fuel}</Text>
                <Text style={styles.zoneMeaning}>{z.meaning}</Text>
              </View>
            ))}

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Got it"
              style={styles.btn}
            >
              <Text style={styles.btnText}>Got it</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  panel: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "85%",
    backgroundColor: "#16213A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  scroll: { padding: 20, gap: 10 },
  title: { fontSize: 22, fontWeight: "700", color: "#F1F5F9", marginBottom: 4 },
  heading: { fontSize: 16, fontWeight: "700", color: "#F1F5F9", marginTop: 10 },
  intro: { fontSize: 13, color: "#94A3B8", lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  chip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, minWidth: 56, alignItems: "center" },
  chipText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  rowText: { flex: 1, fontSize: 13, color: "#94A3B8" },
  zoneRow: { gap: 2, paddingVertical: 4 },
  zoneHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  zoneLabel: { fontSize: 14, fontWeight: "600", color: "#F1F5F9" },
  zoneRange: { fontSize: 12, color: "#94A3B8", marginLeft: "auto" },
  zoneFuel: { fontSize: 13, color: "#F1F5F9", fontWeight: "600" },
  zoneMeaning: { fontSize: 13, color: "#94A3B8" },
  btn: { marginTop: 16, minHeight: 48, borderRadius: 12, backgroundColor: "#0E7C7B", alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/AnalysisInfoModal.tsx
git commit -m "feat: add analysis explainer modal (drift + zones + fuel)"
```

---

### Task 3: Tappable affordance + wiring

**Files:**
- Modify: `src/ui/AnalysisStrip.tsx`
- Modify: `src/ui/RunSummary.tsx`
- Modify: `src/ui/Dashboard.tsx`
- Modify: `src/ui/RunScreen.tsx`

**Interfaces:**
- Consumes: `AnalysisInfoModal` from `./AnalysisInfoModal` (Task 2); `MaterialCommunityIcons` from `@expo/vector-icons` (already imported in RunScreen; newly imported in AnalysisStrip + RunSummary).
- Produces: an optional `onInfo?: () => void` prop on `AnalysisStrip`, `RunSummary`, and `Dashboard`; a live `infoOpen` state + `<AnalysisInfoModal>` render in `RunScreen`.

- [ ] **Step 1: Add the ⓘ affordance + onInfo to AnalysisStrip**

In `src/ui/AnalysisStrip.tsx`, change the imports on lines 1-2 to add `Pressable` and the icon:
```tsx
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
```

Change the component signature (lines 10-16) to accept the optional prop:
```tsx
export function AnalysisStrip({
  zones,
  decoupling,
  onInfo,
}: {
  zones: ZoneDistribution;
  decoupling: Decoupling;
  onInfo?: () => void;
}): React.JSX.Element {
```

Replace the outer wrapper `<View style={styles.wrap} accessibilityLabel="Live run analysis">` … `</View>` (lines 22-41 — the entire returned JSX) with a `Pressable` wrapper and an ⓘ next to the Drift label:
```tsx
  return (
    <Pressable
      style={styles.wrap}
      onPress={onInfo}
      accessibilityRole="button"
      accessibilityLabel="What do these mean?"
    >
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
      <View style={styles.driftRow}>
        <Text style={styles.drift}>Drift {drift}</Text>
        <MaterialCommunityIcons name="information-outline" size={14} color="#94A3B8" />
      </View>
    </Pressable>
  );
```

Add a `driftRow` style to the `StyleSheet.create({...})` block (after the existing `drift` entry):
```tsx
  driftRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
```

(Note: a `Pressable` with `onPress={undefined}` is inert and renders normally, so omitting `onInfo` keeps the old behaviour.)

- [ ] **Step 2: Add the ⓘ affordance + onInfo to RunSummary**

In `src/ui/RunSummary.tsx`, add the icon import (after the existing React Native import line near the top):
```tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
```

Add the optional prop to the component signature (the destructure list currently ends `onRestart,` and the type block has `onRestart: () => void;`). Add `onInfo,` to the destructure and `onInfo?: () => void;` to the type block.

Replace the decoupling block (lines 72-75, the `<View style={[styles.driftCard, ...]}>` containing the "Aerobic decoupling" label + value) with a `Pressable` that carries the ⓘ:
```tsx
      <Pressable
        style={[styles.driftCard, { borderColor: driftColor }]}
        onPress={onInfo}
        accessibilityRole="button"
        accessibilityLabel="What does decoupling mean?"
      >
        <View style={styles.driftHead}>
          <Text style={styles.driftLabel}>Aerobic decoupling</Text>
          <MaterialCommunityIcons name="information-outline" size={15} color="#94A3B8" />
        </View>
        <Text style={[styles.driftValue, { color: driftColor }]}>{driftText}</Text>
      </Pressable>
```

Add a `driftHead` style to the `StyleSheet.create({...})` block (after the existing `driftLabel` entry):
```tsx
  driftHead: { flexDirection: "row", alignItems: "center", gap: 6 },
```

Confirm `Pressable` is imported in this file (it is — line 2 imports `Pressable` for the "Run again" button). No new RN import needed beyond the icon.

- [ ] **Step 3: Pass onInfo through Dashboard**

In `src/ui/Dashboard.tsx`, add `onInfo,` to the destructured params (after `decoupling,`) and `onInfo?: () => void;` to the param type block (after `decoupling: Decoupling;`). Then pass it to the strip — change the existing render (around line 136):
```tsx
        <AnalysisStrip zones={zones} decoupling={decoupling} onInfo={onInfo} />
```

- [ ] **Step 4: Wire RunScreen — state, props, modal**

In `src/ui/RunScreen.tsx`:

(a) Add the modal import (after the existing `import { RunSummary } from "./RunSummary";` on line 29):
```tsx
import { AnalysisInfoModal } from "./AnalysisInfoModal";
```

(b) Add the open-state hook next to the other `useState` calls (after line 54, `const [routesOpen, setRoutesOpen] = useState(false);`):
```tsx
  const [infoOpen, setInfoOpen] = useState(false);
```

(c) In the finished/summary branch (the `<RunSummary ... />` element starting near line 166), add the `onInfo` prop and render the modal inside that branch's returned tree. The branch currently returns `<RunSummary .../>` directly; wrap it so both render:
```tsx
  if (engine.finished) {
    return (
      <>
        <RunSummary
          zones={fullZones}
          decoupling={fullDc}
          insights={insights}
          onInfo={() => setInfoOpen(true)}
          onRestart={() => {
            engine.seekToStart();
            engine.play();
            force((n) => n + 1);
          }}
        />
        <AnalysisInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
      </>
    );
  }
```
(Keep the existing `onRestart` body exactly as it already is in the file — only `onInfo` and the `<AnalysisInfoModal>` + fragment wrapper are added.)

(d) In the main run-view `return (` (near line 214), add `onInfo` to the `<Dashboard>` element (alongside its other props, e.g. right after `decoupling={dc}`):
```tsx
        onInfo={() => setInfoOpen(true)}
```
and render the modal once inside that returned tree. The main return's root element is a `<ScrollView>` that already holds the existing `<StravaPanel ... />` and `<RoutesPanel ... />` modals as sibling children near the end — add the explainer as another sibling right after the `<RoutesPanel ... />` element (still inside the root `<ScrollView>`):
```tsx
      <AnalysisInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
```

- [ ] **Step 5: Type-check the whole app**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full core suite (no regressions)**

Run: `npm test`
Expected: PASS — all suites green (no core code changed in this task; confirms nothing broke).

- [ ] **Step 7: Commit**

```bash
git add src/ui/AnalysisStrip.tsx src/ui/RunSummary.tsx src/ui/Dashboard.tsx src/ui/RunScreen.tsx
git commit -m "feat: tappable info affordance opens the analysis explainer"
```

---

### Task 4: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: nothing in code — mirrors the `src/core/glossary.ts` content (Drift bands + Zones table) so doc and app stay aligned.
- Produces: a project README.

- [ ] **Step 1: Write the README**

Create `README.md`:
```markdown
# RoutePulse — Replay Run

Load a Strava **GPX** file, replay it as a faux-live run, and watch a live
dashboard: route map, pace / distance / elapsed, heart rate, Karvonen zones,
and an **aerobic-decoupling ("Drift")** read-out. Cross-platform via Expo —
runs on iOS, Android, and the desktop browser. Tap the analysis panel in the
app for an in-context explainer.

## Run it

```bash
npm install
npm run web        # desktop browser (also: npm run ios / npm run android)
npm test           # pure-core unit tests (vitest)
```

## Understanding the metrics

### Drift (aerobic decoupling)

Drift compares the first and second half of your run and measures how much
your heart rate crept up to hold the same pace. **Lower is better — under 5%
is a solid, well-paced aerobic run.** It needs about 6 minutes of running
before it shows a number.

| Drift | Meaning |
|-------|---------|
| **< 5%** (good) | Heart rate held steady. Strong aerobic base, well paced. |
| **5–10%** (moderate) | Mild drift. Base still building, or you started too fast. |
| **≥ 10%** (high) | Heart rate climbed to hold pace. Went too hard, under-trained, hot, or under-fuelled. |

For a *steady aerobic* run, low drift is the goal. For a deliberately hard
session, drift naturally rises — read the zone mix instead.

### Heart-rate zones & fuel

Zones are bands of **Heart-Rate Reserve (HRR)**: `MaxHR = 211 − 0.64·age`,
`HRR = MaxHR − restingHR`. The fuel column answers "am I burning fat or
carbs?" — easy runs burn mostly fat, harder runs shift to carbohydrate.

| Zone | Range | Fuel | Meaning |
|------|-------|------|---------|
| Below Zone 2 | Under 60% HRR | Mostly fat | Very easy — warm-up or recovery pace. |
| Zone 2 · Aerobic | 60–70% HRR | Mostly fat | Easy aerobic base. Builds endurance and fat-burning efficiency. |
| Zone 3 · Tempo | 70–80% HRR | Fat + carbs | Comfortably hard. Shifts toward burning carbohydrate (glycogen). |
| Above Zone 3 | Over 80% HRR | Mostly carbs | Hard effort. Burns mostly carbohydrate; not for base-building. |

**Burning fat?** Spend time in Zone 2. **Burning carbs?** Push into Zone 3
and above — the zone-distribution bar shows how your time was spent.

## Project layout

- `src/core/` — pure, platform-agnostic TypeScript (GPX parse, geo math,
  Karvonen zones, replay engine, decoupling, coaching, glossary). Unit-tested
  with vitest; no React/React-Native imports.
- `src/ui/` — the Expo / React Native UI layer (dashboard, route map, route
  list, analysis strip, run summary, explainer modal).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with metrics glossary (drift + zones + fuel)"
```

---

## Self-Review

**Spec coverage (spec §s → tasks):**
- §1 Glossary content (core, pure, types + constants + content) → Task 1. ✓
- §2 Explainer modal (RoutesPanel pattern, drift + zones + fuel, rating palette) → Task 2. ✓
- §3 Affordance + wiring (ⓘ + optional `onInfo` on AnalysisStrip/RunSummary/Dashboard; RunScreen state + modal in both branches) → Task 3. ✓
- §4 README (what-it-is, run/test, metrics glossary, layout) → Task 4. ✓
- §5 Testing: core glossary test (Task 1); `tsc --noEmit` + manual smoke (Tasks 2-3). ✓
- Cross-module contracts (glossary exports; `AnalysisInfoModal({visible,onClose})`; `onInfo?`) → defined Task 1/2, consumed Task 3. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `ZoneInfo`/`DriftBand`/`DRIFT_INTRO`/`ZONE_INFO`/`DRIFT_BANDS` defined in Task 1, consumed verbatim in Task 2 (modal) and mirrored in Task 4 (README). `RATING_COLOR: Record<DecouplingRating, string>` palette identical to RunSummary's and the Global Constraints (`#0E7C7B`/`#B45309`/`#9D174D`). `AnalysisInfoModal({ visible, onClose })` signature identical at definition (Task 2) and both call sites (Task 3). `onInfo?: () => void` identical across AnalysisStrip/RunSummary/Dashboard (Task 3). `ZONE_THEME[id].color`/`.icon` usage matches the existing theme shape. ✓

**Scope:** Single feature slice (explainer + README), no decomposition needed. Additive/optional props — no breakage of the merged analysis work. ✓
```
