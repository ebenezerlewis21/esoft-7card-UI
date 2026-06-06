import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text3D from "../components/Text3D";

export default function UnderConstructionScreen(): React.ReactElement {
  const router = useRouter();

  React.useEffect(() => {
    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );

    return () => {
      void ScreenOrientation.unlockAsync();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.panel}>
        <Text3D style={styles.title}>Under Construction</Text3D>
        <Text3D style={styles.subtitle}>This game mode is coming soon.</Text3D>

        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.85}
          onPress={() => router.replace("/lobby")}
        >
          <Text3D style={styles.buttonText}>Back to Lobby</Text3D>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a5c2e",
    padding: 20,
  },
  panel: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: "#f6d43a",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "bold",
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 14,
  },
  button: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#f6d43a",
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#1a1a2e",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.4,
  },
});
