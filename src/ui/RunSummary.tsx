import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { Decoupling } from "../core/decoupling";
import type { Insight } from "../core/coaching";
import type { ZoneId } from "../core/karvonen";
import { formatDuration } from "../core/format";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ZONE_THEME, READINESS_THEME } from "./theme";
import { readinessFactor, readinessLevel } from "../core/readiness";
import { ZoneBar } from "./ZoneBar";
import { DriftGauge } from "./DriftGauge";
import { ZoneTimeline } from "./ZoneTimeline";
import { runConclusion } from "../core/conclusion";
import { ConclusionCard } from "./ConclusionCard";
import { fuelSplit, fuelEnergy } from "../core/fuel";
import { FuelSplit } from "./FuelSplit";
import { FatLossSimulator } from "./FatLossSimulator";
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
  const fuel = fuelSplit(points, profile);
  const energy = fuelEnergy(points, cumulative, profile);
  const readiness = readinessFactor(profile.sleepHours);
  const [page, setPage] = useState<0 | 1 | 2>(0);
  const LAST = 2;

  const titles = ["Zones", "Fuel & decoupling", "Fat-loss simulator"];
  const dots = [0, 1, 2].map((i) => (i === page ? "●" : "○")).join(" ");

  return (
    <View style={styles.pageRoot}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.dots}>{dots}</Text>
        <Text style={styles.title}>{titles[page]}</Text>

        {page === 0 ? (
          <>
            {readiness < 1 ? (
              <Text style={[styles.sleepNote, { color: READINESS_THEME[readinessLevel(readiness)].color }]}>
                {READINESS_THEME[readinessLevel(readiness)].icon} Low sleep ({profile.sleepHours}h) — zones eased today
              </Text>
            ) : null}

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
          </>
        ) : null}

        {page === 1 ? (
          <>
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

            <View style={styles.fuelWrap}>
              <Text style={styles.fuelTitle}>Fuel mix · fat vs carbs</Text>
              <FuelSplit fuel={fuel} />
              {energy ? (
                <>
                  <View style={styles.energyRow}>
                    <Text style={styles.energyStat}>🔥 {Math.round(energy.totalKcal)} kcal</Text>
                    <Text style={styles.energyStat}>🥑 {Math.round(energy.fatGrams)} g fat</Text>
                    <Text style={styles.energyStat}>🍞 {Math.round(energy.carbGrams)} g carbs</Text>
                  </View>
                  {energy.knownSec > 0 ? (
                    <Text style={styles.energyHint}>
                      ⚡ {(energy.fatGrams / (energy.knownSec / 60)).toFixed(2)} g/min avg · 🏔️{" "}
                      {energy.peakFatGramsPerMin.toFixed(2)} g/min peak
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.energyHint}>Set your weight in profile to see calories burned.</Text>
              )}
            </View>

            {insights.map((ins, i) => (
              <View key={i} style={[styles.insight, { borderLeftColor: SEVERITY_COLOR[ins.severity] }]}>
                <Text style={styles.insightHead}>{ins.headline}</Text>
                <Text style={styles.insightDetail}>{ins.detail}</Text>
              </View>
            ))}

            <ConclusionCard conclusion={conclusion} />
          </>
        ) : null}

        {page === 2 ? (
          <>
            <FatLossSimulator points={points} cumulative={cumulative} profile={profile} />
            <Pressable onPress={onRestart} accessibilityRole="button" accessibilityLabel="Run again" style={styles.btn}>
              <Text style={styles.btnText}>Run again</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      {page > 0 ? (
        <Pressable
          onPress={() => setPage((p) => (p - 1) as 0 | 1 | 2)}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          style={[styles.edgeArrow, styles.edgeLeft]}
        >
          <MaterialCommunityIcons name="chevron-left" size={30} color="#F1F5F9" />
        </Pressable>
      ) : null}

      {page < LAST ? (
        <Pressable
          onPress={() => setPage((p) => (p + 1) as 0 | 1 | 2)}
          accessibilityRole="button"
          accessibilityLabel="Next page"
          style={[styles.edgeArrow, styles.edgeRight]}
        >
          <MaterialCommunityIcons name="chevron-right" size={30} color="#F1F5F9" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 16, padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#F1F5F9" },
  sleepNote: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  zoneList: { gap: 6 },
  zoneRow: { flexDirection: "row", justifyContent: "space-between" },
  zoneLabel: { fontSize: 14, color: "#F1F5F9" },
  zoneValue: { fontSize: 14, color: "#94A3B8" },
  driftWrap: { alignItems: "center", gap: 6 },
  driftHint: { flexDirection: "row", alignItems: "center", gap: 6 },
  driftHintText: { fontSize: 13, color: "#94A3B8" },
  fuelWrap: { gap: 8 },
  fuelTitle: { fontSize: 14, fontWeight: "600", color: "#F1F5F9" },
  energyRow: { flexDirection: "row", gap: 16, justifyContent: "center" },
  energyStat: { fontSize: 13, fontWeight: "600", color: "#CBD5E1" },
  energyHint: { fontSize: 12, color: "#94A3B8", textAlign: "center" },
  insight: { borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 6, gap: 2 },
  insightHead: { fontSize: 15, fontWeight: "700", color: "#F1F5F9" },
  insightDetail: { fontSize: 13, color: "#94A3B8" },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: "#0E7C7B", alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  pageRoot: { flex: 1, position: "relative" },
  dots: { color: "#64748B", fontSize: 16, letterSpacing: 3, textAlign: "center" },
  edgeArrow: {
    position: "absolute",
    top: "50%",
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30,41,59,0.92)",
    borderWidth: 1,
    borderColor: "#334155",
  },
  edgeLeft: { left: 6 },
  edgeRight: { right: 6 },
});
