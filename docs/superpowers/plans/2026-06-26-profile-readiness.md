# Profile Redesign + Sleep Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sleep duration to the runner profile, derive a readiness factor that eases the Karvonen zones when under-slept, and redesign the profile screen as symbolic dark-Material stat cards.

**Architecture:** A pure-TS `readiness` core module maps sleep hours to a `[0.90, 1.00]` factor. `Profile` gains an optional `sleepHours`; a new `effectiveHrr` divides raw HRR by that factor, and the existing `zoneBoundaryHr` + `fuel.intensityFromHr` route through it — so every downstream zone/fuel calculation reflects readiness with no per-consumer change. The UI rebuilds `ProfileScreen` with stepper cards and a live readiness readout, and `RunSummary` shows a low-sleep note.

**Tech Stack:** TypeScript (strict), React Native / Expo, vitest. No new dependencies.

## Global Constraints

- TypeScript strict; no `any`.
- `src/core/` must NOT import from `react` / `react-native` / `expo` / `src/ui`. `src/core/readiness.ts` takes a plain number and must NOT import `karvonen` (avoid an import cycle — `karvonen` imports `readiness`, not the reverse).
- `Profile.sleepHours` is OPTIONAL. `undefined` ⇒ `readinessFactor` returns `1.0` ⇒ `effectiveHrr === hrr` ⇒ identical behaviour to today. Existing `Profile` literals and tests must keep passing unchanged.
- `hrr(profile)` keeps its existing contract (`maxHr − restingHr`, raw, no readiness). Only `effectiveHrr` applies readiness.
- Readiness factor: `clamp(0.90, 1.00, 0.90 + ((h − 3) / 4) * 0.10)`; `undefined` ⇒ `1.0`. Anchors: 7h→1.00, 6h→0.975, 5h→0.95, 4h→0.925, 3h→0.90.
- Readiness levels: factor ≥ 0.99 → `ready` 🟢 `#0E7C7B`; ≥ 0.94 → `compromised` 🟡 `#B45309`; else `under` 🔴 `#9D174D`.
- Stepper clamps: age ∈ [10,100] step 1; restingHr ∈ [30,110] step 1; sleepHours ∈ [0,12] step 0.5.
- Scope: profile + post-run analysis only. Do NOT touch `Dashboard.tsx`, `RunScreen.tsx`, or the replay engine.
- UI components return `React.JSX.Element` (repo convention; @types/react v19 dropped the global JSX namespace).
- TDD for core: failing test, minimal code, passing test, commit.

---

### Task 1: Readiness core module

**Files:**
- Create: `src/core/readiness.ts`
- Test: `src/core/__tests__/readiness.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ReadinessLevel = "ready" | "compromised" | "under"`
  - `function readinessFactor(sleepHours?: number): number` — `[0.90,1.00]`; `undefined` ⇒ `1.0`.
  - `function readinessLevel(factor: number): ReadinessLevel`

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/readiness.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readinessFactor, readinessLevel } from "../readiness";

describe("readinessFactor", () => {
  it("treats undefined sleep as fully rested", () => {
    expect(readinessFactor(undefined)).toBe(1);
  });
  it("is 1.0 at 7h and clamps above", () => {
    expect(readinessFactor(7)).toBeCloseTo(1, 5);
    expect(readinessFactor(9)).toBe(1);
  });
  it("interpolates linearly between 3h and 7h", () => {
    expect(readinessFactor(6)).toBeCloseTo(0.975, 5);
    expect(readinessFactor(5)).toBeCloseTo(0.95, 5);
    expect(readinessFactor(4)).toBeCloseTo(0.925, 5);
  });
  it("floors at 0.90 at 3h and below", () => {
    expect(readinessFactor(3)).toBeCloseTo(0.9, 5);
    expect(readinessFactor(0)).toBe(0.9);
  });
});

describe("readinessLevel", () => {
  it("ready at full readiness", () => {
    expect(readinessLevel(1)).toBe("ready");
    expect(readinessLevel(0.99)).toBe("ready");
  });
  it("compromised in the mid band", () => {
    expect(readinessLevel(0.975)).toBe("compromised");
    expect(readinessLevel(0.94)).toBe("compromised");
  });
  it("under below the mid band", () => {
    expect(readinessLevel(0.925)).toBe("under");
    expect(readinessLevel(0.9)).toBe("under");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/readiness.test.ts`
Expected: FAIL — cannot find module `../readiness`.

- [ ] **Step 3: Write the implementation**

Create `src/core/readiness.ts`:
```ts
export type ReadinessLevel = "ready" | "compromised" | "under";

function clamp(min: number, max: number, x: number): number {
  return Math.min(max, Math.max(min, x));
}

// Recovery multiplier in [0.90, 1.00]. Undefined sleep = fully rested (1.00).
// >= 7h -> 1.00 ; linear over 3h..7h ; <= 3h -> 0.90 floor.
export function readinessFactor(sleepHours?: number): number {
  if (sleepHours === undefined) return 1;
  return clamp(0.9, 1, 0.9 + ((sleepHours - 3) / 4) * 0.1);
}

// 🟢 ready (>=0.99) / 🟡 compromised (>=0.94) / 🔴 under (else)
export function readinessLevel(factor: number): ReadinessLevel {
  if (factor >= 0.99) return "ready";
  if (factor >= 0.94) return "compromised";
  return "under";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/readiness.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/readiness.ts src/core/__tests__/readiness.test.ts
git commit -m "feat: add sleep-based readiness factor"
```

---

### Task 2: Profile.sleepHours + effectiveHrr zone/fuel wiring

**Files:**
- Modify: `src/core/karvonen.ts`
- Modify: `src/core/fuel.ts`
- Test: `src/core/__tests__/karvonen.test.ts`
- Test: `src/core/__tests__/fuel.test.ts`

**Interfaces:**
- Consumes: `readinessFactor` from `./readiness` (Task 1).
- Produces:
  - `interface Profile { age: number; restingHr: number; sleepHours?: number }`
  - `function effectiveHrr(profile: Profile): number` — `hrr(profile) / readinessFactor(profile.sleepHours)`.
  - `zoneBoundaryHr` and `fuel.intensityFromHr` now use `effectiveHrr`.

- [ ] **Step 1: Write the failing tests (karvonen)**

In `src/core/__tests__/karvonen.test.ts`, add `effectiveHrr` to the existing import from `../karvonen` (the file already imports `maxHr, hrr, zoneBoundaryHr, zoneForHr` and defines `const profile = { age: 30, restingHr: 60 }`). Then append:
```ts
describe("effectiveHrr (readiness)", () => {
  it("equals raw HRR when rested (no sleepHours)", () => {
    expect(effectiveHrr(profile)).toBeCloseTo(hrr(profile), 5);
  });
  it("equals raw HRR at 7h+ sleep", () => {
    expect(effectiveHrr({ ...profile, sleepHours: 8 })).toBeCloseTo(hrr(profile), 5);
  });
  it("is larger than raw HRR when under-slept", () => {
    const tired = { ...profile, sleepHours: 4 };
    expect(effectiveHrr(tired)).toBeGreaterThan(hrr(tired));
  });
});

describe("zoneForHr under low sleep", () => {
  it("reads one zone easier when tired", () => {
    // rested HRR = 131.8 ; z3 lower boundary = 0.7*131.8 + 60 = 152.26
    const hrAt = zoneBoundaryHr(profile, 0.7) + 1; // just inside zone3 when rested
    expect(zoneForHr(hrAt, profile)).toBe("zone3");
    expect(zoneForHr(hrAt, { ...profile, sleepHours: 4 })).toBe("zone2");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/__tests__/karvonen.test.ts`
Expected: FAIL — `effectiveHrr` is not exported.

- [ ] **Step 3: Edit karvonen.ts**

In `src/core/karvonen.ts`, add this import as the first line of the file:
```ts
import { readinessFactor } from "./readiness";
```
Change the `Profile` interface to:
```ts
export interface Profile {
  age: number;
  restingHr: number;
  sleepHours?: number;
}
```
Add `effectiveHrr` immediately after the `hrr` function:
```ts
// HRR inflated by poor sleep readiness: a tired runner's elevated HR is read as
// a smaller fraction of reserve, so the same HR lands in a lower (easier) zone.
export function effectiveHrr(profile: Profile): number {
  return hrr(profile) / readinessFactor(profile.sleepHours);
}
```
Change `zoneBoundaryHr` to use `effectiveHrr`:
```ts
export function zoneBoundaryHr(profile: Profile, pct: number): number {
  return pct * effectiveHrr(profile) + profile.restingHr;
}
```
(Leave `maxHr`, `hrr`, and `zoneForHr` otherwise unchanged.)

- [ ] **Step 4: Run to verify karvonen passes**

Run: `npx vitest run src/core/__tests__/karvonen.test.ts`
Expected: PASS (existing karvonen tests + the 4 new ones).

- [ ] **Step 5: Write the failing test (fuel)**

In `src/core/__tests__/fuel.test.ts` (which already defines `const profile: Profile = { age: 30, restingHr: 60 }` and imports `intensityFromHr`), append:
```ts
describe("intensityFromHr under low sleep", () => {
  it("reads a lower intensity for the same HR when tired", () => {
    const rested = intensityFromHr(150, profile)!;
    const tired = intensityFromHr(150, { ...profile, sleepHours: 4 })!;
    expect(tired).toBeLessThan(rested);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/core/__tests__/fuel.test.ts`
Expected: FAIL — `tired` still equals `rested` (fuel still uses raw `hrr`).

- [ ] **Step 7: Edit fuel.ts**

In `src/core/fuel.ts`, change the import line:
```ts
import { hrr, zoneForHr, type Profile, type ZoneId } from "./karvonen";
```
to:
```ts
import { effectiveHrr, zoneForHr, type Profile, type ZoneId } from "./karvonen";
```
Then in `intensityFromHr`, change:
```ts
  const reserve = hrr(profile);
```
to:
```ts
  const reserve = effectiveHrr(profile);
```

- [ ] **Step 8: Run the full core suite**

Run: `npm test`
Expected: PASS — all core tests green (existing suites unchanged because `sleepHours` is absent everywhere else; new readiness/zone/fuel assertions pass).

- [ ] **Step 9: Commit**

```bash
git add src/core/karvonen.ts src/core/fuel.ts src/core/__tests__/karvonen.test.ts src/core/__tests__/fuel.test.ts
git commit -m "feat: ease Karvonen zones by sleep readiness via effectiveHrr"
```

---

### Task 3: READINESS_THEME + redesigned ProfileScreen + App seed

**Files:**
- Modify: `src/ui/theme.ts`
- Modify: `src/ui/ProfileScreen.tsx` (full rewrite)
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `maxHr`, `hrr`, `Profile` from `../core/karvonen`; `readinessFactor`, `readinessLevel` from `../core/readiness`; `READINESS_THEME` from `./theme`.
- Produces: `const READINESS_THEME: Record<ReadinessLevel, { label: string; color: string; icon: string }>`. `ProfileScreen` keeps its existing props `{ profile, onChange, onDone }`.

- [ ] **Step 1: Add READINESS_THEME**

In `src/ui/theme.ts`, add to the existing top import:
```ts
import type { ReadinessLevel } from "../core/readiness";
```
and append at the end of the file:
```ts
export const READINESS_THEME: Record<ReadinessLevel, { label: string; color: string; icon: string }> = {
  ready: { label: "Ready", color: "#0E7C7B", icon: "🟢" },
  compromised: { label: "Compromised", color: "#B45309", icon: "🟡" },
  under: { label: "Under-recovered", color: "#9D174D", icon: "🔴" },
};
```

- [ ] **Step 2: Rewrite ProfileScreen.tsx**

Replace the entire contents of `src/ui/ProfileScreen.tsx` with:
```tsx
import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import type { Profile } from "../core/karvonen";
import { maxHr, hrr } from "../core/karvonen";
import { readinessFactor, readinessLevel } from "../core/readiness";
import { READINESS_THEME } from "./theme";

function clamp(min: number, max: number, x: number): number {
  return Math.min(max, Math.max(min, x));
}

function StatStepper({
  icon,
  label,
  value,
  unit,
  onStep,
}: {
  icon: string;
  label: string;
  value: string;
  unit: string;
  onStep: (dir: 1 | -1) => void;
}): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>
        {icon} {label}
      </Text>
      <View style={styles.stepRow}>
        <Pressable
          onPress={() => onStep(-1)}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={styles.stepBtn}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.cardValue}>{value}</Text>
        <Pressable
          onPress={() => onStep(1)}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={styles.stepBtn}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.cardUnit}>{unit}</Text>
    </View>
  );
}

export function ProfileScreen({
  profile,
  onChange,
  onDone,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onDone: () => void;
}): React.JSX.Element {
  const sleep = profile.sleepHours ?? 8;
  const factor = readinessFactor(profile.sleepHours);
  const theme = READINESS_THEME[readinessLevel(factor)];
  const barFraction = clamp(0, 1, (factor - 0.9) / 0.1);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Your profile</Text>

      <View style={styles.row}>
        <StatStepper
          icon="🎂"
          label="Age"
          value={String(profile.age)}
          unit="years"
          onStep={(d) => onChange({ ...profile, age: clamp(10, 100, profile.age + d) })}
        />
        <StatStepper
          icon="❤️"
          label="Resting HR"
          value={String(profile.restingHr)}
          unit="bpm"
          onStep={(d) => onChange({ ...profile, restingHr: clamp(30, 110, profile.restingHr + d) })}
        />
      </View>

      <View style={styles.sleepCard}>
        <Text style={styles.cardLabel}>😴 Sleep last night</Text>
        <View style={styles.stepRow}>
          <Pressable
            onPress={() => onChange({ ...profile, sleepHours: clamp(0, 12, sleep - 0.5) })}
            accessibilityRole="button"
            accessibilityLabel="Decrease sleep"
            style={styles.stepBtn}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <Text style={styles.cardValue}>{sleep.toFixed(1)} h</Text>
          <Pressable
            onPress={() => onChange({ ...profile, sleepHours: clamp(0, 12, sleep + 0.5) })}
            accessibilityRole="button"
            accessibilityLabel="Increase sleep"
            style={styles.stepBtn}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { flex: barFraction, backgroundColor: theme.color }]} />
          <View style={{ flex: 1 - barFraction }} />
        </View>
        <Text style={[styles.readyText, { color: theme.color }]}>
          {theme.icon} {theme.label}
        </Text>
      </View>

      <Text style={styles.summary}>
        {theme.icon} {theme.label} · MaxHR {Math.round(maxHr(profile.age))} · HRR {Math.round(hrr(profile))}
      </Text>

      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Start run"
        style={styles.startBtn}
      >
        <Text style={styles.startText}>Start run</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    gap: 16,
    padding: 16,
    justifyContent: "center",
    backgroundColor: "#0B1220",
  },
  title: { color: "#F1F5F9", fontSize: 22, fontWeight: "700" },
  row: { flexDirection: "row", gap: 12 },
  card: { flex: 1, backgroundColor: "#16213A", borderRadius: 16, padding: 16, gap: 8, alignItems: "center" },
  sleepCard: { backgroundColor: "#16213A", borderRadius: 16, padding: 16, gap: 10 },
  cardLabel: { color: "#94A3B8", fontSize: 14, fontWeight: "600" },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  stepBtn: { minWidth: 44, minHeight: 44, borderRadius: 12, backgroundColor: "#0B1220", alignItems: "center", justifyContent: "center" },
  stepBtnText: { color: "#F1F5F9", fontSize: 24, fontWeight: "700" },
  cardValue: { color: "#F1F5F9", fontSize: 28, fontWeight: "800", minWidth: 64, textAlign: "center" },
  cardUnit: { color: "#64748B", fontSize: 12 },
  barTrack: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: "#0B1220" },
  barFill: { borderRadius: 5 },
  readyText: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  summary: { color: "#94A3B8", fontSize: 14, textAlign: "center" },
  startBtn: { minHeight: 48, borderRadius: 12, backgroundColor: "#0E7C7B", alignItems: "center", justifyContent: "center", marginTop: 4 },
  startText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 3: Seed sleepHours in App.tsx**

In `App.tsx`, change:
```ts
  const [profile, setProfile] = useState<Profile>({ age: 35, restingHr: 60 });
```
to:
```ts
  const [profile, setProfile] = useState<Profile>({ age: 35, restingHr: 60, sleepHours: 8 });
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/theme.ts src/ui/ProfileScreen.tsx App.tsx
git commit -m "feat: redesign profile screen with stat cards + sleep readiness"
```

---

### Task 4: Low-sleep note on RunSummary

**Files:**
- Modify: `src/ui/RunSummary.tsx`

**Interfaces:**
- Consumes: `readinessFactor`, `readinessLevel` from `../core/readiness`; `READINESS_THEME` from `./theme`.
- Produces: a conditional note shown when readiness < 1. No new props (RunSummary already receives `profile`).

- [ ] **Step 1: Add imports**

In `src/ui/RunSummary.tsx`, change the theme import:
```ts
import { ZONE_THEME } from "./theme";
```
to:
```ts
import { ZONE_THEME, READINESS_THEME } from "./theme";
```
and add after it:
```ts
import { readinessFactor, readinessLevel } from "../core/readiness";
```

- [ ] **Step 2: Compute readiness**

In `src/ui/RunSummary.tsx`, immediately after the line `const fuel = fuelSplit(points, profile);` add:
```ts
  const readiness = readinessFactor(profile.sleepHours);
```

- [ ] **Step 3: Render the note**

In `src/ui/RunSummary.tsx`, find:
```tsx
      <Text style={styles.title}>Run analysis</Text>

      <ZoneBar zones={zones} height={18} />
```
Replace with (insert the note between the title and the ZoneBar):
```tsx
      <Text style={styles.title}>Run analysis</Text>

      {readiness < 1 ? (
        <Text style={[styles.sleepNote, { color: READINESS_THEME[readinessLevel(readiness)].color }]}>
          {READINESS_THEME[readinessLevel(readiness)].icon} Low sleep ({profile.sleepHours}h) — zones eased today
        </Text>
      ) : null}

      <ZoneBar zones={zones} height={18} />
```

- [ ] **Step 4: Add the style**

In `src/ui/RunSummary.tsx`, inside the `StyleSheet.create({ ... })` block, add after the `title` style entry:
```ts
  sleepNote: { fontSize: 13, fontWeight: "600", textAlign: "center" },
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — all core tests green.

- [ ] **Step 7: Manual smoke on web**

Run: `npx expo start --web`
Expected: profile screen shows three stepper cards (🎂 Age, ❤️ Resting HR, 😴 Sleep); −/+ adjust and clamp at bounds; lowering sleep below 7h drops the readiness bar/label to 🟡 then 🔴 and the footer MaxHR/HRR stays correct; Start run → finish a replay → Run analysis shows the "Low sleep — zones eased today" note (only when sleep < 7h) and the zone distribution shifts easier versus a rested profile.

- [ ] **Step 8: Commit**

```bash
git add src/ui/RunSummary.tsx
git commit -m "feat: flag low-sleep zone easing on the run summary"
```

---

## Self-Review

**Spec coverage (design §s → tasks):**
- §2 `Profile.sleepHours?` → Task 2 Step 3. ✓
- §3 `readinessFactor` / `readinessLevel` / curve + levels → Task 1. ✓
- §4 `effectiveHrr` + `zoneBoundaryHr` + `fuel.intensityFromHr` rewire → Task 2. ✓
- §5 redesigned ProfileScreen (stat cards, steppers, readiness bar, MaxHR/HRR readout, clamps, Start run) + App seed → Task 3. ✓
- §6 RunSummary low-sleep note → Task 4. ✓
- §7 error handling (undefined ⇒ no-op, clamped bounds) → Task 1 (undefined branch), Task 3 (clamps). ✓
- §8 testing (readinessFactor/level, effectiveHrr, zone shift, intensity shift; UI tsc + manual) → Tasks 1–4. ✓
- §9 components → Tasks 1–4 cover every listed file. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code or an exact find/replace anchor. ✓

**Type consistency:** `ReadinessLevel` defined in Task 1, consumed by `READINESS_THEME` (Task 3) and `readinessLevel` callers (Tasks 3, 4). `readinessFactor(sleepHours?: number)` signature consistent across Tasks 1/2/3/4. `effectiveHrr(profile)` defined in Task 2, consumed by `zoneBoundaryHr` (Task 2) and `fuel.intensityFromHr` (Task 2). `Profile.sleepHours?` defined in Task 2, read in Tasks 3/4 and seeded in Task 3. `READINESS_THEME` shape (`label`/`color`/`icon`) defined Task 3, consumed Tasks 3/4. ProfileScreen props `{ profile, onChange, onDone }` unchanged from the current file. ✓

**Cycle check:** `karvonen` imports `readiness`; `readiness` imports nothing — no cycle. `fuel` imports `effectiveHrr` from `karvonen` (already depended on `karvonen`). ✓

**Deferred (not this slice):** automated sleep scraping (FR-4.1), heat-index normalisation (other half of FR-4.4), live Dashboard readiness, body weight / biological sex (FR-3.1), dynamic RHR sync (FR-3.2).
