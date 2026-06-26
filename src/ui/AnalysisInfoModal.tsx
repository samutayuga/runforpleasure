import React from "react";
import { Modal, View, ScrollView, Pressable, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { DRIFT_INTRO, ZONE_INFO, DRIFT_BANDS, FUEL_INTRO } from "../core/glossary";
import type { DecouplingRating } from "../core/decoupling";
import { ZONE_THEME } from "./theme";

const RATING_COLOR: Record<DecouplingRating, string> = {
  good: "#0E7C7B",
  moderate: "#B45309",
  high: "#9D174D",
};

export function AnalysisInfoModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* stop backdrop press from closing when tapping the panel body */}
        <Pressable style={styles.panel} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>Understanding your run</Text>

            <Text style={styles.heading}>Drift — aerobic decoupling</Text>
            <Text style={styles.intro}>{DRIFT_INTRO}</Text>
            {DRIFT_BANDS.map((b) => (
              <View key={b.rating} style={styles.row}>
                <View style={[styles.chip, { backgroundColor: RATING_COLOR[b.rating] }]}>
                  <Text style={styles.chipText}>{b.range}</Text>
                </View>
                <Text style={styles.rowText}>{b.meaning}</Text>
              </View>
            ))}

            <Text style={styles.heading}>Heart-rate zones & fuel</Text>
            {ZONE_INFO.map((z) => (
              <View key={z.id} style={styles.zoneRow}>
                <View style={styles.zoneHead}>
                  <View style={[styles.dot, { backgroundColor: ZONE_THEME[z.id].color }]} />
                  <Text style={styles.zoneLabel}>
                    {ZONE_THEME[z.id].icon} {z.label}
                  </Text>
                  <Text style={styles.zoneRange}>{z.range}</Text>
                </View>
                <Text style={styles.zoneFuel}>Fuel: {z.fuel}</Text>
                <Text style={styles.zoneMeaning}>{z.meaning}</Text>
              </View>
            ))}

            <Text style={styles.heading}>Fuel mix — fat vs carbs</Text>
            <Text style={styles.intro}>{FUEL_INTRO}</Text>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Got it"
              style={styles.btn}
            >
              <Text style={styles.btnText}>Got it</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  panel: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "85%",
    backgroundColor: "#16213A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  scroll: { padding: 20, gap: 10 },
  title: { fontSize: 22, fontWeight: "700", color: "#F1F5F9", marginBottom: 4 },
  heading: { fontSize: 16, fontWeight: "700", color: "#F1F5F9", marginTop: 10 },
  intro: { fontSize: 13, color: "#94A3B8", lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  chip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, minWidth: 56, alignItems: "center" },
  chipText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  rowText: { flex: 1, fontSize: 13, color: "#94A3B8" },
  zoneRow: { gap: 2, paddingVertical: 4 },
  zoneHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  zoneLabel: { fontSize: 14, fontWeight: "600", color: "#F1F5F9" },
  zoneRange: { fontSize: 12, color: "#94A3B8", marginLeft: "auto" },
  zoneFuel: { fontSize: 13, color: "#F1F5F9", fontWeight: "600" },
  zoneMeaning: { fontSize: 13, color: "#94A3B8" },
  btn: { marginTop: 16, minHeight: 48, borderRadius: 12, backgroundColor: "#0E7C7B", alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
