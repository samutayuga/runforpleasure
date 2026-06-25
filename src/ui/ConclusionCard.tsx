import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Conclusion } from "../core/conclusion";

const TONE_COLOR: Record<Conclusion["tone"], string> = {
  good: "#0E7C7B",
  watch: "#B45309",
  act: "#9D174D",
};

export function ConclusionCard({ conclusion }: { conclusion: Conclusion }): React.JSX.Element {
  const color = TONE_COLOR[conclusion.tone];
  const a11y = `Bottom line, grade ${conclusion.grade ?? "not available"}. ${conclusion.verdict} Next: ${conclusion.recommendation}`;

  return (
    <View style={[styles.card, { borderLeftColor: color }]} accessibilityLabel={a11y}>
      <View style={styles.head}>
        <Text style={styles.label}>BOTTOM LINE</Text>
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{conclusion.grade ?? "—"}</Text>
        </View>
      </View>
      <Text style={styles.verdict}>{conclusion.verdict}</Text>
      <Text style={styles.next}>Next: {conclusion.recommendation}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderLeftWidth: 4, backgroundColor: "#16213A", borderRadius: 10, padding: 14, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 11, fontWeight: "700", color: "#94A3B8", letterSpacing: 1 },
  badge: { minWidth: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  verdict: { fontSize: 16, fontWeight: "700", color: "#F1F5F9" },
  next: { fontSize: 13, color: "#94A3B8" },
});
