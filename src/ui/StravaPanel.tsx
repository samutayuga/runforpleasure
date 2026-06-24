import React, { useState } from "react";
import { Modal, View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Text, TextInput, Button } from "react-native-paper";
import { fetchActivities, fetchActivityTrack } from "./strava";
import type { StravaActivity } from "./strava";
import type { TrackPoint } from "../core/types";

export interface StravaPanelProps {
  visible: boolean;
  onClose: () => void;
  onSelectTrack: (name: string, points: TrackPoint[]) => void;
}

function getStoredToken(): string {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("strava_token") ?? "";
  }
  return "";
}

function saveToken(token: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("strava_token", token);
  }
}

export function StravaPanel({ visible, onClose, onSelectTrack }: StravaPanelProps): React.JSX.Element {
  const [token, setToken] = useState<string>(getStoredToken);
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingTrack, setLoadingTrack] = useState<number | null>(null);

  const handleLoadActivities = async () => {
    setError(null);
    setActivities([]);
    setLoading(true);
    try {
      saveToken(token);
      const list = await fetchActivities(token);
      setActivities(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectActivity = async (activity: StravaActivity) => {
    setError(null);
    setLoadingTrack(activity.id);
    try {
      const points = await fetchActivityTrack(token, activity);
      onSelectTrack(activity.name, points);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoadingTrack(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text variant="titleMedium" style={styles.title}>Load from Strava</Text>

          <TextInput
            mode="outlined"
            label="Strava access token"
            value={token}
            onChangeText={setToken}
            secureTextEntry
            style={styles.input}
            outlineColor="#334155"
            activeOutlineColor="#3B82F6"
            textColor="#F1F5F9"
            theme={{ colors: { onSurfaceVariant: "#94A3B8", background: "#0F1A2E" } }}
          />

          <Button
            mode="contained"
            onPress={() => { void handleLoadActivities(); }}
            style={styles.loadBtn}
            disabled={loading || !token.trim()}
          >
            Load activities
          </Button>

          {loading && <ActivityIndicator color="#3B82F6" style={styles.spinner} />}

          {error !== null && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {activities.length > 0 && (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {activities.map((a) => (
                <Pressable
                  key={a.id}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                  onPress={() => { void handleSelectActivity(a); }}
                  disabled={loadingTrack !== null}
                >
                  <View style={styles.itemRow}>
                    <Text style={styles.itemName} numberOfLines={1}>{a.name}</Text>
                    {loadingTrack === a.id && <ActivityIndicator size="small" color="#3B82F6" />}
                  </View>
                  <Text style={styles.itemMeta}>
                    {a.type} · {(a.distance / 1000).toFixed(1)} km · {new Date(a.start_date).toLocaleDateString()}
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
  input: {
    backgroundColor: "#0B1220",
    marginBottom: 10,
  },
  loadBtn: {
    marginBottom: 8,
  },
  spinner: {
    marginVertical: 8,
  },
  errorText: {
    color: "#FCA5A5",
    marginVertical: 8,
    fontSize: 13,
  },
  list: {
    maxHeight: 320,
    marginTop: 8,
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
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    color: "#F1F5F9",
    fontWeight: "600",
    fontSize: 14,
    flex: 1,
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
