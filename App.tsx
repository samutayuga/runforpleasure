import "./global.css";
import React, { useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { PaperProvider, MD3DarkTheme } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RunScreen } from "./src/ui/RunScreen";
import { ProfileScreen } from "./src/ui/ProfileScreen";
import type { Profile } from "./src/core/karvonen";

export default function App(): React.JSX.Element {
  const [profile, setProfile] = useState<Profile>({ age: 35, restingHr: 60 });
  const [editing, setEditing] = useState(true);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={MD3DarkTheme}>
        <SafeAreaView style={styles.root}>
          <StatusBar style="auto" />
          {editing ? (
            <ProfileScreen profile={profile} onChange={setProfile} onDone={() => setEditing(false)} />
          ) : (
            <RunScreen profile={profile} />
          )}
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
});
