# Replay Run Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform Expo app that loads a GPX run file, replays it as a faux-live run, and shows an on-run dashboard with an SVG route plot and Karvonen heart-rate zones.

**Architecture:** A pure-TypeScript `core/` (parser, geo math, Karvonen, replay engine, projection, metrics) with zero React Native imports, unit-tested under vitest. A thin `ui/` layer of Expo / React Native components consumes the core. The replay engine is driver-agnostic: pure time→index math, advanced by a requestAnimationFrame loop in the UI.

**Tech Stack:** Expo (React Native + react-native-web), TypeScript, `fast-xml-parser` (cross-platform GPX parse), `react-native-svg` (route plot), vitest (core unit tests).

## Global Constraints

- TypeScript strict mode on; no `any` in committed code.
- `core/` modules MUST NOT import from `react`, `react-native`, `expo`, or `ui/`. Core is pure and platform-agnostic.
- One codebase targets iOS, Android, and desktop browser via Expo. No platform-only APIs in core.
- Offline / key-free: no map tiles, no network calls. Route is an SVG plot; the sample GPX is bundled.
- Karvonen formulas, copied verbatim from the spec: `MaxHR = 211 − 0.64·age`; `HRR = MaxHR − restingHr`; Zone 2 = 60–70% of HRR + restingHr; Zone 3 = 70–80% of HRR + restingHr.
- Sample reference (`Morning_Run.gpx`): 6381 track points; name `Morning Run`; first time `2026-06-20T22:41:55Z`; last time `2026-06-21T00:29:15Z`.
- TDD: failing test first, minimal code, passing test, commit — every task.

---

### Task 1: Project scaffold + bundled sample

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `vitest.config.ts`, `babel.config.js`, `App.tsx`
- Create: `assets/Morning_Run.gpx` (copied from `~/Downloads/Morning_Run.gpx`)
- Create: `src/core/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working Expo + TypeScript + vitest workspace. Later tasks add files under `src/core/` and `src/ui/`.

- [ ] **Step 1: Scaffold the Expo TypeScript app**

Run:
```bash
npx create-expo-app@latest . --template blank-typescript
```
If the directory is non-empty (it has `docs/` and `requirement.md`), scaffold in a temp dir and move files in:
```bash
npx create-expo-app@latest /tmp/replay-run --template blank-typescript
rsync -a --ignore-existing /tmp/replay-run/ ./
```

- [ ] **Step 2: Add dependencies**

Run:
```bash
npx expo install react-native-svg
npm install fast-xml-parser
npm install -D vitest
```

- [ ] **Step 3: Copy the bundled sample GPX**

Run:
```bash
mkdir -p assets
cp ~/Downloads/Morning_Run.gpx assets/Morning_Run.gpx
```

- [ ] **Step 4: Add vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write a smoke test**

Create `src/core/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("workspace", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the smoke test**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Expo TS app with vitest and bundled sample GPX"
```

---

### Task 2: Core types + GPX parser

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/gpxParser.ts`
- Test: `src/core/__tests__/gpxParser.test.ts`

**Interfaces:**
- Consumes: `fast-xml-parser`.
- Produces:
  - `interface TrackPoint { lat: number; lon: number; ele: number | null; time: Date; hr: number | null }`
  - `interface Run { name: string; points: TrackPoint[] }`
  - `function parseGpx(xml: string): Run`

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/gpxParser.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseGpx } from "../gpxParser";

const xml = readFileSync("assets/Morning_Run.gpx", "utf8");

describe("parseGpx", () => {
  const run = parseGpx(xml);

  it("reads the track name", () => {
    expect(run.name).toBe("Morning Run");
  });

  it("reads all track points", () => {
    expect(run.points.length).toBe(6381);
  });

  it("parses the first point lat/lon/ele/time/hr", () => {
    const p = run.points[0];
    expect(p.lat).toBeCloseTo(1.3525410, 6);
    expect(p.lon).toBeCloseTo(103.7562650, 6);
    expect(p.ele).toBeCloseTo(36.5, 1);
    expect(p.time.toISOString()).toBe("2026-06-20T22:41:55.000Z");
    expect(p.hr).toBe(161);
  });

  it("parses the last point time and hr", () => {
    const p = run.points[run.points.length - 1];
    expect(p.time.toISOString()).toBe("2026-06-21T00:29:15.000Z");
    expect(p.hr).toBe(167);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/gpxParser.test.ts`
Expected: FAIL — cannot find module `../gpxParser`.

- [ ] **Step 3: Write the types**

Create `src/core/types.ts`:
```ts
export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number | null;
  time: Date;
  hr: number | null;
}

export interface Run {
  name: string;
  points: TrackPoint[];
}
```

- [ ] **Step 4: Write the parser**

Create `src/core/gpxParser.ts`:
```ts
import { XMLParser } from "fast-xml-parser";
import type { Run, TrackPoint } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function parseGpx(xml: string): Run {
  const doc = parser.parse(xml);
  const trk = doc?.gpx?.trk ?? {};
  const seg = trk.trkseg ?? {};
  const rawPoints = Array.isArray(seg.trkpt) ? seg.trkpt : seg.trkpt ? [seg.trkpt] : [];

  const points: TrackPoint[] = rawPoints.map((pt: Record<string, unknown>) => {
    const ext = (pt.extensions as Record<string, unknown>) ?? {};
    const tpx = (ext["gpxtpx:TrackPointExtension"] as Record<string, unknown>) ?? {};
    return {
      lat: Number(pt["@_lat"]),
      lon: Number(pt["@_lon"]),
      ele: num(pt.ele),
      time: new Date(String(pt.time)),
      hr: num(tpx["gpxtpx:hr"]),
    };
  });

  return { name: String(trk.name ?? "Untitled Run"), points };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/gpxParser.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/types.ts src/core/gpxParser.ts src/core/__tests__/gpxParser.test.ts
git commit -m "feat: parse Strava GPX into typed track points"
```

---

### Task 3: Geo math (distance + pace)

**Files:**
- Create: `src/core/geo.ts`
- Test: `src/core/__tests__/geo.test.ts`

**Interfaces:**
- Consumes: `TrackPoint` from `./types`.
- Produces:
  - `function haversineMeters(a: {lat:number;lon:number}, b: {lat:number;lon:number}): number`
  - `function cumulativeDistances(points: TrackPoint[]): number[]` — meters, length === points.length, `[0]` === 0.
  - `function paceMinPerKm(meters: number, seconds: number): number | null` — null when meters === 0.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/geo.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { haversineMeters, cumulativeDistances, paceMinPerKm } from "../geo";
import type { TrackPoint } from "../types";

function tp(lat: number, lon: number): TrackPoint {
  return { lat, lon, ele: null, time: new Date(0), hr: null };
}

describe("haversineMeters", () => {
  it("matches a known ~111.2m-per-0.001deg latitude step", () => {
    const d = haversineMeters({ lat: 1.35, lon: 103.75 }, { lat: 1.351, lon: 103.75 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it("is zero for identical points", () => {
    expect(haversineMeters({ lat: 1.35, lon: 103.75 }, { lat: 1.35, lon: 103.75 })).toBe(0);
  });
});

describe("cumulativeDistances", () => {
  it("starts at zero and grows monotonically", () => {
    const cum = cumulativeDistances([tp(1.35, 103.75), tp(1.351, 103.75), tp(1.352, 103.75)]);
    expect(cum).toHaveLength(3);
    expect(cum[0]).toBe(0);
    expect(cum[1]).toBeGreaterThan(0);
    expect(cum[2]).toBeGreaterThan(cum[1]);
  });
});

describe("paceMinPerKm", () => {
  it("computes 5 min/km for 1000m in 300s", () => {
    expect(paceMinPerKm(1000, 300)).toBeCloseTo(5, 5);
  });

  it("returns null for zero distance", () => {
    expect(paceMinPerKm(0, 10)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/geo.test.ts`
Expected: FAIL — cannot find module `../geo`.

- [ ] **Step 3: Write the implementation**

Create `src/core/geo.ts`:
```ts
import type { TrackPoint } from "./types";

const R = 6_371_000; // earth radius, meters

export function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function cumulativeDistances(points: TrackPoint[]): number[] {
  const out: number[] = new Array(points.length);
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) total += haversineMeters(points[i - 1], points[i]);
    out[i] = total;
  }
  return out;
}

export function paceMinPerKm(meters: number, seconds: number): number | null {
  if (meters <= 0) return null;
  const minutes = seconds / 60;
  const km = meters / 1000;
  return minutes / km;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/geo.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/geo.ts src/core/__tests__/geo.test.ts
git commit -m "feat: add haversine distance, cumulative distance, and pace"
```

---

### Task 4: Karvonen zone calculator

**Files:**
- Create: `src/core/karvonen.ts`
- Test: `src/core/__tests__/karvonen.test.ts`

**Interfaces:**
- Produces:
  - `interface Profile { age: number; restingHr: number }`
  - `type ZoneId = "below" | "zone2" | "zone3" | "above"`
  - `function maxHr(age: number): number` — `211 − 0.64·age`
  - `function hrr(profile: Profile): number` — `maxHr(age) − restingHr`
  - `function zoneBoundaryHr(profile: Profile, pct: number): number` — `pct·HRR + restingHr`
  - `function zoneForHr(hr: number | null, profile: Profile): ZoneId | null` — null when hr is null. Boundaries: zone2 = [60%,70%), zone3 = [70%,80%), below = <60%, above = ≥80%.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/karvonen.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { maxHr, hrr, zoneBoundaryHr, zoneForHr } from "../karvonen";

const profile = { age: 30, restingHr: 60 };
// maxHr = 211 - 0.64*30 = 191.8 ; HRR = 191.8 - 60 = 131.8
// 60% -> 0.6*131.8 + 60 = 139.08 ; 70% -> 152.26 ; 80% -> 165.44

describe("karvonen formulas", () => {
  it("maxHr", () => {
    expect(maxHr(30)).toBeCloseTo(191.8, 5);
  });
  it("hrr", () => {
    expect(hrr(profile)).toBeCloseTo(131.8, 5);
  });
  it("zone boundary at 60%", () => {
    expect(zoneBoundaryHr(profile, 0.6)).toBeCloseTo(139.08, 2);
  });
});

describe("zoneForHr", () => {
  it("below zone 2", () => {
    expect(zoneForHr(120, profile)).toBe("below");
  });
  it("inside zone 2", () => {
    expect(zoneForHr(145, profile)).toBe("zone2");
  });
  it("inside zone 3", () => {
    expect(zoneForHr(160, profile)).toBe("zone3");
  });
  it("above zone 3", () => {
    expect(zoneForHr(170, profile)).toBe("above");
  });
  it("null hr yields null zone", () => {
    expect(zoneForHr(null, profile)).toBeNull();
  });
  it("lower boundary is inclusive (60% -> zone2)", () => {
    expect(zoneForHr(zoneBoundaryHr(profile, 0.6), profile)).toBe("zone2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/karvonen.test.ts`
Expected: FAIL — cannot find module `../karvonen`.

- [ ] **Step 3: Write the implementation**

Create `src/core/karvonen.ts`:
```ts
export interface Profile {
  age: number;
  restingHr: number;
}

export type ZoneId = "below" | "zone2" | "zone3" | "above";

export function maxHr(age: number): number {
  return 211 - 0.64 * age;
}

export function hrr(profile: Profile): number {
  return maxHr(profile.age) - profile.restingHr;
}

export function zoneBoundaryHr(profile: Profile, pct: number): number {
  return pct * hrr(profile) + profile.restingHr;
}

export function zoneForHr(hr: number | null, profile: Profile): ZoneId | null {
  if (hr === null) return null;
  const z2 = zoneBoundaryHr(profile, 0.6);
  const z3 = zoneBoundaryHr(profile, 0.7);
  const z4 = zoneBoundaryHr(profile, 0.8);
  if (hr < z2) return "below";
  if (hr < z3) return "zone2";
  if (hr < z4) return "zone3";
  return "above";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/karvonen.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/karvonen.ts src/core/__tests__/karvonen.test.ts
git commit -m "feat: add Karvonen HRR zone calculator"
```

---

### Task 5: Replay engine (pure time→index)

**Files:**
- Create: `src/core/replayEngine.ts`
- Test: `src/core/__tests__/replayEngine.test.ts`

**Interfaces:**
- Consumes: `TrackPoint` from `./types`.
- Produces a `ReplayEngine` class driven by elapsed deltas (no real timers, so it is testable):
  - `constructor(points: TrackPoint[], speed?: number)` — default speed 1.
  - `play(): void` / `pause(): void` / `get playing(): boolean`
  - `seekToStart(): void`
  - `setSpeed(multiplier: number): void`
  - `advance(realDeltaMs: number): void` — adds `realDeltaMs · speed` to replay-elapsed only while playing; clamps at track end.
  - `get index(): number` — current point index for the elapsed replay time.
  - `get finished(): boolean` — true when elapsed ≥ total track duration.
  - `get current(): TrackPoint` — `points[index]`.

  `index` is the largest i where `(points[i].time − points[0].time) ≤ elapsed`.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/replayEngine.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ReplayEngine } from "../replayEngine";
import type { TrackPoint } from "../types";

function track(): TrackPoint[] {
  // points at t = 0s, 1s, 2s, 3s
  return [0, 1, 2, 3].map((s) => ({
    lat: 1.35,
    lon: 103.75,
    ele: null,
    time: new Date(s * 1000),
    hr: 150 + s,
  }));
}

describe("ReplayEngine", () => {
  it("starts paused at index 0", () => {
    const e = new ReplayEngine(track());
    expect(e.playing).toBe(false);
    expect(e.index).toBe(0);
  });

  it("does not advance while paused", () => {
    const e = new ReplayEngine(track());
    e.advance(2000);
    expect(e.index).toBe(0);
  });

  it("advances by real time at 1x", () => {
    const e = new ReplayEngine(track());
    e.play();
    e.advance(1500); // 1.5s elapsed -> still at the 1s point
    expect(e.index).toBe(1);
    e.advance(1000); // 2.5s elapsed -> the 2s point
    expect(e.index).toBe(2);
  });

  it("honours the speed multiplier", () => {
    const e = new ReplayEngine(track(), 2);
    e.play();
    e.advance(1000); // 2s of replay time
    expect(e.index).toBe(2);
  });

  it("clamps and reports finished at the end", () => {
    const e = new ReplayEngine(track());
    e.play();
    e.advance(10_000);
    expect(e.index).toBe(3);
    expect(e.finished).toBe(true);
  });

  it("seekToStart resets elapsed", () => {
    const e = new ReplayEngine(track());
    e.play();
    e.advance(5000);
    e.seekToStart();
    expect(e.index).toBe(0);
    expect(e.finished).toBe(false);
  });

  it("exposes the current point", () => {
    const e = new ReplayEngine(track());
    e.play();
    e.advance(2000);
    expect(e.current.hr).toBe(152);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/replayEngine.test.ts`
Expected: FAIL — cannot find module `../replayEngine`.

- [ ] **Step 3: Write the implementation**

Create `src/core/replayEngine.ts`:
```ts
import type { TrackPoint } from "./types";

export class ReplayEngine {
  private points: TrackPoint[];
  private speed: number;
  private elapsedMs = 0;
  private offsets: number[];
  private totalMs: number;
  private _playing = false;

  constructor(points: TrackPoint[], speed = 1) {
    this.points = points;
    this.speed = speed;
    const start = points.length ? points[0].time.getTime() : 0;
    this.offsets = points.map((p) => p.time.getTime() - start);
    this.totalMs = this.offsets.length ? this.offsets[this.offsets.length - 1] : 0;
  }

  get playing(): boolean {
    return this._playing;
  }

  play(): void {
    this._playing = true;
  }

  pause(): void {
    this._playing = false;
  }

  setSpeed(multiplier: number): void {
    this.speed = multiplier;
  }

  seekToStart(): void {
    this.elapsedMs = 0;
  }

  advance(realDeltaMs: number): void {
    if (!this._playing) return;
    this.elapsedMs = Math.min(this.totalMs, this.elapsedMs + realDeltaMs * this.speed);
  }

  get index(): number {
    let i = 0;
    while (i + 1 < this.offsets.length && this.offsets[i + 1] <= this.elapsedMs) i++;
    return i;
  }

  get finished(): boolean {
    return this.elapsedMs >= this.totalMs && this.totalMs > 0;
  }

  get current(): TrackPoint {
    return this.points[this.index];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/replayEngine.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/replayEngine.ts src/core/__tests__/replayEngine.test.ts
git commit -m "feat: add driver-agnostic replay engine"
```

---

### Task 6: Derived live metrics

**Files:**
- Create: `src/core/metrics.ts`
- Test: `src/core/__tests__/metrics.test.ts`

**Interfaces:**
- Consumes: `Run`/`TrackPoint` from `./types`, `cumulativeDistances`/`paceMinPerKm` from `./geo`, `zoneForHr`/`Profile`/`ZoneId` from `./karvonen`.
- Produces:
  - `interface LiveMetrics { elapsedSec: number; distanceMeters: number; paceMinPerKm: number | null; hr: number | null; zone: ZoneId | null }`
  - `function deriveMetrics(run: Run, cumulative: number[], index: number, profile: Profile): LiveMetrics`
    - `elapsedSec` = (points[index].time − points[0].time) / 1000
    - `distanceMeters` = cumulative[index]
    - `paceMinPerKm` = paceMinPerKm(distanceMeters, elapsedSec)
    - `hr` = points[index].hr
    - `zone` = zoneForHr(hr, profile)

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/metrics.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { deriveMetrics } from "../metrics";
import { cumulativeDistances } from "../geo";
import type { Run, TrackPoint } from "../types";

function tp(lat: number, sec: number, hr: number | null): TrackPoint {
  return { lat, lon: 103.75, ele: null, time: new Date(sec * 1000), hr };
}

const run: Run = {
  name: "t",
  points: [tp(1.35, 0, 130), tp(1.351, 60, 145), tp(1.352, 120, 160)],
};
const cum = cumulativeDistances(run.points);
const profile = { age: 30, restingHr: 60 };

describe("deriveMetrics", () => {
  it("reports elapsed seconds at the index", () => {
    expect(deriveMetrics(run, cum, 2, profile).elapsedSec).toBe(120);
  });

  it("reports cumulative distance at the index", () => {
    expect(deriveMetrics(run, cum, 2, profile).distanceMeters).toBeCloseTo(cum[2], 5);
  });

  it("reports hr and Karvonen zone", () => {
    const m = deriveMetrics(run, cum, 1, profile);
    expect(m.hr).toBe(145);
    expect(m.zone).toBe("zone2");
  });

  it("pace is null at the start (zero distance)", () => {
    expect(deriveMetrics(run, cum, 0, profile).paceMinPerKm).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/metrics.test.ts`
Expected: FAIL — cannot find module `../metrics`.

- [ ] **Step 3: Write the implementation**

Create `src/core/metrics.ts`:
```ts
import type { Run } from "./types";
import { paceMinPerKm as pace } from "./geo";
import { zoneForHr, type Profile, type ZoneId } from "./karvonen";

export interface LiveMetrics {
  elapsedSec: number;
  distanceMeters: number;
  paceMinPerKm: number | null;
  hr: number | null;
  zone: ZoneId | null;
}

export function deriveMetrics(
  run: Run,
  cumulative: number[],
  index: number,
  profile: Profile,
): LiveMetrics {
  const start = run.points[0].time.getTime();
  const elapsedSec = (run.points[index].time.getTime() - start) / 1000;
  const distanceMeters = cumulative[index];
  return {
    elapsedSec,
    distanceMeters,
    paceMinPerKm: pace(distanceMeters, elapsedSec),
    hr: run.points[index].hr,
    zone: zoneForHr(run.points[index].hr, profile),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/metrics.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/metrics.ts src/core/__tests__/metrics.test.ts
git commit -m "feat: derive live metrics from run + index + profile"
```

---

### Task 7: Route projection (lat/lon → SVG XY)

**Files:**
- Create: `src/core/projection.ts`
- Test: `src/core/__tests__/projection.test.ts`

**Interfaces:**
- Consumes: `TrackPoint` from `./types`.
- Produces:
  - `interface XY { x: number; y: number }`
  - `function projectRoute(points: TrackPoint[], width: number, height: number, padding: number): XY[]`
    - Equirectangular projection scaled to fit the bounding box inside `width`×`height` minus `padding` on every side, preserving aspect ratio.
    - Y is flipped so north is up (smaller screen y = higher latitude).
    - Output length === points.length; every point lies within `[padding, width−padding] × [padding, height−padding]`.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/projection.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { projectRoute } from "../projection";
import type { TrackPoint } from "../types";

function tp(lat: number, lon: number): TrackPoint {
  return { lat, lon, ele: null, time: new Date(0), hr: null };
}

const pts = [tp(1.350, 103.750), tp(1.352, 103.752), tp(1.351, 103.751)];

describe("projectRoute", () => {
  const xy = projectRoute(pts, 200, 200, 10);

  it("returns one XY per point", () => {
    expect(xy).toHaveLength(3);
  });

  it("keeps every point inside the padded box", () => {
    for (const p of xy) {
      expect(p.x).toBeGreaterThanOrEqual(10);
      expect(p.x).toBeLessThanOrEqual(190);
      expect(p.y).toBeGreaterThanOrEqual(10);
      expect(p.y).toBeLessThanOrEqual(190);
    }
  });

  it("puts higher latitude at a smaller y (north is up)", () => {
    // pts[1] has the highest lat -> smallest y
    expect(xy[1].y).toBeLessThan(xy[0].y);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/projection.test.ts`
Expected: FAIL — cannot find module `../projection`.

- [ ] **Step 3: Write the implementation**

Create `src/core/projection.ts`:
```ts
import type { TrackPoint } from "./types";

export interface XY {
  x: number;
  y: number;
}

export function projectRoute(
  points: TrackPoint[],
  width: number,
  height: number,
  padding: number,
): XY[] {
  if (points.length === 0) return [];

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const innerW = width - 2 * padding;
  const innerH = height - 2 * padding;
  const spanLon = maxLon - minLon || 1;
  const spanLat = maxLat - minLat || 1;
  const scale = Math.min(innerW / spanLon, innerH / spanLat);

  // center the scaled route in the padded box
  const usedW = spanLon * scale;
  const usedH = spanLat * scale;
  const offsetX = padding + (innerW - usedW) / 2;
  const offsetY = padding + (innerH - usedH) / 2;

  return points.map((p) => ({
    x: offsetX + (p.lon - minLon) * scale,
    y: offsetY + (maxLat - p.lat) * scale, // flip so north is up
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/projection.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/projection.ts src/core/__tests__/projection.test.ts
git commit -m "feat: project lat/lon route to SVG coordinates"
```

---

### Task 8: Zone theme + formatting helpers

**Files:**
- Create: `src/ui/theme.ts`
- Create: `src/core/format.ts`
- Test: `src/core/__tests__/format.test.ts`

**Interfaces:**
- `src/core/format.ts` produces:
  - `function formatDuration(sec: number): string` — `H:MM:SS` (drop hours if 0 → `M:SS`).
  - `function formatDistance(meters: number): string` — kilometres, 2 dp, e.g. `"1.50 km"`.
  - `function formatPace(min: number | null): string` — `"M:SS /km"` or `"--:-- /km"` when null.
- `src/ui/theme.ts` produces (consumed by UI tasks, accessible color + label + icon per zone):
  - `const ZONE_THEME: Record<ZoneId, { label: string; color: string; icon: string }>`
  - `import type { ZoneId } from "../core/karvonen"`

Accessible palette (distinct hue + always paired with label/icon, never color-only):
`below` → grey `#6B7280` 🚶; `zone2` → teal `#0E7C7B` 🟢; `zone3` → amber `#B45309` 🟠; `above` → magenta `#9D174D` 🔴.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/format.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatDuration, formatDistance, formatPace } from "../format";

describe("formatDuration", () => {
  it("formats under an hour as M:SS", () => {
    expect(formatDuration(125)).toBe("2:05");
  });
  it("formats over an hour as H:MM:SS", () => {
    expect(formatDuration(3725)).toBe("1:02:05");
  });
});

describe("formatDistance", () => {
  it("formats metres as km with 2 dp", () => {
    expect(formatDistance(1500)).toBe("1.50 km");
  });
});

describe("formatPace", () => {
  it("formats a pace value", () => {
    expect(formatPace(5.5)).toBe("5:30 /km");
  });
  it("formats null as placeholder", () => {
    expect(formatPace(null)).toBe("--:-- /km");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/format.test.ts`
Expected: FAIL — cannot find module `../format`.

- [ ] **Step 3: Write the format helpers**

Create `src/core/format.ts`:
```ts
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDuration(sec: number): string {
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatPace(min: number | null): string {
  if (min === null) return "--:-- /km";
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return `${m}:${pad(s)} /km`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/format.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the zone theme**

Create `src/ui/theme.ts`:
```ts
import type { ZoneId } from "../core/karvonen";

export const ZONE_THEME: Record<ZoneId, { label: string; color: string; icon: string }> = {
  below: { label: "Below Z2", color: "#6B7280", icon: "🚶" },
  zone2: { label: "Zone 2 · Aerobic", color: "#0E7C7B", icon: "🟢" },
  zone3: { label: "Zone 3 · Tempo", color: "#B45309", icon: "🟠" },
  above: { label: "Above Z3", color: "#9D174D", icon: "🔴" },
};
```

- [ ] **Step 6: Commit**

```bash
git add src/core/format.ts src/core/__tests__/format.test.ts src/ui/theme.ts
git commit -m "feat: add formatting helpers and accessible zone theme"
```

---

### Task 9: RouteView component (SVG plot + marker)

**Files:**
- Create: `src/ui/RouteView.tsx`

**Interfaces:**
- Consumes: `projectRoute` from `../core/projection`, `TrackPoint` from `../core/types`, `react-native-svg`.
- Produces: `function RouteView(props: { points: TrackPoint[]; currentIndex: number; markerColor: string; size?: number }): JSX.Element`
  - Renders an SVG `size`×`size` (default 280) with the full route as a `Polyline` and a `Circle` marker at `projectRoute(...)[currentIndex]`.

- [ ] **Step 1: Implement the component**

Create `src/ui/RouteView.tsx`:
```tsx
import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Polyline, Circle } from "react-native-svg";
import { projectRoute } from "../core/projection";
import type { TrackPoint } from "../core/types";

export function RouteView({
  points,
  currentIndex,
  markerColor,
  size = 280,
}: {
  points: TrackPoint[];
  currentIndex: number;
  markerColor: string;
  size?: number;
}): JSX.Element {
  const xy = useMemo(() => projectRoute(points, size, size, 16), [points, size]);
  const polyline = useMemo(() => xy.map((p) => `${p.x},${p.y}`).join(" "), [xy]);
  const marker = xy[Math.min(currentIndex, xy.length - 1)] ?? { x: 0, y: 0 };

  return (
    <View accessibilityLabel="Route map" style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Polyline points={polyline} fill="none" stroke="#CBD5E1" strokeWidth={3} />
        <Circle cx={marker.x} cy={marker.y} r={7} fill={markerColor} stroke="#fff" strokeWidth={2} />
      </Svg>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/RouteView.tsx
git commit -m "feat: add SVG route view with position marker"
```

---

### Task 10: Dashboard component (glanceable readouts + controls)

**Files:**
- Create: `src/ui/Dashboard.tsx`

**Interfaces:**
- Consumes: `LiveMetrics` from `../core/metrics`, `formatDuration`/`formatDistance`/`formatPace` from `../core/format`, `ZONE_THEME` from `./theme`.
- Produces: `function Dashboard(props: { metrics: LiveMetrics; playing: boolean; speed: number; onPlayPause: () => void; onRestart: () => void; onCycleSpeed: () => void }): JSX.Element`
  - Visual hierarchy per spec §7: zone badge + HR dominant (large), pace/distance/elapsed secondary, controls tertiary (≥44pt touch targets). Zone uses color **and** label **and** icon from `ZONE_THEME`.

- [ ] **Step 1: Implement the component**

Create `src/ui/Dashboard.tsx`:
```tsx
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { LiveMetrics } from "../core/metrics";
import { formatDuration, formatDistance, formatPace } from "../core/format";
import { ZONE_THEME } from "./theme";

export function Dashboard({
  metrics,
  playing,
  speed,
  onPlayPause,
  onRestart,
  onCycleSpeed,
}: {
  metrics: LiveMetrics;
  playing: boolean;
  speed: number;
  onPlayPause: () => void;
  onRestart: () => void;
  onCycleSpeed: () => void;
}): JSX.Element {
  const zone = metrics.zone ? ZONE_THEME[metrics.zone] : null;
  const zoneColor = zone?.color ?? "#6B7280";

  return (
    <View style={styles.wrap}>
      <View style={[styles.zoneBadge, { backgroundColor: zoneColor }]}>
        <Text style={styles.zoneIcon}>{zone?.icon ?? "—"}</Text>
        <Text style={styles.zoneLabel}>{zone?.label ?? "Zone N/A"}</Text>
        <Text style={styles.hr}>{metrics.hr ?? "--"} bpm</Text>
      </View>

      <View style={styles.secondaryRow}>
        <Metric label="Elapsed" value={formatDuration(metrics.elapsedSec)} />
        <Metric label="Distance" value={formatDistance(metrics.distanceMeters)} />
        <Metric label="Pace" value={formatPace(metrics.paceMinPerKm)} />
      </View>

      <View style={styles.controls}>
        <Control label={playing ? "Pause" : "Play"} onPress={onPlayPause} />
        <Control label={`${speed}x`} onPress={onCycleSpeed} />
        <Control label="Restart" onPress={onRestart} />
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Control({ label, onPress }: { label: string; onPress: () => void }): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.control}
    >
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 16 },
  zoneBadge: { borderRadius: 16, padding: 20, alignItems: "center", gap: 4 },
  zoneIcon: { fontSize: 28 },
  zoneLabel: { color: "#fff", fontSize: 20, fontWeight: "700" },
  hr: { color: "#fff", fontSize: 40, fontWeight: "800" },
  secondaryRow: { flexDirection: "row", justifyContent: "space-around" },
  metric: { alignItems: "center" },
  metricValue: { fontSize: 20, fontWeight: "600" },
  metricLabel: { fontSize: 12, color: "#6B7280" },
  controls: { flexDirection: "row", justifyContent: "center", gap: 12 },
  control: {
    minWidth: 88,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  controlText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/Dashboard.tsx
git commit -m "feat: add glanceable on-run dashboard"
```

---

### Task 11: Profile screen (age + resting HR)

**Files:**
- Create: `src/ui/ProfileScreen.tsx`

**Interfaces:**
- Consumes: `Profile` from `../core/karvonen`.
- Produces: `function ProfileScreen(props: { profile: Profile; onChange: (p: Profile) => void; onDone: () => void }): JSX.Element`
  - Two numeric inputs (age, resting HR) editing `profile`, a Done button. Defaults come from the parent (Task 12 seeds `{ age: 35, restingHr: 60 }`).

- [ ] **Step 1: Implement the component**

Create `src/ui/ProfileScreen.tsx`:
```tsx
import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import type { Profile } from "../core/karvonen";

export function ProfileScreen({
  profile,
  onChange,
  onDone,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onDone: () => void;
}): JSX.Element {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Your profile</Text>

      <Field
        label="Age"
        value={profile.age}
        onChangeNumber={(n) => onChange({ ...profile, age: n })}
      />
      <Field
        label="Resting HR (bpm)"
        value={profile.restingHr}
        onChangeNumber={(n) => onChange({ ...profile, restingHr: n })}
      />

      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Done"
        style={styles.done}
      >
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeNumber,
}: {
  label: string;
  value: number;
  onChangeNumber: (n: number) => void;
}): JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType="number-pad"
        value={String(value)}
        onChangeText={(t) => onChangeNumber(Number(t) || 0)}
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 16, padding: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  field: { gap: 4 },
  label: { fontSize: 14, color: "#6B7280" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 10, padding: 12, fontSize: 18 },
  done: { minHeight: 48, borderRadius: 12, backgroundColor: "#0E7C7B", alignItems: "center", justifyContent: "center" },
  doneText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/ProfileScreen.tsx
git commit -m "feat: add minimal profile screen"
```

---

### Task 12: RunScreen + App wiring (rAF driver loop)

**Files:**
- Create: `src/ui/RunScreen.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: everything above — `parseGpx`, `ReplayEngine`, `cumulativeDistances`, `deriveMetrics`, `ZONE_THEME`, `RouteView`, `Dashboard`, `ProfileScreen`, `Profile`.
- The bundled GPX is read at startup via Expo asset loading; the rAF loop calls `engine.advance(deltaMs)` each frame and re-renders metrics.

- [ ] **Step 1: Load the bundled GPX as a string**

Create `src/ui/loadSampleGpx.ts`:
```ts
import { Asset } from "expo-asset";

// Returns the bundled Morning_Run.gpx file contents as a string.
export async function loadSampleGpx(): Promise<string> {
  const asset = Asset.fromModule(require("../../assets/Morning_Run.gpx"));
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const res = await fetch(uri);
  return res.text();
}
```

Ensure Metro bundles `.gpx`. Create `metro.config.js`:
```js
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("gpx");
module.exports = config;
```

Install the asset module:
```bash
npx expo install expo-asset
```

- [ ] **Step 2: Implement RunScreen with the rAF driver loop**

Create `src/ui/RunScreen.tsx`:
```tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { parseGpx } from "../core/gpxParser";
import { cumulativeDistances } from "../core/geo";
import { ReplayEngine } from "../core/replayEngine";
import { deriveMetrics } from "../core/metrics";
import type { Run } from "../core/types";
import type { Profile } from "../core/karvonen";
import { ZONE_THEME } from "./theme";
import { RouteView } from "./RouteView";
import { Dashboard } from "./Dashboard";
import { loadSampleGpx } from "./loadSampleGpx";

const SPEEDS = [1, 4, 8];

export function RunScreen({ profile }: { profile: Profile }): JSX.Element {
  const [run, setRun] = useState<Run | null>(null);
  const [, force] = useState(0);
  const engineRef = useRef<ReplayEngine | null>(null);
  const speedIdx = useRef(0);
  const lastTs = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSampleGpx().then((xml) => {
      if (cancelled) return;
      const parsed = parseGpx(xml);
      setRun(parsed);
      engineRef.current = new ReplayEngine(parsed.points, SPEEDS[0]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      const e = engineRef.current;
      if (e) {
        if (lastTs.current !== null) e.advance(ts - lastTs.current);
        lastTs.current = ts;
        if (e.playing) force((n) => n + 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cumulative = useMemo(
    () => (run ? cumulativeDistances(run.points) : []),
    [run],
  );

  if (!run || !engineRef.current) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text>Loading run…</Text>
      </View>
    );
  }

  const engine = engineRef.current;
  const metrics = deriveMetrics(run, cumulative, engine.index, profile);
  const markerColor = metrics.zone ? ZONE_THEME[metrics.zone].color : "#6B7280";

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{run.name}</Text>
      <RouteView points={run.points} currentIndex={engine.index} markerColor={markerColor} />
      <Dashboard
        metrics={metrics}
        playing={engine.playing}
        speed={SPEEDS[speedIdx.current]}
        onPlayPause={() => {
          engine.playing ? engine.pause() : engine.play();
          force((n) => n + 1);
        }}
        onRestart={() => {
          engine.seekToStart();
          force((n) => n + 1);
        }}
        onCycleSpeed={() => {
          speedIdx.current = (speedIdx.current + 1) % SPEEDS.length;
          engine.setSpeed(SPEEDS[speedIdx.current]);
          force((n) => n + 1);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 18, fontWeight: "600" },
});
```

- [ ] **Step 3: Wire App.tsx (profile gate → run screen)**

Replace `App.tsx`:
```tsx
import React, { useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { RunScreen } from "./src/ui/RunScreen";
import { ProfileScreen } from "./src/ui/ProfileScreen";
import type { Profile } from "./src/core/karvonen";

export default function App(): JSX.Element {
  const [profile, setProfile] = useState<Profile>({ age: 35, restingHr: 60 });
  const [editing, setEditing] = useState(true);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="auto" />
      {editing ? (
        <ProfileScreen profile={profile} onChange={setProfile} onDone={() => setEditing(false)} />
      ) : (
        <RunScreen profile={profile} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
});
```

- [ ] **Step 4: Type-check the whole app**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full core test suite**

Run: `npm test`
Expected: PASS — all core tests green (gpxParser, geo, karvonen, replayEngine, metrics, projection, format, smoke).

- [ ] **Step 6: Manual smoke on web**

Run: `npx expo start --web`
Expected: profile screen → Done → run screen loads "Morning Run", route polyline draws, marker moves on Play, zone badge color tracks HR, speed cycles 1×/4×/8×, Restart returns to start.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire run screen, replay driver loop, and profile gate"
```

---

## Self-Review

**Spec coverage (spec §s → tasks):**
- §1 GPX import + bundled sample → Task 1 (bundle), Task 12 (load), Task 2 (parse). ✓
- §1 replay w/ controls (play/pause/seek/speed) → Task 5 (engine), Task 12 (controls). ✓
- §1 SVG route plot + marker → Task 7 (projection), Task 9 (RouteView). ✓
- §1 live dashboard (elapsed/distance/pace/HR/zone) → Task 6 (metrics), Task 8 (format), Task 10 (Dashboard). ✓
- §1 Karvonen zones from profile → Task 4 (calculator), Task 11 (profile), Task 12 (gate). ✓
- §5 components (parser/geo/karvonen/replay/routeview/dashboard/profile/filepicker) → Tasks 2–12. Bundled-sample loader replaces general file picker for this slice (file picker is deferred per §1 "select a GPX"; bundled sample satisfies the demo path). ✓
- §6 error handling: empty/malformed GPX (Task 2 tolerant parse), missing HR → zone N/A (Task 4 null path, Task 10 "Zone N/A"), end-of-track finished (Task 5). Missing-profile prompt is satisfied by the profile-first gate (Task 12) seeding defaults. ✓
- §7 UI/UX principles → Task 8 (accessible zone theme: color+label+icon), Task 9/10 (hierarchy, ≥44pt targets, maxWidth centering). ✓
- §8 testing → core tests in Tasks 2–8; UI type-checks + manual smoke (Tasks 9–12), matching spec "UI smoke after core is green." ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `Profile`/`ZoneId` defined in Task 4 and reused verbatim in 6/8/10/11/12. `LiveMetrics` defined in Task 6, consumed in Task 10. `XY`/`projectRoute` defined in Task 7, consumed in Task 9. `ReplayEngine` API (`play/pause/playing/advance/index/finished/current/setSpeed/seekToStart`) defined in Task 5, used identically in Task 12. `ZONE_THEME` shape defined in Task 8, used in 9/10/12. ✓

Note: `finished` (Task 5) is implemented and tested but not surfaced in the UI this slice — kept because it is the natural end-of-track signal a near-future task (auto-stop / "finished" state, spec §6) will consume.
