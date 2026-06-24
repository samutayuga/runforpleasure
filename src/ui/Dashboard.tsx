import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Surface } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import type { LiveMetrics } from "../core/metrics";
import { formatDuration, formatDistance, formatPace } from "../core/format";
import { ZONE_THEME } from "./theme";
import type { ZoneId } from "../core/karvonen";
import type { Weather } from "./weather";

const EFFORT: Record<ZoneId, { i: number; word: string; emoji: string }> = {
  below: { i: 0, word: "Recovery", emoji: "😌" },
  zone2: { i: 1, word: "Easy",     emoji: "🙂" },
  zone3: { i: 2, word: "Tempo",    emoji: "😤" },
  above: { i: 3, word: "Hard",     emoji: "🥵" },
};

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
  const z = metrics.zone;
  const eff = z ? EFFORT[z] : null;
  const zoneColor = z ? ZONE_THEME[z].color : "#94A3B8";

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
            {/* Zone meter */}
            <View style={{ flexDirection: "row", width: 150 }}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    marginHorizontal: 2,
                    backgroundColor: eff && i <= eff.i ? zoneColor : "#334155",
                  }}
                />
              ))}
            </View>
            {/* Effort emoji + word */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 15 }}>{eff?.emoji ?? "—"}</Text>
              <Text style={{ fontSize: 15, fontWeight: "700", color: zoneColor }}>
                {eff?.word ?? "Zone N/A"}
              </Text>
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
          <Pressable
            onPress={onPlayPause}
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause" : "Play"}
            style={styles.iconBtn}
          >
            <Ionicons name={playing ? "pause" : "play"} size={24} color="#F1F5F9" />
          </Pressable>
          <Pressable
            onPress={onCycleSpeed}
            accessibilityRole="button"
            accessibilityLabel="Cycle speed"
            style={styles.iconBtn}
          >
            <Text style={styles.speedText}>{`${speed}x`}</Text>
          </Pressable>
          <Pressable
            onPress={onRestart}
            accessibilityRole="button"
            accessibilityLabel="Restart"
            style={styles.iconBtn}
          >
            <Ionicons name="refresh" size={22} color="#F1F5F9" />
          </Pressable>
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
  hrLine: { textAlign: "center" },
  hrNum: { fontSize: 46, fontWeight: "800", color: "#F1F5F9" },
  hrUnit: { fontSize: 16, fontWeight: "600", color: "#94A3B8" },
  condition: { fontSize: 12, color: "#94A3B8" },
  statValue: { fontSize: 15, fontWeight: "600", color: "#F1F5F9" },
  statLabel: { fontSize: 10, color: "#94A3B8", marginTop: 2 },
  controls: { flexDirection: "row", justifyContent: "center", gap: 12 },
  iconBtn: {
    minWidth: 56,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  speedText: { fontSize: 15, fontWeight: "700", color: "#F1F5F9" },
});
