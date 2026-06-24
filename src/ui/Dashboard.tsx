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
