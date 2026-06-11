import React from "react";
import { StyleSheet, View } from "react-native";
import { type AppTheme } from "../constants/appThemes";

type AppThemeBackdropProps = {
  theme: AppTheme;
  preview?: boolean;
};

export default function AppThemeBackdrop({
  theme,
  preview = false,
}: AppThemeBackdropProps): React.ReactElement | null {
  if (theme.graphic === "none") {
    return null;
  }

  const containerStyle = preview
    ? styles.previewContainer
    : styles.screenContainer;

  if (theme.graphic === "crystal") {
    return (
      <View pointerEvents="none" style={containerStyle}>
        <View
          style={[
            styles.crystal,
            styles.crystalLarge,
            { borderBottomColor: theme.accent },
          ]}
        />
        <View
          style={[
            styles.crystal,
            styles.crystalSmall,
            { borderBottomColor: "rgba(255,255,255,0.58)" },
          ]}
        />
        <View
          style={[
            styles.glow,
            styles.glowBottom,
            { backgroundColor: theme.accent },
          ]}
        />
      </View>
    );
  }

  if (theme.graphic === "arcade") {
    return (
      <View pointerEvents="none" style={containerStyle}>
        <View style={[styles.arcadeGrid, { borderColor: theme.accent }]} />
        <View style={[styles.arcadeGrid, styles.arcadeGridOffset]} />
        <View
          style={[
            styles.glow,
            styles.glowTop,
            { backgroundColor: theme.accent },
          ]}
        />
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={containerStyle}>
      <View style={[styles.cube, styles.cubeOne, { borderColor: theme.accent }]} />
      <View style={[styles.cube, styles.cubeTwo]} />
      <View
        style={[
          styles.cube,
          styles.cubeThree,
          { backgroundColor: `${theme.accent}33` },
        ]}
      />
      <View
        style={[
          styles.glow,
          styles.glowTop,
          { backgroundColor: theme.accent },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  previewContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  cube: {
    position: "absolute",
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    transform: [{ rotate: "45deg" }, { skewX: "-12deg" }],
  },
  cubeOne: {
    width: 112,
    height: 112,
    right: -20,
    top: 26,
    opacity: 0.55,
  },
  cubeTwo: {
    width: 72,
    height: 72,
    left: 26,
    bottom: 34,
    borderColor: "rgba(255,255,255,0.34)",
    opacity: 0.45,
  },
  cubeThree: {
    width: 48,
    height: 48,
    right: 76,
    bottom: 84,
    borderColor: "rgba(255,255,255,0.22)",
    opacity: 0.55,
  },
  crystal: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderLeftWidth: 48,
    borderRightWidth: 48,
    borderBottomWidth: 112,
    opacity: 0.34,
    transform: [{ rotate: "18deg" }],
  },
  crystalLarge: {
    right: 16,
    bottom: 18,
  },
  crystalSmall: {
    left: 30,
    top: 22,
    borderLeftWidth: 30,
    borderRightWidth: 30,
    borderBottomWidth: 72,
    opacity: 0.3,
    transform: [{ rotate: "-16deg" }],
  },
  arcadeGrid: {
    position: "absolute",
    width: 180,
    height: 180,
    right: -36,
    bottom: -78,
    borderWidth: 2,
    opacity: 0.38,
    transform: [{ rotate: "45deg" }, { scaleY: 0.52 }],
  },
  arcadeGridOffset: {
    left: -72,
    top: -54,
    borderColor: "rgba(255,255,255,0.28)",
    opacity: 0.26,
  },
  glow: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    opacity: 0.12,
  },
  glowTop: {
    right: -34,
    top: -42,
  },
  glowBottom: {
    left: -54,
    bottom: -48,
  },
});
