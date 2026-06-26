import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { FuelSplit as FuelSplitData } from "../core/fuel";
import { FUEL_THEME } from "./theme";

export function FuelSplit({
  fuel,
  height = 18,
}: {
  fuel: FuelSplitData;
  height?: number;
}): React.JSX.Element {
  if (fuel.knownSec <= 0) {
    return <Text style={styles.empty}>Fuel mix needs heart-rate data.</Text>;
  }

  const fat = Math.round(fuel.fatPct);
  const carb = Math.round(fuel.carbPct);

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { height, borderRadius: height / 2 }]}>
        {fuel.fatPct > 0 ? (
          <View style={{ flex: fuel.fatPct, backgroundColor: FUEL_THEME.fat.color }}>
            <View style={styles.highlight} />
          </View>
        ) : null}
        {fuel.carbPct > 0 ? (
          <View style={{ flex: fuel.carbPct, backgroundColor: FUEL_THEME.carb.color }}>
            <View style={styles.highlight} />
          </View>
        ) : null}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>
          {FUEL_THEME.fat.icon} {FUEL_THEME.fat.label} {fat}%
        </Text>
        <Text style={styles.legendText}>
          {FUEL_THEME.carb.icon} {FUEL_THEME.carb.label} {carb}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 8 },
  bar: { flexDirection: "row", overflow: "hidden", backgroundColor: "#1E293B" },
  highlight: { height: "40%", backgroundColor: "rgba(255,255,255,0.12)" },
  legend: { flexDirection: "row", gap: 16, justifyContent: "center" },
  legendText: { fontSize: 12, color: "#94A3B8" },
  empty: { fontSize: 13, color: "#94A3B8", textAlign: "center" },
});
