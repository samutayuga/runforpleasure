# Run Conclusion (Bottom Line + Grade) — Design

**Date:** 2026-06-25
**Status:** Approved design, pre-plan
**Builds on:** `2026-06-25-run-analysis-design.md` (zoneDistribution, decoupling, coaching `runInsights`, RunSummary). Same branch family (`feat/run-analysis`).

## Goal

End the post-run summary with a single synthesized **Bottom Line**: a letter grade, a one-line verdict on the session, and the single most useful recommendation — a TL;DR that complements (does not replace) the existing insight cards.

## Non-Goals

- No change to the analysis math, the insight cards (`runInsights`), or the zone timeline.
- No per-metric scoring breakdown, no history/trend grading (single-run only).
- No user intent capture — the grade uses an aerobic-base framing (the app's Zone 2 thesis), stated plainly.

## Architecture

The synthesis is pure, tested logic in `src/core/conclusion.ts` (`runConclusion`), mirroring how `coaching.ts` derives `runInsights`. A small `ConclusionCard` presentational component renders it at the end of `RunSummary`. `RunSummary` already receives `zones` and `decoupling`, so it computes the conclusion inline — no new props, no `RunScreen` change.

### Global constraints

- TypeScript strict; no `any` in committed code.
- `src/core/` MUST NOT import from react/react-native/expo/ui — pure & platform-agnostic.
- No new dependencies.
- Reuse `ZoneDistribution` (`src/core/zoneDistribution.ts`), `Decoupling` (`src/core/decoupling.ts`), and the `good/watch/act` severity palette already in `RunSummary` (`good #0E7C7B`, `watch #B45309`, `act #9D174D`).
- Component return types use `React.JSX.Element`.
- Accessibility: tone conveyed by the worded verdict + label, never color alone; the card has an `accessibilityLabel`.
- TDD for the core module: failing test first, minimal code, passing test, commit.

## §1 — Conclusion logic (pure core)

**File:** `src/core/conclusion.ts`, test `src/core/__tests__/conclusion.test.ts`.

**Consumes:** `ZoneDistribution` from `./zoneDistribution`; `Decoupling` from `./decoupling`.

**Produces:**

```ts
export type Grade = "A" | "B" | "C" | "D";

export interface Conclusion {
  grade: Grade | null;       // null = "—", insufficient HR to grade
  verdict: string;           // one-line session assessment
  recommendation: string;    // single most useful next step
  tone: "good" | "watch" | "act";
}

export function runConclusion(zones: ZoneDistribution, dc: Decoupling): Conclusion;
```

**Insufficient-data guard (computed first):**
`hrMissing = zones.totalSec > 0 ? zones.unknownSec / zones.totalSec : 1`.
If `zones.totalSec === 0 || hrMissing > 0.5` → return `{ grade: null, verdict: "Incomplete — heart rate mostly missing.", recommendation: "Connect a heart-rate strap to grade this run.", tone: "watch" }`. (Grade `null` renders as "—".)

**Grade (otherwise), score then map:**
- `aerobicShare = zones.pctByZone.below + zones.pctByZone.zone2`.
- drift points from `dc.rating`: `"good"` → 2, `"moderate"` → 1, `"high"` → 0, `null` → 1.
- aerobic points: `aerobicShare >= 70` → 2; else `aerobicShare >= 50` → 1; else 0.
- penalty: `zones.pctByZone.above > 20` → −1 (else 0).
- `score = driftPts + aerobicPts + penalty` (range −1..4).
- map: `score >= 4` → `"A"`; `=== 3` → `"B"`; `=== 2` → `"C"`; else (`<= 1`) → `"D"`.

**Verdict + recommendation + tone (otherwise), evaluated in this exact order, first match wins:**
1. `dc.rating === "high" || zones.pctByZone.above > 20` → tone `"act"`, verdict `"Ran too hard for base-building."`, recommendation `"Slow down — start easier and spend more time in Zone 2."`
2. `dc.rating === "moderate" || (aerobicShare >= 50 && aerobicShare < 70)` → tone `"watch"`, verdict `"Decent aerobic session with some drift."`, recommendation `"Hold the easy pace longer and ease your start."`
3. else → tone `"good"`, verdict `"Solid Zone 2 aerobic session."`, recommendation `"Great base work — repeat it and gradually extend the distance."`

(The missing-HR guard already returned before this block, so these three are exhaustive.)

These are the only thresholds; keeping them here (not in JSX) makes them unit-testable.

## §2 — UI

**File:** `src/ui/ConclusionCard.tsx`.

**Consumes:** `Conclusion` from `../core/conclusion`; RN `View`/`Text`/`StyleSheet`.

**Produces:** `function ConclusionCard(props: { conclusion: Conclusion }): React.JSX.Element` — a "Bottom line" block:
- A header row: the label `BOTTOM LINE` (muted, letter-spaced) and a grade badge — a tone-colored rounded square showing `conclusion.grade ?? "—"`.
- The `verdict` in bold primary text.
- A `Next: <recommendation>` line in muted text.
- The card has a left border / subtle background in the tone color (`good #0E7C7B / watch #B45309 / act #9D174D`).
- `accessibilityLabel`: e.g. `"Bottom line, grade B. Solid Zone 2 aerobic session. Next: …"`.

**`RunSummary.tsx`:** compute `const conclusion = runConclusion(zones, decoupling);` (both already in scope as props) and render `<ConclusionCard conclusion={conclusion} />` at the END of the summary — after the `insights.map(...)` cards and immediately before the "Run again" `Pressable`. Import `runConclusion` from `../core/conclusion` and `ConclusionCard` from `./ConclusionCard`. No prop or `RunScreen` change.

## §3 — Testing

- **`conclusion.test.ts`** (vitest, pure): grade boundaries — craft `(zones, dc)` inputs giving score 4→A, 3→B, 2→C, ≤1→D; `grade null` when `totalSec===0` and when `unknownSec/totalSec > 0.5`; each verdict/tone branch fires (high-drift→act, moderate→watch, good→good); `above% > 20` forces act + penalty; every result has a non-empty `verdict` and `recommendation`.
- **UI** (`ConclusionCard`, RunSummary render): `npx tsc --noEmit` clean + manual web smoke — the summary ends with the Bottom Line block showing a grade badge, verdict, and "Next:" line, tone-colored; a no-HR run shows grade "—" with the incomplete verdict; the insight cards remain above it.

## Interface summary

- `runConclusion(zones, dc) → Conclusion` — `core/conclusion.ts`, consumed by `RunSummary` (inline) → `ConclusionCard`.
- `ConclusionCard({ conclusion })` — consumed by `RunSummary`. No other contract changes.

## Self-Review notes

- Synthesis lives in pure tested core; the card is declarative — mirrors the `coaching`/`RunSummary` split.
- Reuses the existing severity palette and the `ZoneDistribution`/`Decoupling` structs — no new deps, no new color language.
- Computed inline from props `RunSummary` already holds → zero `RunScreen` churn; additive (one card appended).
- Complements the insight cards (detail) with a single takeaway (TL;DR), per the approved "closing takeaway" placement.
- Grade framing (aerobic base) is explicit; `null` grade honestly signals insufficient HR rather than inventing a score.
