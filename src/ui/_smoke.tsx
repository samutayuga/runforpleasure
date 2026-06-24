import React from "react";
import { View, Text } from "react-native";
import { Surface } from "react-native-paper";

// Toolchain smoke: NativeWind className + Paper Surface must compile & render.
export function StyleSmoke(): React.JSX.Element {
  return (
    <Surface>
      <View className="p-4 bg-orange-500 rounded-xl">
        <Text className="text-white font-bold">nativewind+paper ok</Text>
      </View>
    </Surface>
  );
}
