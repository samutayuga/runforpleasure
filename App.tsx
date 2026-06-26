import "./global.css";
import React, { useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RunScreen } from "./src/ui/RunScreen";
import { ProfileScreen } from "./src/ui/ProfileScreen";
import { paperTheme } from "./src/ui/paperTheme";
import type { Profile } from "./src/core/karvonen";

export default function App(): React.JSX.Element {
  const [profile, setProfile] = useState<Profile>({ age: 35, restingHr: 60, sleepHours: 8 });
  const [editing, setEditing] = useState(true);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <SafeAreaView style={styles.root}>
            <StatusBar style="light" />
            {editing ? (
              <ProfileScreen profile={profile} onChange={setProfile} onDone={() => setEditing(false)} />
            ) : (
              <RunScreen profile={profile} />
            )}
          </SafeAreaView>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B1220" },
});
