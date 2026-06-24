import React from "react";
import { Modal, View, ScrollView, Pressable, StyleSheet } from "react-native";
import { Text, Button } from "react-native-paper";
import type { TrackPoint } from "../core/types";

export interface LoadedRoute {
  name: string;
  distanceKm: number;
  date: Date;
  points: TrackPoint[];
}

export interface RoutesPanelProps {
  visible: boolean;
  routes: LoadedRoute[];
  onClose: () => void;
  onSelect: (route: LoadedRoute) => void;
}

export function RoutesPanel({ visible, routes, onClose, onSelect }: RoutesPanelProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text variant="titleMedium" style={styles.title}>Your routes ({routes.length})</Text>

          {routes.length === 0 ? (
            <Text style={styles.empty}>No routes yet. Right-click the map → Upload GPX file(s).</Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {routes.map((route, idx) => (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                  onPress={() => onSelect(route)}
                >
                  <Text style={styles.itemName} numberOfLines={1}>{route.name}</Text>
                  <Text style={styles.itemMeta}>
                    {route.distanceKm.toFixed(1)} km · {route.date.toLocaleDateString()}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Button mode="text" onPress={onClose} style={styles.closeBtn} textColor="#94A3B8">
            Close
          </Button>
        </View>
      </View>
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
    backgroundColor: "#0F1A2E",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1E3A5F",
  },
  title: {
    color: "#F1F5F9",
    marginBottom: 12,
  },
  empty: {
    color: "#64748B",
    fontSize: 13,
    marginVertical: 16,
    textAlign: "center",
  },
  list: {
    maxHeight: 360,
    marginTop: 4,
  },
  listContent: {
    gap: 4,
  },
  item: {
    backgroundColor: "#16213A",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E3A5F",
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemName: {
    color: "#F1F5F9",
    fontWeight: "600",
    fontSize: 14,
  },
  itemMeta: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    marginTop: 10,
  },
});
