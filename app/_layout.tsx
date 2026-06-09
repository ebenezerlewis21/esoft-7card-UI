import { Slot, usePathname } from "expo-router";
import React from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout(): React.ReactElement {
  const pathname = usePathname();
  const [showOverlay, setShowOverlay] = React.useState(false);
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  const hasMounted = React.useRef(false);

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
        <Slot />
        {showOverlay ? (
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
            <ActivityIndicator size="large" color="#ffffff" />
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 12, 20, 0.35)",
  },
});
