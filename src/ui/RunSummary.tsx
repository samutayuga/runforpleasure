import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { Decoupling } from "../core/decoupling";
import type { Insight } from "../core/coaching";
import type { ZoneId } from "../core/karvonen";
import { formatDuration } from "../core/format";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ZONE_THEME } from "./theme";
import { ZoneBar } from "./ZoneBar";
import { DriftGauge } from "./DriftGauge";
import { ZoneTimeline } from "./ZoneTimeline";
import { runConclusion } from "../core/conclusion";
import { ConclusionCard } from "./ConclusionCard";
import type { TrackPoint } from "../core/types";
import type { Profile } from "../core/karvonen";

const ORDER: ZoneId[] = ["below", "zone2", "zone3", "above"];

const SEVERITY_COLOR: Record<Insight["severity"], string> = {
  good: "#0E7C7B",
  watch: "#B45309",
  act: "#9D174D",
};

export function RunSummary({
  zones,
  decoupling,
  insights,
  points,
  cumulative,
  profile,
  onInfo,
  onRestart,
}: {
  zones: ZoneDistribution;
  decoupling: Decoupling;
  insights: Insight[];
  points: TrackPoint[];
  cumulative: number[];
  profile: Profile;
  onInfo?: () => void;
  onRestart: () => void;
}): React.JSX.Element {
  const conclusion = runConclusion(zones, decoupling);
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Run analysis</Text>

      <ZoneBar zones={zones} height={18} />
      <ZoneTimeline points={points} cumulative={cumulative} profile={profile} width={440} />

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
        style={styles.driftWrap}
        onPress={onInfo}
        accessibilityRole="button"
        accessibilityLabel="What does decoupling mean?"
      >
        <DriftGauge decoupling={decoupling} size={120} />
        <View style={styles.driftHint}>
          <Text style={styles.driftHintText}>Aerobic decoupling</Text>
          <MaterialCommunityIcons name="information-outline" size={15} color="#94A3B8" />
        </View>
      </Pressable>

      {insights.map((ins, i) => (
        <View key={i} style={[styles.insight, { borderLeftColor: SEVERITY_COLOR[ins.severity] }]}>
          <Text style={styles.insightHead}>{ins.headline}</Text>
          <Text style={styles.insightDetail}>{ins.detail}</Text>
        </View>
      ))}

      <ConclusionCard conclusion={conclusion} />

      <Pressable onPress={onRestart} accessibilityRole="button" accessibilityLabel="Run again" style={styles.btn}>
        <Text style={styles.btnText}>Run again</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 16, padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#F1F5F9" },
  zoneList: { gap: 6 },
  zoneRow: { flexDirection: "row", justifyContent: "space-between" },
  zoneLabel: { fontSize: 14, color: "#F1F5F9" },
  zoneValue: { fontSize: 14, color: "#94A3B8" },
  driftWrap: { alignItems: "center", gap: 6 },
  driftHint: { flexDirection: "row", alignItems: "center", gap: 6 },
  driftHintText: { fontSize: 13, color: "#94A3B8" },
  insight: { borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 6, gap: 2 },
  insightHead: { fontSize: 15, fontWeight: "700", color: "#F1F5F9" },
  insightDetail: { fontSize: 13, color: "#94A3B8" },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: "#0E7C7B", alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
