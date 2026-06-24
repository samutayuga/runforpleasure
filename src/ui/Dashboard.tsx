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
}): React.JSX.Element {
  const zone = metrics.zone ? ZONE_THEME[metrics.zone] : null;
  const zoneColor = zone?.color ?? "#94A3B8";

  return (
    <View style={styles.wrap}>
      <View style={styles.hrCard}>
        <View style={[styles.zonePill, { backgroundColor: zoneColor }]}>
          <Text style={styles.pillIcon}>{zone?.icon ?? "•"}</Text>
          <Text style={styles.pillLabel}>{zone?.label ?? "Zone N/A"}</Text>
        </View>
        <Text style={styles.hrLine}>
          <Text style={[styles.hrNum, { color: zoneColor }]}>{metrics.hr ?? "--"}</Text>
          <Text style={styles.hrUnit}> bpm</Text>
        </Text>
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

function Metric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Control({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
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
  hrCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  zonePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  pillIcon: { fontSize: 15 },
  pillLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  hrLine: { textAlign: "center" },
  hrNum: { fontSize: 56, fontWeight: "800" },
  hrUnit: { fontSize: 20, fontWeight: "600", color: "#64748B" },
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
