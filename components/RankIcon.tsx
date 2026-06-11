import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Text3D from "./Text3D";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type RankIconProps = {
  rank: string | null | undefined;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

type RankIconDefinition = {
  label: string;
  name: IconName;
  color: string;
};

const RANK_ICONS: Record<string, RankIconDefinition> = {
  bronze: {
    label: "Bronze",
    name: "medal",
    color: "#cd7f32",
  },
  silver: {
    label: "Silver",
    name: "medal",
    color: "#cfd6df",
  },
  gold: {
    label: "Gold",
    name: "medal",
    color: "#f6d43a",
  },
  diamond: {
    label: "Diamond",
    name: "diamond-stone",
    color: "#62d8ff",
  },
  platinum: {
    label: "Platinum",
    name: "trophy-award",
    color: "#dfe8f3",
  },
};

const normalizeRank = (rank: string | null | undefined): string =>
  rank?.trim().toLowerCase() ?? "";

export default function RankIcon({
  rank,
  size = 24,
  style,
}: RankIconProps): React.ReactElement {
  const rankIcon = RANK_ICONS[normalizeRank(rank)];

  if (!rankIcon) {
    return (
      <View
        style={[styles.container, { width: size + 10, height: size + 10 }, style]}
        accessibilityRole="image"
        accessibilityLabel="Unranked"
      >
        <Text3D style={[styles.unrankedText, { fontSize: size }]}>-</Text3D>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { width: size + 10, height: size + 10 }, style]}
      accessibilityRole="image"
      accessibilityLabel={rankIcon.label}
    >
      <MaterialCommunityIcons
        name={rankIcon.name}
        size={size}
        color={rankIcon.color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  unrankedText: {
    color: "#ffffff",
    fontWeight: "900",
    lineHeight: 28,
    textAlign: "center",
  },
});
