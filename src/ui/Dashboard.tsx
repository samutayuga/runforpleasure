import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Surface, Button } from "react-native-paper";
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
      <Surface style={styles.hrCard} elevation={3}>
        <View style={[styles.zonePill, { backgroundColor: zoneColor }]}>
          <Text style={styles.pillIcon}>{zone?.icon ?? "•"}</Text>
          <Text style={styles.pillLabel}>{zone?.label ?? "Zone N/A"}</Text>
        </View>
        <Text style={styles.hrLine}>
          <Text style={styles.hrNum}>{metrics.hr ?? "--"}</Text>
          <Text style={styles.hrUnit}> bpm</Text>
        </Text>
      </Surface>

      <View style={styles.secondaryRow}>
        <Metric label="Elapsed" value={formatDuration(metrics.elapsedSec)} />
        <Metric label="Distance" value={formatDistance(metrics.distanceMeters)} />
        <Metric label="Pace" value={formatPace(metrics.paceMinPerKm)} />
      </View>

      <View style={styles.controls}>
        <Button mode="contained-tonal" onPress={onPlayPause} accessibilityLabel={playing ? "Pause" : "Play"}>
          {playing ? "Pause" : "Play"}
        </Button>
        <Button mode="contained-tonal" onPress={onCycleSpeed} accessibilityLabel={`${speed}x`}>
          {`${speed}x`}
        </Button>
        <Button mode="contained-tonal" onPress={onRestart} accessibilityLabel="Restart">
          Restart
        </Button>
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

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 16 },
  hrCard: {
    backgroundColor: "#16213A",
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 14,
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
  hrNum: { fontSize: 56, fontWeight: "800", color: "#F1F5F9" },
  hrUnit: { fontSize: 20, fontWeight: "600", color: "#94A3B8" },
  secondaryRow: { flexDirection: "row", justifyContent: "space-around" },
  metric: { alignItems: "center" },
  metricValue: { fontSize: 20, fontWeight: "600", color: "#F1F5F9" },
  metricLabel: { fontSize: 12, color: "#94A3B8" },
  controls: { flexDirection: "row", justifyContent: "center", gap: 12 },
});
