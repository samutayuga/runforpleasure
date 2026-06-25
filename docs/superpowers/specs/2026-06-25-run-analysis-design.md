# Run Analysis: Aerobic Decoupling + Zone Distribution — Design

**Date:** 2026-06-25
**Status:** Approved design, pre-plan
**Builds on:** `2026-06-24-replay-run-slice-design.md` (parser, geo, karvonen, replay engine, metrics, projection, dashboard).

## Goal

Turn the run data we already parse (lat/lon, elevation, time, HR) into two analysis features plus derived coaching:

1. **Zone distribution** — how the run's time splits across the 4 existing Karvonen buckets.
2. **Aerobic decoupling** — does cardiovascular efficiency hold across the run (HR drift vs pace).
3. **Coaching insights** — plain-language "what to improve and how", derived from the two analyses.

Both analyses surface **live** (running tally during replay) **and** in a **post-run summary**.

## Non-Goals (this slice)

- Live GPS / BLE capture (deferred — replays files only).
- Cross-run / same-route trend charts (separate future slice).
- 5-zone model, grade-adjusted pace, ghost pacer, weather normalization, persistence.

## Architecture

Pure-TypeScript `core/` modules (no `react`/`react-native`/`expo`/`ui` imports), vitest-tested, consumed by thin `ui/` components. Matches the existing one-file-one-purpose `core/` convention (geo, karvonen, metrics). Selected approach: **two focused core modules** for the analyses + one for coaching, not a single combined module — keeps each concern independently testable.

Live vs summary use the **same** core functions: live passes an `endIndex` slice (`engine.index`); summary omits it (full run).

### Global constraints

- TypeScript strict; no `any` in committed code.
- `core/` stays pure and platform-agnostic.
- No new dependencies.
- Reuse the existing 4 zone buckets (`ZoneId` = `below | zone2 | zone3 | above`) and `ZONE_THEME`. No new zone model, no new colors.
- TDD: failing test first, minimal code, passing test, commit — per module.

## §1 — Zone distribution (core)

**File:** `src/core/zoneDistribution.ts`, test `src/core/__tests__/zoneDistribution.test.ts`.

**Consumes:** `TrackPoint` from `./types`, `zoneForHr` + `Profile` + `ZoneId` from `./karvonen`.

**Produces:**

```ts
export interface ZoneDistribution {
  secondsByZone: Record<ZoneId, number>;
  pctByZone: Record<ZoneId, number>; // % of TOTAL incl. unknown; 0 when total 0
  unknownSec: number;                // dwell time with null HR (zone undecidable)
  totalSec: number;                  // sum of all dwell incl. unknown
}

export function zoneDistribution(
  points: TrackPoint[],
  profile: Profile,
  endIndex?: number,
): ZoneDistribution;
```

**Algorithm:**

- Consider points `[0 .. end]` where `end = endIndex ?? points.length - 1`, clamped to `[0, points.length-1]`.
- For each consecutive pair `(i, i+1)` in range: `dwell = (points[i+1].time - points[i].time) / 1000` seconds, attributed to the zone of the **earlier** point: `zoneForHr(points[i].hr, profile)`.
  - non-null zone → `secondsByZone[zone] += dwell`.
  - null zone → `unknownSec += dwell`.
- `totalSec` = sum of all dwell (zones + unknown).
- `pctByZone[z] = totalSec > 0 ? secondsByZone[z] / totalSec * 100 : 0`.
- Edge: `points.length < 2` or `end === 0` → all zeros, `totalSec = 0`.

**Live use:** `endIndex = engine.index`. Accumulates monotonically, stable from the first frame (zeros until two points are passed).

## §2 — Aerobic decoupling (core)

**File:** `src/core/decoupling.ts`, test `src/core/__tests__/decoupling.test.ts`.

**Consumes:** `TrackPoint` from `./types`. Takes the precomputed `cumulative` distances array (from `cumulativeDistances` in `./geo`) so it does not recompute geo.

**Produces:**

```ts
export type DecouplingRating = "good" | "moderate" | "high";

export interface Decoupling {
  firstEf: number | null;  // efficiency factor, first half (speed per heartbeat-second)
  secondEf: number | null; // second half
  pct: number | null;      // (firstEf - secondEf) / firstEf * 100
  rating: DecouplingRating | null;
}

export function decoupling(
  points: TrackPoint[],
  cumulative: number[],
  endIndex?: number,
): Decoupling;
```

**Algorithm (time-halves, whole run):**

- Range `[0 .. end]`, `end = endIndex ?? points.length - 1`, clamped.
- `elapsed = points[end].time - points[0].time` (ms). `mid = points[0].time + elapsed/2`.
- Split range into first half (points with `time <= mid`) and second half (`time > mid`), each kept as contiguous index ranges.
- **EF per half** = `metersInHalf / hrSecondsInHalf`, where:
  - `metersInHalf` = `cumulative[lastIdx] - cumulative[firstIdx]` for that half's index span.
  - `hrSecondsInHalf` = `Σ over consecutive pairs in the half of (hr_earlier · Δt_seconds)`, **skipping pairs whose earlier point has null HR**.
  - If a half has `hrSeconds <= 0` (no HR samples) or `meters <= 0` → that half's EF is `null`.
- `pct = (firstEf - secondEf) / firstEf * 100` when both EFs are non-null and `firstEf > 0`; else `null`.
  - Positive pct = efficiency dropped in second half (HR drifted up / slowed) = decoupling.
- **Rating** (only when `pct !== null`): `pct < 5` → `good`; `5 <= pct < 10` → `moderate`; `pct >= 10` → `high`. Negative pct (efficiency improved) → `good`.

**Live guard:** return `{ firstEf:null, secondEf:null, pct:null, rating:null }` until **both**:
1. `elapsed >= 6 * 60 * 1000` (6 min), AND
2. both halves yield non-null EF.

Avoids unstable early numbers. Live UI renders `"—"` until the guard clears; summary always settles on the full run (same guard, but a full run normally clears it).

## §3 — Coaching insights (core)

**File:** `src/core/coaching.ts`, test `src/core/__tests__/coaching.test.ts`.

**Consumes:** `ZoneDistribution` (§1), `Decoupling` (§2).

**Produces:**

```ts
export type InsightSeverity = "good" | "watch" | "act";

export interface Insight {
  headline: string;
  detail: string;
  severity: InsightSeverity;
}

export function runInsights(zones: ZoneDistribution, dc: Decoupling): Insight[];
```

**Rules** (evaluated in order; every matching rule emits one `Insight`; percentages in copy rounded to integer):

| # | Condition | severity | headline / detail |
|---|-----------|----------|-------------------|
| 1 | `dc.pct !== null && dc.pct >= 10` | act | "High cardiac drift (+N%)" / "HR climbed late in the run. Start easier and add slow Zone 2 volume." |
| 2 | `dc.pct !== null && 5 <= dc.pct < 10` | watch | "Mild cardiac drift (+N%)" / "Aerobic base is building. Keep easy days genuinely easy." |
| 3 | `dc.pct !== null && dc.pct < 5` | good | "Strong aerobic coupling (N%)" / "Efficiency held across the run — well paced." |
| 4 | `zones.pctByZone.above > 20` | act | "N% above Zone 3" / "Too hard for base-building. Slow down to spend more time in Zone 2." |
| 5 | `zones.pctByZone.zone2 >= 60` | good | "N% in Zone 2" / "Textbook aerobic session — this builds your engine." |
| 6 | `zones.totalSec > 0 && zones.unknownSec / zones.totalSec > 0.2` | watch | "HR missing for N% of the run" / "Connect a strap for accurate zones and drift." |

- Rules 1–3 are mutually exclusive by construction (pct falls in one band); 4–6 are independent and may co-fire.
- Empty/degenerate input (all-null decoupling, zero total) → only rule 6 can fire (if unknown dominates); otherwise `[]`.
- Copy shows `+N%` for positive drift; rule 3 shows the raw value (may be `0%` or negative) without a forced `+`.

## §4 — UI surfaces

No core changes for UI; both surfaces call the §1–§3 functions.

**Live (extend `src/ui/Dashboard.tsx` or a small sibling component):**
- Compact strip beneath the HR/zone badge:
  - **Mini stacked zone bar** — 4 segments widthed by `pctByZone`, colored from `ZONE_THEME`. Unknown segment uses the `below` grey or a neutral; label/legend conveys zone (never color-only, per existing accessibility rule).
  - **Decoupling readout** — `"+4%"` / `"—"` (before guard), small label "drift".
- Recomputed each frame from `engine.index` (live already re-renders via the rAF `force` tick). Pass `endIndex = engine.index`.

**Summary (new `src/ui/RunSummary.tsx`):**
- Rendered when `engine.finished` (the existing, currently-unused engine signal — finally consumed).
- Full-run stacked zone bar + per-zone row: `ZONE_THEME` icon + label + `mm:ss` (via `formatDuration`) + `N%`.
- Decoupling block: `pct` with rating color (good/moderate/high → reuse theme greens/ambers/red), first/second EF.
- `Insight[]` cards: severity → color (good=teal, watch=amber, act=red), headline bold + detail.
- Styling reuses Material `paperTheme` + existing dark palette. A control returns to replay / restart (reuse existing handlers).

**Wiring (`RunScreen.tsx`):** compute `zones`/`dc`/`insights` from `run`, `cumulative`, `engine.index`, `profile`; pass live values to `Dashboard`; when `engine.finished`, show `RunSummary` with full-run (no `endIndex`) values.

## §5 — Testing

Core modules are TDD'd with vitest (matches existing suite). UI is `tsc --noEmit` + manual web smoke (project convention — no RN render tests).

- **`zoneDistribution.test.ts`:** synthetic tracks with known dwell→zone; null-HR dwell→`unknownSec`; `endIndex` slice stops accumulation; `pctByZone` (+ unknown share) sums to ~100; `<2` points → all zeros.
- **`decoupling.test.ts`:** flat HR + steady pace → `pct ≈ 0`, rating `good`; HR rising in second half → positive `pct`, rating `moderate`/`high` at crafted 7%/12%; run < 6 min via `endIndex` → all null (guard); half with all-null HR → null; efficiency-improves case → negative pct, rating `good`.
- **`coaching.test.ts`:** each rule fires on crafted inputs; bands 1–3 mutually exclusive; 4–6 co-fire; degenerate input → `[]` (or only rule 6); integer rounding in copy.
- UI: `npx tsc --noEmit` clean; manual web smoke — live strip updates during replay, summary appears at end with correct numbers and insight cards.

## Interface summary (cross-module contracts)

- `zoneDistribution(points, profile, endIndex?) → ZoneDistribution` — uses `zoneForHr`/`Profile`/`ZoneId` from karvonen.
- `decoupling(points, cumulative, endIndex?) → Decoupling` — `cumulative` from `cumulativeDistances` (geo).
- `runInsights(zones, dc) → Insight[]` — consumes the two structs above.
- UI consumes all three + existing `formatDuration`, `ZONE_THEME`, `ReplayEngine.index`/`.finished`.

## Self-Review notes

- Reuses existing `ZoneId`/`ZONE_THEME`/`zoneForHr`/`cumulativeDistances`/`formatDuration`/`ReplayEngine.finished` — no duplication, no new deps, no new zone colors.
- Each core module single-purpose, pure, independently testable; live and summary share one code path via `endIndex`.
- Accessibility preserved: zone conveyed by color **and** icon/label, never color alone.
- `ReplayEngine.finished` (built but unused in the prior slice) is now consumed — closes that open thread.
