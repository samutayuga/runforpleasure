import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { Decoupling } from "../core/decoupling";
import { DriftGauge } from "./DriftGauge";

export function AnalysisStrip({
  decoupling,
  onInfo,
}: {
  zones: ZoneDistribution;
  decoupling: Decoupling;
  onInfo?: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={styles.wrap}
      onPress={onInfo}
      accessibilityRole="button"
      accessibilityLabel="Drift — what does this mean?"
    >
      <View style={styles.driftRow}>
        <DriftGauge decoupling={decoupling} size={64} />
        <MaterialCommunityIcons name="information-outline" size={14} color="#94A3B8" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 8, alignItems: "center" },
  driftRow: { flexDirection: "row", alignItems: "center", gap: 6 },
});
