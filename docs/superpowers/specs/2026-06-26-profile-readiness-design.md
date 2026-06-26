# Profile Redesign + Sleep Readiness — Design

**Date:** 2026-06-26
**Project:** RoutePulse
**Slice:** Redesign the profile input (symbolic stat cards) and add sleep duration as a recovery input that adjusts the Karvonen zones (PRD FR-4.4 stress normalization, partial).
**Status:** Approved design, ready for implementation plan

---

## 1. Goal & Scope

Replace the plain three-text-input profile screen with a glanceable, symbolic
dark-Material screen, and capture **sleep last night** as a new input. Sleep
feeds a **readiness factor** that nudges the Karvonen zone thresholds: poor
sleep inflates heart rate, so the same HR reads one notch easier, protecting a
tired run's grade from being over-penalised.

### In scope
- `Profile` gains an optional `sleepHours`.
- Pure `readiness` core module: `readinessFactor`, `readinessLabel`.
- `effectiveHrr` wiring so zones (and fuel intensity) reflect today's readiness.
- Redesigned `ProfileScreen`: symbolic stat cards + steppers + live readiness +
  computed MaxHR/HRR readout, on the existing dark Material theme.
- A "zones eased today" note on `RunSummary` when readiness < 1.
- Stepper input clamping to sane ranges.

### Out of scope (deferred)
- Automated sleep scraping from Apple Health / Google Connect (FR-4.1) — manual
  entry only this slice.
- Heat-index normalisation (the other half of FR-4.4) — sleep only.
- Live `Dashboard` / replay-engine changes — profile + post-run analysis only.
- Body weight / biological sex (FR-3.1 remainder), dynamic RHR sync (FR-3.2).

---

## 2. Data Model

`src/core/karvonen.ts`:
```ts
export interface Profile {
  age: number;
  restingHr: number;
  sleepHours?: number; // hours slept last night; undefined = treat as rested
}
```
`sleepHours` is **optional** so every existing `Profile` literal (tests,
`deriveMetrics`, `zoneDistribution`, `fuel`) keeps compiling unchanged and
behaves exactly as today when it is absent.

---

## 3. Readiness Model (pure core)

New file `src/core/readiness.ts` — no React / RN / Expo imports.

```ts
export type ReadinessLevel = "ready" | "compromised" | "under";

// Recovery multiplier in [0.90, 1.00]. Undefined sleep = fully rested (1.00).
// >= 7h -> 1.00 ; linear 3h..7h ; <= 3h -> 0.90 floor.
export function readinessFactor(sleepHours?: number): number;
// factor >= 0.99 -> "ready" 🟢 ; >= 0.94 -> "compromised" 🟡 ; else "under" 🔴
export function readinessLevel(factor: number): ReadinessLevel;
```

Formula: `clamp(0.90, 1.00, 0.90 + ((h - 3) / 4) * 0.10)`.

| sleepHours | factor | level |
|------------|--------|-------|
| undefined / ≥ 7 | 1.000 | ready 🟢 |
| 6 | 0.975 | compromised 🟡 |
| 5 | 0.950 | compromised 🟡 |
| 4 | 0.925 | under 🔴 |
| ≤ 3 | 0.900 | under 🔴 |

`READINESS_THEME: Record<ReadinessLevel, { label; color; icon }>` lives in
`src/ui/theme.ts` (palette consistent with `ZONE_THEME`): ready `#0E7C7B` 🟢,
compromised `#B45309` 🟡, under `#9D174D` 🔴.

---

## 4. Zone Wiring — how sleep "determines HR"

`src/core/karvonen.ts` adds:
```ts
// HRR inflated by poor readiness: tired -> larger effective reserve ->
// the same HR is a smaller fraction -> lands in a lower (easier) zone.
export function effectiveHrr(profile: Profile): number {
  return hrr(profile) / readinessFactor(profile.sleepHours);
}
```
- `zoneBoundaryHr` changes its internal `hrr(profile)` call to
  `effectiveHrr(profile)`. `zoneForHr` already routes through `zoneBoundaryHr`,
  so all zone classification — and therefore `zoneDistribution`, `coaching`,
  `conclusion`, `zoneTimeline`, the live zone badge's post-run summary path —
  reflects readiness automatically.
- `src/core/fuel.ts` `intensityFromHr` changes its `hrr(profile)` call to
  `effectiveHrr(profile)`, so the fuel split is consistent (a tired run shows a
  lower intensity → higher fat share).
- `hrr(profile)` itself is **unchanged** (still `maxHr − restingHr`), preserving
  its contract and the displayed raw HRR readout.

When `sleepHours` is undefined or ≥ 7, `readinessFactor` is `1.0`, `effectiveHrr
=== hrr`, and every number is identical to today — a pure no-op for rested
profiles and existing tests.

---

## 5. Profile Screen Redesign

`src/ui/ProfileScreen.tsx` rebuilt on the dark Material theme (matching the
analysis UI: `#0B1220` body, `#16213A` cards, `#F1F5F9` text). A small reusable
`StatStepper` sub-component renders one metric.

Layout:
```
  Your profile
┌──────────────┐  ┌──────────────┐
│ 🎂 Age       │  │ ❤️ Resting HR │
│   [−] 35 [+] │  │  [−] 60 [+]   │
│    years     │  │    bpm        │
└──────────────┘  └──────────────┘
┌────────────────────────────────┐
│ 😴 Sleep last night             │
│        [−]  7.5 h  [+]          │
│   ████████○──  🟢 Ready         │
└────────────────────────────────┘
   🟢 Ready · MaxHR 189 · HRR 129
          [   Start run   ]
```

- Each `StatStepper`: icon + label, large value + unit, `−` / `+` buttons,
  each button ≥ 44×44 pt. Steppers replace free-text entry.
- Sleep card additionally shows a readiness bar (filled fraction =
  `(factor − 0.90) / 0.10`) and the readiness label/icon.
- Footer chip: live readiness label + `MaxHR ${Math.round(maxHr(age))}` +
  `HRR ${Math.round(hrr(profile))}` (raw HRR, the user's baseline).
- `Start run` button (primary, ≥ 48 pt) calls existing `onDone`.

Clamping (fixes a prior-slice follow-up):
- age ∈ [10, 100], step 1
- restingHr ∈ [30, 110], step 1
- sleepHours ∈ [0, 12], step 0.5

Props are unchanged from today: `{ profile, onChange, onDone }`. `onChange`
emits the updated `Profile` (now possibly carrying `sleepHours`).

`App.tsx` seeds the default profile with `sleepHours: 8`.

---

## 6. RunSummary Note

When `readinessFactor(profile.sleepHours) < 1`, `RunSummary` renders one line
near the top:
> 🟡 Low sleep ({sleepHours}h) — zones eased today

Keeps the modifier visible and honest. Hidden entirely when rested. Uses
`readinessFactor` + `READINESS_THEME`; no new props (RunSummary already receives
`profile`).

---

## 7. Error Handling / Edge Cases

- Missing sleep → factor 1.0, zones unchanged, no note. No crash.
- Stepper bounds prevent nonsensical values (e.g. restingHr ≥ maxHr).
- Floating-point sleep steps (0.5) are exact enough; bar fraction clamped [0,1].

---

## 8. Testing

Core (TDD, vitest):
- `readinessFactor`: undefined → 1.0; anchors 7/6/5/4/3; clamps above 7 and
  below 3.
- `readinessLevel`: boundaries ready/compromised/under.
- `effectiveHrr`: rested (undefined / ≥7h) equals raw `hrr`; tired (`< 7h`)
  strictly greater than raw `hrr`.
- `zoneForHr` shift: a borderline HR classified one zone lower under low sleep
  than when rested.
- `fuel.intensityFromHr`: lower intensity for the same HR when tired.

UI: `npx tsc --noEmit` clean; manual web smoke (steppers clamp, readiness bar +
label track sleep, footer MaxHR/HRR update, RunSummary note appears under low
sleep).

---

## 9. Components

- `src/core/readiness.ts` — `readinessFactor`, `readinessLevel`, `ReadinessLevel`.
- `src/core/karvonen.ts` — `Profile.sleepHours?`, `effectiveHrr`, `zoneBoundaryHr` rewire.
- `src/core/fuel.ts` — `intensityFromHr` rewire to `effectiveHrr`.
- `src/ui/theme.ts` — `READINESS_THEME`.
- `src/ui/ProfileScreen.tsx` — redesigned screen + `StatStepper`.
- `src/ui/RunSummary.tsx` — low-sleep note.
- `App.tsx` — seed `sleepHours: 8`.
