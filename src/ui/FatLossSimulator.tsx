import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { Profile } from "../core/karvonen";
import type { TrackPoint } from "../core/types";
import { fuelEnergy, fatMassGrams, dynamicFatLossPlan } from "../core/fuel";

function clamp(min: number, max: number, x: number): number {
  return Math.min(max, Math.max(min, x));
}

// A "what-if" program planner. Vary sleep, weight, body-fat % and weekly
// cadence and see, for THIS run's effort, the fat burned per run and how many
// runs / weeks it takes to burn the goal slice of your current fat mass.
export function FatLossSimulator({
  points,
  cumulative,
  profile,
}: {
  points: TrackPoint[];
  cumulative: number[];
  profile: Profile;
}): React.JSX.Element {
  const [sleep, setSleep] = useState(profile.sleepHours ?? 8);
  const [weight, setWeight] = useState(profile.weightKg ?? 70);
  const [bodyFat, setBodyFat] = useState(profile.bodyFatPct ?? 25);
  const [goalPct, setGoalPct] = useState(12);
  const [runsPerWeek, setRunsPerWeek] = useState(4);

  const energy = fuelEnergy(points, cumulative, { ...profile, weightKg: weight, sleepHours: sleep });
  const fatPerRun = energy?.fatGrams ?? 0;
  const minutes = energy && energy.knownSec > 0 ? energy.knownSec / 60 : 0;
  const gPerMin = minutes > 0 ? fatPerRun / minutes : 0;

  const targetFat = fatMassGrams(weight, bodyFat) * (goalPct / 100);
  const plan = dynamicFatLossPlan(targetFat, fatPerRun, weight, runsPerWeek);
  const finite = Number.isFinite(plan.weeks);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🎯 Fat-loss simulator</Text>
      <Text style={styles.sub}>Replays this run's effort. Vary the inputs.</Text>

      <Sim label="😴 Sleep" value={`${sleep.toFixed(1)} h`} onStep={(d) => setSleep(clamp(3, 10, sleep + d * 0.5))} />
      <Sim label="⚖️ Weight" value={`${weight} kg`} onStep={(d) => setWeight(clamp(30, 200, weight + d))} />
      <Sim label="📊 Body fat" value={`${bodyFat}%`} onStep={(d) => setBodyFat(clamp(3, 60, bodyFat + d))} />
      <Sim label="🔥 Goal" value={`${goalPct}% of fat`} onStep={(d) => setGoalPct(clamp(1, 100, goalPct + d))} />
      <Sim label="🗓️ Runs/week" value={`${runsPerWeek}`} onStep={(d) => setRunsPerWeek(clamp(1, 14, runsPerWeek + d))} />

      <View style={styles.out}>
        <Text style={styles.outRow}>
          Burn rate: <Text style={styles.hl}>{gPerMin.toFixed(2)} g/min</Text> · {Math.round(fatPerRun)} g/run
        </Text>
        <Text style={styles.outRow}>
          Target: burn <Text style={styles.hl}>{(targetFat / 1000).toFixed(2)} kg</Text> fat ({goalPct}% of{" "}
          {(fatMassGrams(weight, bodyFat) / 1000).toFixed(1)} kg)
        </Text>
        {finite ? (
          <>
            <Text style={styles.goal}>
              ≈ {plan.runs} runs · {plan.weeks.toFixed(1)} weeks ({(plan.weeks / 4.345).toFixed(1)} months)
            </Text>
            <Text style={styles.outRow}>
              End weight ≈ <Text style={styles.hl}>{plan.endWeightKg.toFixed(1)} kg</Text> (burn slows as you
              lighten — dynamic)
            </Text>
          </>
        ) : (
          <Text style={styles.goal}>No fat burned at these inputs — add HR data or weight.</Text>
        )}
      </View>
    </View>
  );
}

function Sim({
  label,
  value,
  onStep,
}: {
  label: string;
  value: string;
  onStep: (dir: 1 | -1) => void;
}): React.JSX.Element {
  return (
    <View style={styles.simRow}>
      <Text style={styles.simLabel}>{label}</Text>
      <View style={styles.simCtl}>
        <Pressable
          onPress={() => onStep(-1)}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={styles.btn}
        >
          <Text style={styles.btnText}>−</Text>
        </Pressable>
        <Text style={styles.simValue}>{value}</Text>
        <Pressable
          onPress={() => onStep(1)}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={styles.btn}
        >
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#16213A", borderRadius: 16, padding: 16, gap: 8 },
  title: { fontSize: 15, fontWeight: "700", color: "#F1F5F9" },
  sub: { fontSize: 12, color: "#94A3B8", marginBottom: 4 },
  simRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  simLabel: { fontSize: 14, color: "#CBD5E1", flex: 1 },
  simCtl: { flexDirection: "row", alignItems: "center", gap: 12 },
  btn: { minWidth: 40, minHeight: 40, borderRadius: 10, backgroundColor: "#0B1220", alignItems: "center", justifyContent: "center" },
  btnText: { color: "#F1F5F9", fontSize: 22, fontWeight: "700" },
  simValue: { fontSize: 15, fontWeight: "700", color: "#F1F5F9", minWidth: 84, textAlign: "center" },
  out: { marginTop: 8, gap: 4, borderTopWidth: 1, borderTopColor: "#0B1220", paddingTop: 8 },
  outRow: { fontSize: 13, color: "#CBD5E1" },
  hl: { color: "#34D399", fontWeight: "700" },
  goal: { fontSize: 15, fontWeight: "800", color: "#34D399", marginTop: 2 },
});
