# Replay Run — Slice Design

**Date:** 2026-06-24
**Project:** RoutePulse (working title)
**Slice:** "Replay Run" — first vertical slice of Module 1 (Live Run Tracking)
**Status:** Approved design, ready for implementation plan

---

## 1. Goal & Scope

Load a GPX run file, replay it as a **faux-live** run, and render the on-run
dashboard — without any real GPS or BLE hardware. This proves the live-run
experience (PRD Module 1) plus Karvonen zone scoring (Module 3) end-to-end on a
single, testable codebase.

### In scope
- Select a GPX file; a sample (`Morning_Run.gpx`) is bundled for instant demo.
- Parse GPX into ordered track points (lat, lon, ele, time, hr).
- Replay engine: walk points by their real timestamps with play/pause, seek-to-start,
  and a speed multiplier (1× / 4× / 8×).
- SVG/Canvas route plot (no map tiles) with a moving position marker.
- Live dashboard: elapsed time, distance, pace, current HR, current Karvonen zone.
- Karvonen zones computed from a minimal profile (age + resting HR).
- UI/UX per the principles in §7.

### Deferred (not this slice)
Real live GPS/BLE capture, base-route map-matching, ghost pacer, weather pull,
sleep scraping, metabolic fuel splits, encryption/home-coordinate obfuscation,
tile basemap, multi-run history.

---

## 2. Platform & Stack

**Expo (React Native + react-native-web).** One codebase targets iOS, Android,
and desktop browser (`expo start` → web). Chosen over Flutter because the team /
PRD lean JS/React and Expo's web target is mature enough to "show on desktop
browser" with no extra port.

Rationale recap:
- Cross-platform from one codebase (the explicit requirement).
- Minimal setup / minimal further decisions.
- SVG plot + bundled GPX keep the slice offline and key-free (aligns with NFR-6.2).

---

## 3. Architecture

Layered, with a **platform-agnostic pure-TypeScript core** so logic is reused and
unit-tested independently of React Native.

```
core/    pure TS, zero RN deps — parser, geo math, Karvonen, replay clock
ui/      Expo / React Native screens + components, consume core
assets/  bundled Morning_Run.gpx sample
```

The core has no UI or platform imports, so the same functions run in Node tests,
on device, and in the browser.

---

## 4. Data Flow

```
GPX file
  → GpxParser            → Run { points[], startTime, name }
  → ReplayEngine(tick)   → emits current point + index
  → deriveMetrics        → { elapsed, distance, pace, hr, zone }
  → Dashboard + RouteView (render)
```

---

## 5. Components

### Core (pure TS)
- **GpxParser** — XML → `TrackPoint { lat, lon, ele, time, hr }[]`. Reads the
  Strava `gpxtpx:hr` extension. Tolerates points without HR.
- **Geo** — haversine distance between points; cumulative distance; pace (min/km)
  from a rolling window.
- **KarvonenCalculator** — inputs `age`, `restingHr`.
  `MaxHR = 211 − 0.64·age`; `HRR = MaxHR − restingHr`.
  Zone 2 (Aerobic Base) = 60–70% of HRR + restingHr; Zone 3 (Tempo) = 70–80%.
  Maps an instantaneous HR → current zone label (incl. "below Z2" / "above Z3").
- **ReplayEngine** — wall-clock timer advancing through points by their real
  timestamp deltas, scaled by a speed multiplier. Exposes play / pause /
  seek-to-start and emits `(point, index)` on each tick.

### UI (Expo / RN)
- **RouteView** — projects lat/lon to local XY (equirectangular projection scaled
  to the bounding box), draws the full route polyline + an animated current-position
  marker on an SVG/Canvas surface. No tiles, no API key, works offline and
  identically on web + mobile.
- **Dashboard** — live readouts (elapsed, distance, pace, HR, zone badge) and
  playback controls (play/pause, speed, restart). Layout follows §7.
- **ProfileScreen** — minimal age + resting HR inputs with sensible editable
  defaults; feeds KarvonenCalculator.
- **FilePicker / sample loader** — pick a GPX or load the bundled sample.

---

## 6. Error Handling

- Malformed or empty GPX → friendly rejection, no crash.
- Track points missing HR → metrics still render; zone shows **N/A**.
- Missing age / resting HR → prompt the Profile screen before zones compute.
- Replay at end-of-track → stop and show a clear "finished" state.

---

## 7. UI/UX Principles (on-run dashboard)

- **Glanceability** — current zone + HR is the dominant element, readable in a
  one-second glance: large type, high contrast.
- **Zone color system** — accessible palette; never color alone — color **plus**
  label (and icon) for each zone. Same encoding across map marker, HR readout,
  and zone badge.
- **Visual hierarchy** — primary: zone / HR. Secondary: pace, distance, elapsed.
  Tertiary: playback controls.
- **Touch targets** — ≥44pt, thumb-reachable play/pause/speed controls.
- **Responsive** — phone portrait first; desktop browser renders as a centered,
  max-width layout (controls not stretched edge to edge).
- **Feedback & motion** — smooth marker movement along the route; a clear
  transition when the zone changes; unambiguous play/pause state.
- **Minimal cognitive load** — no clutter on the run screen; rarely-changed config
  (profile) lives on its own screen.

---

## 8. Testing

`core/` is unit-tested independently:
- **GpxParser** against the real `Morning_Run.gpx` (point count, HR extraction,
  timestamp parsing).
- **Geo** distance/pace against known reference values.
- **KarvonenCalculator** boundary cases (exact 60/70/80% thresholds, below/above).
- **ReplayEngine** tick ordering, pause/seek, speed scaling, end-of-track.

UI smoke testing is added after the core is green.

---

## 9. Open Items / Future Slices

- Real live capture (GPS + BLE HR) replacing the replay source behind the same
  dashboard interface.
- Base-route designation + map-matching (PRD Module 2).
- Ghost pacer overlay (FR-1.5 / FR-5.1).
- Tile basemap as an optional layer under the SVG route.
