# Zone Timeline Chart — Design

**Date:** 2026-06-25
**Status:** Approved design, pre-plan
**Builds on:** `2026-06-25-run-analysis-design.md` (zoneDistribution, RunSummary), `2026-06-25-drift-gauge-design.md` (ZoneBar). Same branch family (`feat/run-analysis`). Mirrors the existing `src/ui/ElevationProfile.tsx` SVG-chart pattern.

## Goal

Add a chart to the post-run summary that shows **when, where, and in which Karvonen zone** the runner was across the run: a stepped zone line over the route distance (x-axis), with the four zones as y-rows and time labels on the distance ticks.

## Non-Goals

- No change to the analysis math, `ZONE_THEME`, or the existing live `ElevationProfile` (which already tints its elevation line by zone — this new chart is the dedicated, summary-only view).
- No live cursor / replay animation (the summary is post-run; the chart is static).
- No HR-value axis (the y-axis is the zone, not bpm).

## Architecture

The per-distance zone series is built by a pure, unit-tested core function (`buildZoneTimeline`), so the SVG component stays declarative. A new presentational `ZoneTimeline` component renders the stepped line with `react-native-svg`, following the existing `ElevationProfile` conventions (width prop, `pad`, downsampling, `ZONE_THEME` colors, SvgText labels). `RunSummary` gains the raw-run props it needs (`points`, `cumulative`, `profile`) and renders the chart; `RunScreen` passes them (all already in scope).

### Global constraints

- TypeScript strict; no `any` in committed code.
- `src/core/` MUST NOT import from react/react-native/expo/ui — pure & platform-agnostic.
- No new dependencies (`react-native-svg`, `@expo/vector-icons` already in use).
- Reuse `ZONE_THEME` (`src/ui/theme.ts`), `ZoneId`/`zoneForHr`/`Profile` (`src/core/karvonen.ts`), `TrackPoint` (`src/core/types.ts`); cumulative distances come from the existing `cumulativeDistances` (`src/core/geo.ts`).
- Component return types use `React.JSX.Element`.
- Accessibility: zone conveyed by the labeled y-axis rows AND color, never color alone; the chart has an `accessibilityLabel`.
- TDD for the core module: failing test first, minimal code, passing test, commit. UI verified by `npx tsc --noEmit` + manual smoke (project convention).

## §1 — Timeline data (pure core)

**File:** `src/core/zoneTimeline.ts`, test `src/core/__tests__/zoneTimeline.test.ts`.

**Consumes:** `TrackPoint` from `./types`; `zoneForHr`, `Profile`, `ZoneId` from `./karvonen`.

**Produces:**

```ts
export interface ZonePoint {
  distanceM: number;   // cumulative[i]
  elapsedSec: number;  // (points[i].time - points[0].time) / 1000
  zone: ZoneId;        // non-null only (null-HR points are skipped)
  level: number;       // below 0, zone2 1, zone3 2, above 3
}

export function buildZoneTimeline(
  points: TrackPoint[],
  cumulative: number[],
  profile: Profile,
  maxSamples?: number, // default 240
): ZonePoint[];
```

**Algorithm:**
- Empty / `points.length < 1` → `[]`.
- Downsample: `STEP = max(1, ceil(points.length / maxSamples))`; iterate `i = 0, STEP, 2·STEP, …`; always include the last index.
- For each kept index `i`: `zone = zoneForHr(points[i].hr, profile)`. If `zone === null`, **skip** (a missing-HR gap). Else push `{ distanceM: cumulative[i], elapsedSec: (points[i].time − points[0].time)/1000, zone, level: LEVEL[zone] }` where `LEVEL = { below:0, zone2:1, zone3:2, above:3 }`.
- Result is in ascending index (hence ascending distance/time) order; may be empty if every kept point lacks HR.

The level mapping is the only zone→number rule; keeping it here (not in JSX) makes it testable.

## §2 — ZoneTimeline component (UI)

**File:** `src/ui/ZoneTimeline.tsx`. Mirrors `ElevationProfile.tsx` structure.

**Consumes:** `buildZoneTimeline`/`ZonePoint` from `../core/zoneTimeline`; `ZoneId`/`Profile` from `../core/karvonen`; `TrackPoint` from `../core/types`; `ZONE_THEME` from `./theme`; `react-native-svg` (`Svg`, `Line`, `Rect`, `Text as SvgText`); `formatDuration` from `../core/format` (for time tick labels).

**Produces:**

```ts
function ZoneTimeline(props: {
  points: TrackPoint[];
  cumulative: number[];
  profile: Profile;
  width: number;
  height?: number; // default 132
}): React.JSX.Element
```

**Drawing:**
- `pad = 16`. `totalDist = cumulative[cumulative.length-1] || 1`. `x(d) = pad + (d/totalDist)·(width − 2·pad)`.
- Four y-rows for levels 0..3. `y(level) = (height − pad) − (level/3)·(height − 2·pad)` so level 0 (Below) is at the bottom and level 3 (Above) at the top. Draw four faint gridlines and left-edge labels `Below / Z2 / Z3 / Above` (font 10, `#94A3B8`).
- **Stepped line:** for each consecutive pair `(a, b)` in the timeline, draw a horizontal `Line` at `y(a.level)` from `x(a.distanceM)` to `x(b.distanceM)`, then a vertical riser `Line` at `x(b.distanceM)` from `y(a.level)` to `y(b.level)`; both colored `ZONE_THEME[a.zone].color`, `strokeWidth 2.5`, `strokeLinecap "round"`. Draw a final short horizontal at the last point's level. A gap (consecutive timeline points far apart in index because HR was missing between) simply draws a longer horizontal — acceptable.
- **X ticks + dual labels:** at ~4 evenly spaced distances (0, ⅓, ⅔, full), draw a faint tick and two SvgTexts: the km (`(d/1000).toFixed(1)`) below the axis and the elapsed `formatDuration(elapsedSec)` just above it, where `elapsedSec` is taken from the nearest timeline point to that distance. Title top-right: `"Zone over distance"`.
- `accessibilityLabel`: `"Zone over distance chart"`.

**Empty state:** if `buildZoneTimeline(...)` returns `[]`, render a single muted SvgText centred: `"No heart-rate data"` (font 12, `#94A3B8`) inside the same-sized SVG — no stepped line.

## §3 — Wiring

**`RunSummary.tsx`:** add three props — `points: TrackPoint[]`, `cumulative: number[]`, `profile: Profile` — to the param object + type block. Render `<ZoneTimeline points={points} cumulative={cumulative} profile={profile} width={440} />` directly below the existing `<ZoneBar … />`. Keep everything else (per-zone time list, drift gauge, insights, Run again, `onInfo`) unchanged.

**`RunScreen.tsx`:** the finished/summary branch already renders `<RunSummary … />` with `run`, `cumulative`, and `profile` in scope. Pass the three new props: `points={run.points}`, `cumulative={cumulative}`, `profile={profile}`.

No other call sites — `RunSummary` is only rendered in `RunScreen`'s finished branch.

## §4 — States

- **All-null HR** (no zone series): component renders the "No heart-rate data" placeholder (§2).
- **Short run** (one zone point): draws a single flat step at that level.
- **Gaps** (intermittent HR): drawn as a longer horizontal hold — honest, no interpolation across the gap.

## §5 — Testing

- **`zoneTimeline.test.ts`** (vitest, pure): a synthetic track crossing zones → correct `level` per zone (below0/zone2 1/zone3 2/above 3), `distanceM` = cumulative, `elapsedSec` from time; null-HR points skipped; downsample respects `maxSamples` (e.g. 1000 points, `maxSamples=240` → ≤241 incl. last) and always includes the last index; `points.length < 1` → `[]`.
- **UI** (`ZoneTimeline`, RunSummary/RunScreen wiring): `npx tsc --noEmit` clean + manual web smoke — at the summary, a stepped line tracks the zones across distance with the four y-rows and km+time tick labels; an all-null-HR run shows the placeholder; the rest of the summary is unchanged.

## Interface summary

- `buildZoneTimeline(points, cumulative, profile, maxSamples?) → ZonePoint[]` — `core/zoneTimeline.ts`, consumed by `ZoneTimeline`.
- `ZoneTimeline({ points, cumulative, profile, width, height? })` — consumed by `RunSummary`.
- `RunSummary` gains `points`/`cumulative`/`profile` props, supplied by `RunScreen`. No other contract changes.

## Self-Review notes

- Per-distance zone logic lives in pure tested core; the SVG component is declarative drawing, mirroring `ElevationProfile`.
- Reuses `ZONE_THEME`, `zoneForHr`, `cumulativeDistances`, `formatDuration`, and the react-native-svg pattern already in the app — no new deps, no new color language.
- Distinct from the live `ElevationProfile` (elevation y-axis, live cursor): this is summary-only, zone y-axis, static — answers "what zone, where, when" directly.
- Accessibility: zone read off labeled y-rows + color; chart has an `accessibilityLabel`.
- Additive: `RunSummary`'s existing props/behaviour unchanged except for three new inputs; only `RunScreen` (its sole caller) updated.
