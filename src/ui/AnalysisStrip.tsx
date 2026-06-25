import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { Decoupling } from "../core/decoupling";
import type { ZoneId } from "../core/karvonen";
import { ZONE_THEME } from "./theme";

const ORDER: ZoneId[] = ["below", "zone2", "zone3", "above"];

export function AnalysisStrip({
  zones,
  decoupling,
  onInfo,
}: {
  zones: ZoneDistribution;
  decoupling: Decoupling;
  onInfo?: () => void;
}): React.JSX.Element {
  const drift =
    decoupling.pct === null
      ? "—"
      : `${decoupling.pct >= 0 ? "+" : ""}${Math.round(decoupling.pct)}%`;

  return (
    <Pressable
      style={styles.wrap}
      onPress={onInfo}
      accessibilityRole="button"
      accessibilityLabel="What do these mean?"
    >
      <View style={styles.bar}>
        {ORDER.map((z) => {
          const pct = zones.pctByZone[z];
          if (pct <= 0) return null;
          return (
            <View key={z} style={{ flex: pct, backgroundColor: ZONE_THEME[z].color }} />
          );
        })}
      </View>
      <View style={styles.legend}>
        {ORDER.filter((z) => zones.pctByZone[z] > 0).map((z) => (
          <Text key={z} style={styles.legendItem}>
            {ZONE_THEME[z].icon} {ZONE_THEME[z].label} {Math.round(zones.pctByZone[z])}%
          </Text>
        ))}
      </View>
      <View style={styles.driftRow}>
        <Text style={styles.drift}>Drift {drift}</Text>
        <MaterialCommunityIcons name="information-outline" size={14} color="#94A3B8" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 6 },
  bar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: "#1E293B" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  legendItem: { fontSize: 11, color: "#94A3B8" },
  drift: { fontSize: 13, color: "#94A3B8", textAlign: "center", fontWeight: "600" },
  driftRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
});
