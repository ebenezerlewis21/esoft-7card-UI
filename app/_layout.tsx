import { Slot } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
