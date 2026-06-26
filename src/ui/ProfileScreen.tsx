import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import type { Profile } from "../core/karvonen";
import { maxHr, hrr } from "../core/karvonen";
import { readinessFactor, readinessLevel } from "../core/readiness";
import { READINESS_THEME } from "./theme";

function clamp(min: number, max: number, x: number): number {
  return Math.min(max, Math.max(min, x));
}

function StatStepper({
  icon,
  label,
  value,
  unit,
  onStep,
}: {
  icon: string;
  label: string;
  value: string;
  unit: string;
  onStep: (dir: 1 | -1) => void;
}): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>
        {icon} {label}
      </Text>
      <View style={styles.stepRow}>
        <Pressable
          onPress={() => onStep(-1)}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={styles.stepBtn}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.cardValue}>{value}</Text>
        <Pressable
          onPress={() => onStep(1)}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={styles.stepBtn}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.cardUnit}>{unit}</Text>
    </View>
  );
}

export function ProfileScreen({
  profile,
  onChange,
  onDone,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onDone: () => void;
}): React.JSX.Element {
  const sleep = profile.sleepHours ?? 8;
  const factor = readinessFactor(profile.sleepHours);
  const theme = READINESS_THEME[readinessLevel(factor)];
  const barFraction = clamp(0, 1, (factor - 0.9) / 0.1);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Your profile</Text>

      <View style={styles.row}>
        <StatStepper
          icon="🎂"
          label="Age"
          value={String(profile.age)}
          unit="years"
          onStep={(d) => onChange({ ...profile, age: clamp(10, 100, profile.age + d) })}
        />
        <StatStepper
          icon="❤️"
          label="Resting HR"
          value={String(profile.restingHr)}
          unit="bpm"
          onStep={(d) => onChange({ ...profile, restingHr: clamp(30, 110, profile.restingHr + d) })}
        />
      </View>

      <View style={styles.sleepCard}>
        <Text style={styles.cardLabel}>😴 Sleep last night</Text>
        <View style={styles.stepRow}>
          <Pressable
            onPress={() => onChange({ ...profile, sleepHours: clamp(0, 12, sleep - 0.5) })}
            accessibilityRole="button"
            accessibilityLabel="Decrease sleep"
            style={styles.stepBtn}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <Text style={styles.cardValue}>{sleep.toFixed(1)} h</Text>
          <Pressable
            onPress={() => onChange({ ...profile, sleepHours: clamp(0, 12, sleep + 0.5) })}
            accessibilityRole="button"
            accessibilityLabel="Increase sleep"
            style={styles.stepBtn}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { flex: barFraction, backgroundColor: theme.color }]} />
          <View style={{ flex: 1 - barFraction }} />
        </View>
        <Text style={[styles.readyText, { color: theme.color }]}>
          {theme.icon} {theme.label}
        </Text>
      </View>

      <Text style={styles.summary}>
        {theme.icon} {theme.label} · MaxHR {Math.round(maxHr(profile.age))} · HRR {Math.round(hrr(profile))}
      </Text>

      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Start run"
        style={styles.startBtn}
      >
        <Text style={styles.startText}>Start run</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    gap: 16,
    padding: 16,
    justifyContent: "center",
    backgroundColor: "#0B1220",
  },
  title: { color: "#F1F5F9", fontSize: 22, fontWeight: "700" },
  row: { flexDirection: "row", gap: 12 },
  card: { flex: 1, backgroundColor: "#16213A", borderRadius: 16, padding: 16, gap: 8, alignItems: "center" },
  sleepCard: { backgroundColor: "#16213A", borderRadius: 16, padding: 16, gap: 10 },
  cardLabel: { color: "#94A3B8", fontSize: 14, fontWeight: "600" },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  stepBtn: { minWidth: 44, minHeight: 44, borderRadius: 12, backgroundColor: "#0B1220", alignItems: "center", justifyContent: "center" },
  stepBtnText: { color: "#F1F5F9", fontSize: 24, fontWeight: "700" },
  cardValue: { color: "#F1F5F9", fontSize: 28, fontWeight: "800", minWidth: 64, textAlign: "center" },
  cardUnit: { color: "#64748B", fontSize: 12 },
  barTrack: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: "#0B1220" },
  barFill: { borderRadius: 5 },
  readyText: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  summary: { color: "#94A3B8", fontSize: 14, textAlign: "center" },
  startBtn: { minHeight: 48, borderRadius: 12, backgroundColor: "#0E7C7B", alignItems: "center", justifyContent: "center", marginTop: 4 },
  startText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
