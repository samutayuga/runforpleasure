import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { ZoneDistribution } from "../core/zoneDistribution";
import type { ZoneId } from "../core/karvonen";
import { ZONE_THEME } from "./theme";

const ORDER: ZoneId[] = ["below", "zone2", "zone3", "above"];

export function ZoneBar({
  zones,
  height = 16,
  showDots = true,
}: {
  zones: ZoneDistribution;
  height?: number;
  showDots?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { height, borderRadius: height / 2 }]}>
        {ORDER.map((z) => {
          const pct = zones.pctByZone[z];
          if (pct <= 0) return null;
          return (
            <View key={z} style={{ flex: pct, backgroundColor: ZONE_THEME[z].color }}>
              <View style={styles.highlight} />
            </View>
          );
        })}
      </View>
      {showDots ? (
        <View style={styles.dots}>
          {ORDER.filter((z) => zones.pctByZone[z] > 0).map((z) => (
            <View key={z} style={styles.dotItem}>
              <View style={[styles.dot, { backgroundColor: ZONE_THEME[z].color }]} />
              <Text style={styles.dotText}>
                {ZONE_THEME[z].icon} {ZONE_THEME[z].label} {Math.round(zones.pctByZone[z])}%
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 8 },
  bar: { flexDirection: "row", overflow: "hidden", backgroundColor: "#1E293B" },
  highlight: { height: "40%", backgroundColor: "rgba(255,255,255,0.12)" },
  dots: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  dotItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotText: { fontSize: 11, color: "#94A3B8" },
});
