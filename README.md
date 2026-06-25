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
