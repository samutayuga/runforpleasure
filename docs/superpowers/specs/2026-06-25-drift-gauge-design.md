# Drift Gauge + Zone Bar Restyle — Design

**Date:** 2026-06-25
**Status:** Approved design, pre-plan
**Builds on:** `2026-06-25-run-analysis-design.md` (AnalysisStrip, RunSummary, decoupling, zoneDistribution) and `2026-06-25-analysis-explainer-design.md` (onInfo tap). Same branch family (`feat/run-analysis`).

## Goal

Make the drift indicator and zone bar more stylish and iconic: replace the flat "Drift +N%" text + thin bar with a **circular gauge** (ring magnitude = drift severity, centred heart + value, trend arrow = direction) and a **thicker rounded zone bar with icon dots**. One consistent look shared by the live dashboard strip and the post-run summary.

## Non-Goals

- No change to the analysis math (`decoupling`, `zoneDistribution`, `coaching` are done) or to the 4-zone model / `ZONE_THEME` colors.
- No change to the explainer modal content; the panel stays tappable to open it.
- No animation/transition work beyond what react-native-svg renders statically per frame (the existing rAF re-render already drives live updates).

## Architecture

The only new *logic* is the gauge mapping, which goes in a pure, unit-tested core module (`src/core/driftGauge.ts`) so no magic numbers live in JSX. Two new presentational UI components — `DriftGauge` (SVG ring) and `ZoneBar` (shared bar + dots) — consume it and the existing analysis structs. `AnalysisStrip` and `RunSummary` are rewired to use them; both keep their `onInfo` tap-to-explain behaviour. Follows the existing pattern: pure tested logic in `core/`, thin presentational components in `ui/`, `react-native-svg` for vector drawing (as `RouteView`/`ElevationProfile` already do).

### Global constraints

- TypeScript strict; no `any` in committed code.
- `src/core/` MUST NOT import from react/react-native/expo/ui — pure & platform-agnostic.
- No new dependencies (`react-native-svg` 15.15.4 and `@expo/vector-icons` already in use).
- Reuse `ZONE_THEME` (`src/ui/theme.ts`), `ZoneId` (`src/core/karvonen.ts`), `Decoupling`/`DecouplingRating` (`src/core/decoupling.ts`), `ZoneDistribution` (`src/core/zoneDistribution.ts`).
- Rating→color palette EXACTLY (reuse existing): `good → "#0E7C7B"`, `moderate → "#B45309"`, `high → "#9D174D"`; neutral/guard → `"#475569"`.
- Component return types use `React.JSX.Element`.
- Accessibility: zone still conveyed by color AND icon/label (the dot row), never color alone; the gauge has an `accessibilityLabel` summarising drift.
- TDD for the core module: failing test first, minimal code, passing test, commit.

## §1 — Gauge mapping (pure core)

**File:** `src/core/driftGauge.ts`, test `src/core/__tests__/driftGauge.test.ts`.

**Produces:**

```ts
export type TrendArrow = "up" | "flat" | "down";

// Fraction of the ring to fill: |pct| clamped to [0, cap] / cap. Always 0..1.
export function gaugeFraction(pct: number | null, cap?: number): number; // default cap = 15

// Direction the heart-rate efficiency moved: up = drifting/worse, down = improved, flat = steady.
export function trendArrow(pct: number | null): TrendArrow;
```

**Rules:**
- `gaugeFraction(null)` → `0`. Otherwise `Math.min(Math.abs(pct), cap) / cap`, so 5%→0.33, 10%→0.67, ≥15%→1, negative uses magnitude (−6%→0.4).
- `trendArrow(null)` → `"flat"`. `pct > 0.5` → `"up"`; `pct < -0.5` → `"down"`; else `"flat"`. (The ±0.5 deadband keeps a ~0% run reading "flat".)

These two pure functions are the entire numeric contract; the gauge component is otherwise plain drawing.

## §2 — DriftGauge component (UI)

**File:** `src/ui/DriftGauge.tsx`.

**Consumes:** `Decoupling`/`DecouplingRating` from `../core/decoupling`; `gaugeFraction`/`trendArrow` from `../core/driftGauge`; `react-native-svg` (`Svg`, `Circle`); `MaterialCommunityIcons`; `Text` from react-native-paper; RN `View`/`StyleSheet`.

**Produces:** `function DriftGauge(props: { decoupling: Decoupling; size?: number }): React.JSX.Element` (default `size = 96`).

**Drawing (donut-arc gauge):**
- An `Svg` of `size`×`size`. Two `Circle`s sharing center `(size/2, size/2)` and radius `r = size/2 − stroke` (`stroke = size * 0.09`, min 6):
  - **Track:** full stroke, color `"#1E293B"`.
  - **Progress:** color = rating color (`good/moderate/high` palette; `null` rating → neutral `"#475569"`), `strokeLinecap="round"`.
- **270° sweep, opening at the bottom:** rotate the group `135°` so the gap is centred at the bottom. `circumference = 2πr`; the arc spans `0.75 * circumference`. Progress `strokeDasharray = [gaugeFraction · arcLen, circumference]`; track `strokeDasharray = [arcLen, circumference]`.
- **Center stack** (absolutely positioned `View` over the SVG): `heart-pulse` `MaterialCommunityIcons` (size `size*0.18`, rating color), then the value text — `"+4%"` / `"-3%"` / `"—"` when `pct === null` — (font `size*0.22`, bold, primary `#F1F5F9`), then the rating word `Good/Moderate/High` or `"warming up"` when null (font `size*0.11`, muted `#94A3B8`).
- **Trend arrow** in the bottom gap: `MaterialCommunityIcons` `trending-up` / `trending-neutral` / `trending-down` per `trendArrow(pct)`, rating color, size `size*0.16`.
- `accessibilityLabel`: e.g. `"Drift +4 percent, moderate"` or `"Drift not available yet"`.

Value/sign formatting reuses the existing convention from AnalysisStrip: `pct === null ? "—" : \`${pct >= 0 ? "+" : ""}${Math.round(pct)}%\``.

## §3 — ZoneBar component (UI)

**File:** `src/ui/ZoneBar.tsx`.

**Consumes:** `ZoneDistribution` from `../core/zoneDistribution`; `ZoneId` from `../core/karvonen`; `ZONE_THEME` from `./theme`; RN `View`/`Text`/`StyleSheet`.

**Produces:** `function ZoneBar(props: { zones: ZoneDistribution; height?: number; showDots?: boolean }): React.JSX.Element` (defaults `height = 16`, `showDots = true`).

**Drawing:**
- A rounded (`borderRadius = height/2`, `overflow:"hidden"`) track (`backgroundColor "#1E293B"`); segments `flex` by `pctByZone[z]` in order `["below","zone2","zone3","above"]`, each `backgroundColor ZONE_THEME[z].color`; a thin translucent top highlight band (`rgba(255,255,255,0.12)`, top ~40%) inside each segment for depth.
- When `showDots`, a wrapped dot row beneath: for each zone with `pctByZone[z] > 0`, a small color dot (`ZONE_THEME[z].color`) + `ZONE_THEME[z].icon` + `ZONE_THEME[z].label` + `Math.round(pctByZone[z])%`. Keeps the color-AND-icon-AND-label accessibility rule. (The unknown/no-HR share is not shown as a dot but is implicit in the gaps.)

Replaces the current thin bar + plain text legend in AnalysisStrip and the stacked bar in RunSummary.

## §4 — Wiring + states

**`AnalysisStrip.tsx`** (live, compact): keep the outer `Pressable` (tap → `onInfo`). Inside, render `<ZoneBar zones={zones} height={14} />` then a centred row with a small `<DriftGauge decoupling={decoupling} size={64} />` and the ⓘ icon. Drop the old inline bar/legend/drift markup and the now-unused styles.

**`RunSummary.tsx`** (summary, large): replace the existing stacked zone bar (`styles.bar`) with `<ZoneBar zones={zones} height={18} />`, and replace the text drift card (`styles.driftCard` block) with a centred `<DriftGauge decoupling={decoupling} size={120} />`. Keep the block a `Pressable` → `onInfo`, keep the per-zone time list (`mm:ss`) below the bar (the dot row shows %, the list shows time — complementary). Keep insights + "Run again".

**States:**
- **Guard/null** (`decoupling.pct === null`, pre-6-min live): gauge shows neutral grey track, `—`, "warming up", flat arrow. ZoneBar still fills from whatever zone time exists.
- **Negative drift** (improved): down arrow, good/green, fill by magnitude.
- **Empty zones** (start of run, all `pctByZone` 0): ZoneBar shows the bare dark track (acceptable placeholder), no dots.

## §5 — Testing

- **`driftGauge.test.ts`** (vitest, pure): `gaugeFraction` at `null`→0, 0→0, 5→≈0.333, 10→≈0.667, 15→1, 20→1 (clamped), −6→0.4; `trendArrow` `null`→"flat", 4→"up", −4→"down", 0→"flat", 0.4→"flat" (deadband).
- **UI** (`DriftGauge`, `ZoneBar`, rewired AnalysisStrip/RunSummary): `npx tsc --noEmit` clean + manual web smoke — gauge ring fills and colors by rating (drive an 8× replay past 6 min), guard "—" state before then, both sizes render, zone bar + dots show, tapping still opens the explainer.

## Interface summary

- `gaugeFraction(pct, cap?) → number`, `trendArrow(pct) → TrendArrow` — defined `core/driftGauge.ts`, consumed by `DriftGauge`.
- `DriftGauge({ decoupling, size? })`, `ZoneBar({ zones, height?, showDots? })` — consumed by `AnalysisStrip` and `RunSummary`.
- No change to `decoupling`/`zoneDistribution`/`coaching`/`AnalysisInfoModal`/`onInfo` contracts.

## Self-Review notes

- Numeric mapping lives in pure tested core; components are drawing-only — keeps JSX honest and testable.
- Reuses the rating palette, `ZONE_THEME`, and `react-native-svg` already in the app — no new deps, no new color language.
- Accessibility preserved: zone dots carry color + icon + label; gauge carries an `accessibilityLabel`.
- Tap-to-explain (`onInfo`) and all analysis contracts untouched — additive restyle, isolated to two presentational components + their two consumers.
