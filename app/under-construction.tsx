import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppThemeBackdrop from "../components/AppThemeBackdrop";
import Text3D from "../components/Text3D";
import {
    appThemeFromShopItem,
    getActiveAppTheme,
    initializeAppThemeSettings,
    setActiveAppTheme,
    subscribeAppThemeSettings,
} from "../constants/appThemes";
import { getCurrentUserShopInventoryFromBackend } from "../constants/auth";
import { Feature } from "../constants/features";

export default function UnderConstructionScreen(): React.ReactElement {
  const router = useRouter();
  const [appTheme, setAppTheme] = React.useState(getActiveAppTheme());
  const title = Feature.multiMode.enabled
    ? "Under Construction"
    : "Coming Soon";

  const handleGoBack = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/");
  }, [router]);

  React.useEffect(() => {
    const unsubscribeAppTheme = subscribeAppThemeSettings(() => {
      setAppTheme(getActiveAppTheme());
    });

    void initializeAppThemeSettings();

    void (async () => {
      const inventory = await getCurrentUserShopInventoryFromBackend();
      const equippedTheme = inventory?.find(
        (item) => item.type === "GAME_THEME" && item.equipped,
      );
      const theme = equippedTheme ? appThemeFromShopItem(equippedTheme) : null;
      if (theme) {
        setActiveAppTheme(theme);
        setAppTheme(theme);
      }
    })();

    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );

    return () => {
      unsubscribeAppTheme();
      void ScreenOrientation.unlockAsync();
    };
  }, []);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: appTheme.colors.screenBackground },
      ]}
    >
      <AppThemeBackdrop theme={appTheme} />
      <View
        style={[
          styles.panel,
          { backgroundColor: appTheme.colors.panelBackground },
        ]}
      >
        <Text3D style={styles.title}>{title}</Text3D>
        <Text3D style={styles.subtitle}>This game mode is coming soon.</Text3D>

        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.85}
          onPress={handleGoBack}
        >
          <Text3D style={styles.buttonText}>Go Back</Text3D>
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
