import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
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
      <Text style={styles.title}>Your profile</Text>

      <Field
        label="Age"
        value={profile.age}
        onChangeNumber={(n) => onChange({ ...profile, age: n })}
      />
      <Field
        label="Resting HR (bpm)"
        value={profile.restingHr}
        onChangeNumber={(n) => onChange({ ...profile, restingHr: n })}
      />

      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Done"
        style={styles.done}
      >
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeNumber,
}: {
  label: string;
  value: number;
  onChangeNumber: (n: number) => void;
}): React.JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType="number-pad"
        value={String(value)}
        onChangeText={(t) => onChangeNumber(Number(t) || 0)}
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 16, padding: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  field: { gap: 4 },
  label: { fontSize: 14, color: "#6B7280" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 10, padding: 12, fontSize: 18 },
  done: { minHeight: 48, borderRadius: 12, backgroundColor: "#0E7C7B", alignItems: "center", justifyContent: "center" },
  doneText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
