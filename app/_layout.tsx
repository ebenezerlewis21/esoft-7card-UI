import { Slot, usePathname, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LaunchIntro from "../components/LaunchIntro";
import { isAuthenticatedSession } from "../constants/auth";

const PUBLIC_PATHS = new Set(["/", "/login"]);

export default function RootLayout(): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const [authCheckPending, setAuthCheckPending] = React.useState(true);
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [showLaunchIntro, setShowLaunchIntro] = React.useState(true);
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  const hasMounted = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;

    const guardRoute = async (): Promise<void> => {
      if (PUBLIC_PATHS.has(pathname)) {
        setAuthCheckPending(false);
        return;
      }

      setAuthCheckPending(true);
      const authenticated = await isAuthenticatedSession();
      if (cancelled) return;

      if (!authenticated) {
        setAuthCheckPending(false);
        router.replace("/login");
        return;
      }

      setAuthCheckPending(false);
    };

    void guardRoute();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  React.useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    setShowOverlay(true);
    overlayOpacity.stopAnimation();
    overlayOpacity.setValue(0);

    Animated.sequence([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.delay(140),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowOverlay(false);
      }
    });
  }, [overlayOpacity, pathname]);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        {authCheckPending && !PUBLIC_PATHS.has(pathname) ? (
          <View style={styles.authLoading}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        ) : (
          <Slot />
        )}
        {showOverlay ? (
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
            <ActivityIndicator size="large" color="#ffffff" />
          </Animated.View>
        ) : null}
        {showLaunchIntro ? (
          <LaunchIntro onFinish={() => setShowLaunchIntro(false)} />
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  authLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d1320",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 12, 20, 0.35)",
  },
});
