import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, TextInput, Button } from "react-native-paper";
import type { Profile } from "../core/karvonen";

export function ProfileScreen({
  profile,
  onChange,
  onDone,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onDone: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <Text variant="headlineSmall" style={styles.title}>Your profile</Text>

      <TextInput
        label="Age"
        mode="outlined"
        keyboardType="number-pad"
        value={String(profile.age)}
        onChangeText={(t) => onChange({ ...profile, age: Number(t) || 0 })}
        accessibilityLabel="Age"
      />
      <TextInput
        label="Resting HR (bpm)"
        mode="outlined"
        keyboardType="number-pad"
        value={String(profile.restingHr)}
        onChangeText={(t) => onChange({ ...profile, restingHr: Number(t) || 0 })}
        accessibilityLabel="Resting HR (bpm)"
      />

      <Button
        mode="contained"
        onPress={onDone}
        accessibilityLabel="Done"
        style={styles.doneButton}
      >
        Done
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", gap: 16, padding: 16, justifyContent: "center", backgroundColor: "#0B1220" },
  title: { color: "#F1F5F9" },
  doneButton: { marginTop: 8 },
});
