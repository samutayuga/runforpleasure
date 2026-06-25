# Run Conclusion (Bottom Line + Grade) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End the post-run summary with a synthesized "Bottom Line" — a letter grade, one-line verdict, and single top recommendation — derived purely from the zone distribution and decoupling.

**Architecture:** A pure tested core function (`runConclusion`) produces the grade/verdict/recommendation/tone; a small `ConclusionCard` component renders it at the end of `RunSummary`, computed inline from props `RunSummary` already holds (so no `RunScreen` change).

**Tech Stack:** TypeScript (strict), vitest (core test), Expo / React Native, existing `ZoneDistribution` / `Decoupling` structs and the `good/watch/act` severity palette.

## Global Constraints

- TypeScript strict mode on; no `any` in committed code.
- `src/core/` MUST NOT import from `react`, `react-native`, `expo`, or `ui/` — pure & platform-agnostic.
- No new dependencies.
- Reuse `ZoneDistribution` (`src/core/zoneDistribution.ts`), `Decoupling` (`src/core/decoupling.ts`), and the severity palette `good #0E7C7B`, `watch #B45309`, `act #9D174D`.
- Component return types use `React.JSX.Element`.
- Accessibility: tone conveyed by the worded verdict + label (never color alone); the card has an `accessibilityLabel`.
- Grade framing is aerobic-base; `grade` is `null` ("—") when HR is insufficient to judge.
- TDD for the core module: failing test first, run red, minimal code, run green, commit. UI verified by `npx tsc --noEmit` + manual smoke.

---

### Task 1: Conclusion logic (core)

**Files:**
- Create: `src/core/conclusion.ts`
- Test: `src/core/__tests__/conclusion.test.ts`

**Interfaces:**
- Consumes: `ZoneDistribution` from `./zoneDistribution`; `Decoupling` from `./decoupling`.
- Produces:
  - `type Grade = "A" | "B" | "C" | "D"`
  - `interface Conclusion { grade: Grade | null; verdict: string; recommendation: string; tone: "good" | "watch" | "act" }`
  - `function runConclusion(zones: ZoneDistribution, dc: Decoupling): Conclusion` — missing-HR guard first (`totalSec===0` or `unknownSec/totalSec>0.5` → grade `null`, incomplete verdict, watch); else score → grade (drift good 2/moderate 1/high 0/null 1; aerobic share `below%+zone2%` ≥70 → 2 / ≥50 → 1 / else 0; `above%>20` → −1; score≥4 A / 3 B / 2 C / ≤1 D) and verdict/recommendation/tone by ordered rules (high-drift-or-above act → moderate-or-aerobic-50to70 watch → else good).

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/conclusion.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { runConclusion } from "../conclusion";
import type { ZoneDistribution } from "../zoneDistribution";
import type { Decoupling } from "../decoupling";

function zones(over: Partial<ZoneDistribution> = {}): ZoneDistribution {
  return {
    secondsByZone: { below: 0, zone2: 0, zone3: 0, above: 0 },
    pctByZone: { below: 0, zone2: 0, zone3: 0, above: 0 },
    unknownSec: 0,
    totalSec: 1000,
    ...over,
  };
}

function dc(rating: Decoupling["rating"]): Decoupling {
  return { firstEf: 1, secondEf: 1, pct: rating === null ? null : 5, rating };
}

describe("runConclusion grade", () => {
  it("grades A for low drift and a strongly aerobic run", () => {
    // drift good(2) + aerobic 80 (>=70 -> 2) + no penalty = 4
    const c = runConclusion(zones({ pctByZone: { below: 30, zone2: 50, zone3: 20, above: 0 } }), dc("good"));
    expect(c.grade).toBe("A");
    expect(c.tone).toBe("good");
  });

  it("grades B for good drift with moderate aerobic share", () => {
    // drift good(2) + aerobic 60 (>=50 -> 1) = 3
    const c = runConclusion(zones({ pctByZone: { below: 20, zone2: 40, zone3: 40, above: 0 } }), dc("good"));
    expect(c.grade).toBe("B");
    expect(c.tone).toBe("watch"); // aerobicShare in [50,70)
  });

  it("grades C for good drift but low aerobic share", () => {
    // drift good(2) + aerobic 40 (<50 -> 0) = 2
    const c = runConclusion(zones({ pctByZone: { below: 20, zone2: 20, zone3: 60, above: 0 } }), dc("good"));
    expect(c.grade).toBe("C");
    expect(c.tone).toBe("good");
  });

  it("grades D for high drift and low aerobic share", () => {
    // drift high(0) + aerobic 30 (0) = 0
    const c = runConclusion(zones({ pctByZone: { below: 10, zone2: 20, zone3: 70, above: 0 } }), dc("high"));
    expect(c.grade).toBe("D");
    expect(c.tone).toBe("act");
  });
});

describe("runConclusion verdict/tone", () => {
  it("flags too-hard when above Zone 3 exceeds 20%", () => {
    const c = runConclusion(zones({ pctByZone: { below: 10, zone2: 20, zone3: 30, above: 40 } }), dc("good"));
    expect(c.tone).toBe("act");
    expect(c.verdict).toContain("too hard");
  });

  it("flags drift as a watch for moderate decoupling", () => {
    const c = runConclusion(zones({ pctByZone: { below: 40, zone2: 40, zone3: 20, above: 0 } }), dc("moderate"));
    expect(c.tone).toBe("watch");
    expect(c.verdict).toContain("some drift");
  });

  it("praises a solid aerobic session", () => {
    const c = runConclusion(zones({ pctByZone: { below: 30, zone2: 50, zone3: 20, above: 0 } }), dc("good"));
    expect(c.tone).toBe("good");
    expect(c.verdict).toContain("Solid");
  });
});

describe("runConclusion insufficient data", () => {
  it("returns no grade when there is no timed data", () => {
    const c = runConclusion(zones({ totalSec: 0 }), dc("good"));
    expect(c.grade).toBeNull();
    expect(c.verdict).toContain("Incomplete");
    expect(c.tone).toBe("watch");
  });

  it("returns no grade when HR is missing for more than half the run", () => {
    const c = runConclusion(
      zones({ unknownSec: 600, totalSec: 1000, pctByZone: { below: 20, zone2: 20, zone3: 0, above: 0 } }),
      dc("good"),
    );
    expect(c.grade).toBeNull();
  });

  it("always provides a non-empty verdict and recommendation", () => {
    for (const r of ["good", "moderate", "high", null] as Decoupling["rating"][]) {
      const c = runConclusion(zones({ pctByZone: { below: 25, zone2: 25, zone3: 25, above: 25 } }), dc(r));
      expect(c.verdict.length).toBeGreaterThan(0);
      expect(c.recommendation.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/conclusion.test.ts`
Expected: FAIL — cannot find module `../conclusion`.

- [ ] **Step 3: Write the implementation**

Create `src/core/conclusion.ts`:
```ts
import type { ZoneDistribution } from "./zoneDistribution";
import type { Decoupling } from "./decoupling";

export type Grade = "A" | "B" | "C" | "D";

export interface Conclusion {
  grade: Grade | null;
  verdict: string;
  recommendation: string;
  tone: "good" | "watch" | "act";
}

export function runConclusion(zones: ZoneDistribution, dc: Decoupling): Conclusion {
  const hrMissing = zones.totalSec > 0 ? zones.unknownSec / zones.totalSec : 1;
  if (zones.totalSec === 0 || hrMissing > 0.5) {
    return {
      grade: null,
      verdict: "Incomplete — heart rate mostly missing.",
      recommendation: "Connect a heart-rate strap to grade this run.",
      tone: "watch",
    };
  }

  const aerobicShare = zones.pctByZone.below + zones.pctByZone.zone2;

  const driftPts =
    dc.rating === "good" ? 2 : dc.rating === "moderate" ? 1 : dc.rating === "high" ? 0 : 1;
  const aerobicPts = aerobicShare >= 70 ? 2 : aerobicShare >= 50 ? 1 : 0;
  const penalty = zones.pctByZone.above > 20 ? -1 : 0;
  const score = driftPts + aerobicPts + penalty;
  const grade: Grade = score >= 4 ? "A" : score === 3 ? "B" : score === 2 ? "C" : "D";

  if (dc.rating === "high" || zones.pctByZone.above > 20) {
    return {
      grade,
      verdict: "Ran too hard for base-building.",
      recommendation: "Slow down — start easier and spend more time in Zone 2.",
      tone: "act",
    };
  }
  if (dc.rating === "moderate" || (aerobicShare >= 50 && aerobicShare < 70)) {
    return {
      grade,
      verdict: "Decent aerobic session with some drift.",
      recommendation: "Hold the easy pace longer and ease your start.",
      tone: "watch",
    };
  }
  return {
    grade,
    verdict: "Solid Zone 2 aerobic session.",
    recommendation: "Great base work — repeat it and gradually extend the distance.",
    tone: "good",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/conclusion.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Run the full core suite (no regressions)**

Run: `npm test`
Expected: PASS — all prior suites plus conclusion green.

- [ ] **Step 6: Commit**

```bash
git add src/core/conclusion.ts src/core/__tests__/conclusion.test.ts
git commit -m "feat: add run conclusion (grade + verdict + recommendation)"
```

---

### Task 2: ConclusionCard + summary render

**Files:**
- Create: `src/ui/ConclusionCard.tsx`
- Modify: `src/ui/RunSummary.tsx`

**Interfaces:**
- Consumes: `Conclusion`/`runConclusion` from `../core/conclusion` (Task 1).
- Produces: `function ConclusionCard(props: { conclusion: Conclusion }): React.JSX.Element` — a tone-colored "Bottom line" card (label + grade badge + verdict + "Next:" recommendation), rendered at the end of `RunSummary`. `RunSummary` computes the conclusion inline from its existing `zones`/`decoupling` props; no `RunScreen`/prop change.

- [ ] **Step 1: Implement the ConclusionCard**

Create `src/ui/ConclusionCard.tsx`:
```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Conclusion } from "../core/conclusion";

const TONE_COLOR: Record<Conclusion["tone"], string> = {
  good: "#0E7C7B",
  watch: "#B45309",
  act: "#9D174D",
};

export function ConclusionCard({ conclusion }: { conclusion: Conclusion }): React.JSX.Element {
  const color = TONE_COLOR[conclusion.tone];
  const a11y = `Bottom line, grade ${conclusion.grade ?? "not available"}. ${conclusion.verdict} Next: ${conclusion.recommendation}`;

  return (
    <View style={[styles.card, { borderLeftColor: color }]} accessibilityLabel={a11y}>
      <View style={styles.head}>
        <Text style={styles.label}>BOTTOM LINE</Text>
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{conclusion.grade ?? "—"}</Text>
        </View>
      </View>
      <Text style={styles.verdict}>{conclusion.verdict}</Text>
      <Text style={styles.next}>Next: {conclusion.recommendation}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderLeftWidth: 4, backgroundColor: "#16213A", borderRadius: 10, padding: 14, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 11, fontWeight: "700", color: "#94A3B8", letterSpacing: 1 },
  badge: { minWidth: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  verdict: { fontSize: 16, fontWeight: "700", color: "#F1F5F9" },
  next: { fontSize: 13, color: "#94A3B8" },
});
```

- [ ] **Step 2: Add imports to RunSummary**

In `src/ui/RunSummary.tsx`, add after the existing component imports (after `import { ZoneTimeline } from "./ZoneTimeline";`):
```tsx
import { runConclusion } from "../core/conclusion";
import { ConclusionCard } from "./ConclusionCard";
```

- [ ] **Step 3: Compute the conclusion inside RunSummary**

In `src/ui/RunSummary.tsx`, the component body currently goes straight from the destructured params to `return (`. Add a computed line immediately before `return (`:
```tsx
  const conclusion = runConclusion(zones, decoupling);
```
(`zones` and `decoupling` are existing destructured props — no new inputs.)

- [ ] **Step 4: Render the card at the end of the summary**

In `src/ui/RunSummary.tsx`, the JSX has the `insights.map(...)` block followed by the "Run again" `<Pressable>`. Insert the card between them — immediately after the closing `))}` of the `insights.map` and immediately before `<Pressable onPress={onRestart} …>`:
```tsx
      <ConclusionCard conclusion={conclusion} />
```

- [ ] **Step 5: Type-check the whole app**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full core suite (no regressions)**

Run: `npm test`
Expected: PASS — all suites green (no core code changed in this task).

- [ ] **Step 7: Manual smoke on web**

Run: `npm run web` (or reload http://localhost:8081)
Expected: at the end of the summary, after the insight cards and before "Run again", a "BOTTOM LINE" card shows a tone-colored grade badge (A/B/C/D), the verdict, and a "Next:" recommendation; a run with no HR shows grade "—" with the "Incomplete" verdict; the insight cards remain above it.

- [ ] **Step 8: Commit**

```bash
git add src/ui/ConclusionCard.tsx src/ui/RunSummary.tsx
git commit -m "feat: show Bottom Line conclusion + grade at the end of the summary"
```

---

## Self-Review

**Spec coverage (spec §s → tasks):**
- §1 Conclusion logic (pure core: missing-HR guard, grade rubric, ordered verdict/recommendation/tone rules) → Task 1. ✓
- §2 UI (`ConclusionCard` tone-colored bottom-line card; RunSummary computes inline + renders after insights, before Run again; no RunScreen change) → Task 2. ✓
- §3 Testing (conclusion vitest grade boundaries + branches + null + non-empty; tsc + manual smoke) → Task 1 Step 4/5, Task 2 Step 5/7. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `Grade`/`Conclusion`/`runConclusion(zones, dc)` defined in Task 1, consumed verbatim in Task 2 (`ConclusionCard` prop `conclusion: Conclusion`, `runConclusion(zones, decoupling)` call). `TONE_COLOR: Record<Conclusion["tone"], string>` palette matches the spec (`good/watch/act` → `#0E7C7B/#B45309/#9D174D`). `zones`/`decoupling` are the existing `RunSummary` props (`ZoneDistribution`/`Decoupling`). ✓

**Scope:** Single small slice — one pure function + one card + inline wiring. No decomposition needed. Additive (one card appended), no contract changes. ✓
```
