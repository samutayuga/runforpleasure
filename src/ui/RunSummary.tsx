import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { Decoupling } from "../core/decoupling";
import type { Insight } from "../core/coaching";
import type { ZoneId } from "../core/karvonen";
import { formatDuration } from "../core/format";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ZONE_THEME } from "./theme";

const ORDER: ZoneId[] = ["below", "zone2", "zone3", "above"];

const SEVERITY_COLOR: Record<Insight["severity"], string> = {
  good: "#0E7C7B",
  watch: "#B45309",
  act: "#9D174D",
};

const RATING_COLOR: Record<NonNullable<Decoupling["rating"]>, string> = {
  good: "#0E7C7B",
  moderate: "#B45309",
  high: "#9D174D",
};

export function RunSummary({
  zones,
  decoupling,
  insights,
  onInfo,
  onRestart,
}: {
  zones: ZoneDistribution;
  decoupling: Decoupling;
  insights: Insight[];
  onInfo?: () => void;
  onRestart: () => void;
}): React.JSX.Element {
  const driftColor = decoupling.rating ? RATING_COLOR[decoupling.rating] : "#94A3B8";
  const driftText =
    decoupling.pct === null
      ? "Not enough data"
      : `${decoupling.pct >= 0 ? "+" : ""}${Math.round(decoupling.pct)}%  ·  ${decoupling.rating ?? ""}`;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Run analysis</Text>

      <View style={styles.bar}>
        {ORDER.map((z) =>
          zones.pctByZone[z] > 0 ? (
            <View key={z} style={{ flex: zones.pctByZone[z], backgroundColor: ZONE_THEME[z].color }} />
          ) : null,
        )}
      </View>

      <View style={styles.zoneList}>
        {ORDER.map((z) => (
          <View key={z} style={styles.zoneRow}>
            <Text style={styles.zoneLabel}>
              {ZONE_THEME[z].icon} {ZONE_THEME[z].label}
            </Text>
            <Text style={styles.zoneValue}>
              {formatDuration(zones.secondsByZone[z])} · {Math.round(zones.pctByZone[z])}%
            </Text>
          </View>
        ))}
        {zones.unknownSec > 0 ? (
          <View style={styles.zoneRow}>
            <Text style={styles.zoneLabel}>❔ No HR</Text>
            <Text style={styles.zoneValue}>{formatDuration(zones.unknownSec)}</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        style={[styles.driftCard, { borderColor: driftColor }]}
        onPress={onInfo}
        accessibilityRole="button"
        accessibilityLabel="What does decoupling mean?"
      >
        <View style={styles.driftHead}>
          <Text style={styles.driftLabel}>Aerobic decoupling</Text>
          <MaterialCommunityIcons name="information-outline" size={15} color="#94A3B8" />
        </View>
        <Text style={[styles.driftValue, { color: driftColor }]}>{driftText}</Text>
      </Pressable>

      {insights.map((ins, i) => (
        <View key={i} style={[styles.insight, { borderLeftColor: SEVERITY_COLOR[ins.severity] }]}>
          <Text style={styles.insightHead}>{ins.headline}</Text>
          <Text style={styles.insightDetail}>{ins.detail}</Text>
        </View>
      ))}

      <Pressable onPress={onRestart} accessibilityRole="button" accessibilityLabel="Run again" style={styles.btn}>
        <Text style={styles.btnText}>Run again</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 16, padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#F1F5F9" },
  bar: { flexDirection: "row", height: 16, borderRadius: 8, overflow: "hidden", backgroundColor: "#1E293B" },
  zoneList: { gap: 6 },
  zoneRow: { flexDirection: "row", justifyContent: "space-between" },
  zoneLabel: { fontSize: 14, color: "#F1F5F9" },
  zoneValue: { fontSize: 14, color: "#94A3B8" },
  driftCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  driftLabel: { fontSize: 13, color: "#94A3B8" },
  driftHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  driftValue: { fontSize: 24, fontWeight: "800" },
  insight: { borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 6, gap: 2 },
  insightHead: { fontSize: 15, fontWeight: "700", color: "#F1F5F9" },
  insightDetail: { fontSize: 13, color: "#94A3B8" },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: "#0E7C7B", alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
