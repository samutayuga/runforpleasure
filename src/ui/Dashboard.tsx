import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Surface, Button } from "react-native-paper";
import type { LiveMetrics } from "../core/metrics";
import { formatDuration, formatDistance, formatPace } from "../core/format";
import { ZONE_THEME } from "./theme";
import type { Weather } from "./weather";

function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Dashboard({
  metrics,
  playing,
  speed,
  startTime,
  endTime,
  weather,
  onPlayPause,
  onRestart,
  onCycleSpeed,
}: {
  metrics: LiveMetrics;
  playing: boolean;
  speed: number;
  startTime: Date;
  endTime: Date;
  weather: Weather | null;
  onPlayPause: () => void;
  onRestart: () => void;
  onCycleSpeed: () => void;
}): React.JSX.Element {
  const zone = metrics.zone ? ZONE_THEME[metrics.zone] : null;
  const zoneColor = zone?.color ?? "#94A3B8";

  return (
    <View style={styles.wrap}>
      <Surface style={styles.hrCard} elevation={3}>
        {/* 3-column row */}
        <View style={styles.columnsRow}>
          {/* LEFT column */}
          <View style={styles.leftCol}>
            <Stat label="Elapsed" value={formatDuration(metrics.elapsedSec)} align="flex-start" />
            <Stat label="Distance" value={formatDistance(metrics.distanceMeters)} align="flex-start" />
            <Stat label="Pace" value={formatPace(metrics.paceMinPerKm)} align="flex-start" />
            <Stat label="Start" value={formatClock(startTime)} align="flex-start" />
          </View>

          {/* CENTER hero */}
          <View style={styles.centerCol}>
            <View style={[styles.zonePill, { backgroundColor: zoneColor }]}>
              <Text style={styles.pillIcon}>{zone?.icon ?? "•"}</Text>
              <Text style={styles.pillLabel}>{zone?.label ?? "Zone N/A"}</Text>
            </View>
            <Text style={styles.hrLine}>
              <Text style={styles.hrNum}>{metrics.hr ?? "--"}</Text>
              <Text style={styles.hrUnit}> bpm</Text>
            </Text>
            <Text style={styles.condition}>{weather?.condition ?? "—"}</Text>
          </View>

          {/* RIGHT column */}
          <View style={styles.rightCol}>
            <Stat label="End" value={formatClock(endTime)} align="flex-end" />
            <Stat
              label="Temp"
              value={weather?.temperatureC != null ? `${Math.round(weather.temperatureC)}°C` : "—"}
              align="flex-end"
            />
            <Stat
              label="Humidity"
              value={weather?.humidityPct != null ? `${Math.round(weather.humidityPct)}%` : "—"}
              align="flex-end"
            />
            <Stat
              label="Wind"
              value={weather?.windKmh != null ? `${Math.round(weather.windKmh)} km/h` : "—"}
              align="flex-end"
            />
          </View>
        </View>

        {/* Controls row */}
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
      </Surface>
    </View>
  );
}

function Stat({ label, value, align }: { label: string; value: string; align: "flex-start" | "flex-end" }): React.JSX.Element {
  return (
    <View style={{ alignItems: align }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    gap: 20,
  },
  columnsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftCol: { flex: 1, alignItems: "flex-start", gap: 10 },
  centerCol: { flexShrink: 0, alignItems: "center", paddingHorizontal: 10, gap: 8 },
  rightCol: { flex: 1, alignItems: "flex-end", gap: 10 },
  zonePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillIcon: { fontSize: 15 },
  pillLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  hrLine: { textAlign: "center" },
  hrNum: { fontSize: 46, fontWeight: "800", color: "#F1F5F9" },
  hrUnit: { fontSize: 16, fontWeight: "600", color: "#94A3B8" },
  condition: { fontSize: 12, color: "#94A3B8" },
  statValue: { fontSize: 15, fontWeight: "600", color: "#F1F5F9" },
  statLabel: { fontSize: 10, color: "#94A3B8", marginTop: 2 },
  controls: { flexDirection: "row", justifyContent: "center", gap: 12 },
});
