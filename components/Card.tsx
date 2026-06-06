import type { Card as CardType } from "@/game/logic";
import { isRed } from "@/game/logic";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Text3D from "./Text3D";

type CardProps = {
  card: CardType;
  faceDown?: boolean;
  cardBackColor?: string;
  selected?: boolean;
  zeroed?: boolean;
  highlighted?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  size?: "normal" | "small" | "large";
  cardWidth?: number;
  cardHeight?: number;
  rotateZ?: string;
  liftAmount?: number;
};

export default function Card({
  card,
  faceDown = false,
  cardBackColor = "#1a3a8f",
  selected = false,
  zeroed = false,
  highlighted = false,
  disabled = false,
  onPress,
  size = "normal",
  cardWidth,
  cardHeight,
  rotateZ = "0deg",
  liftAmount = 0,
}: CardProps): React.ReactElement {
  const liftAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const idleAnim = useRef(new Animated.Value(0)).current;
  const bounceLoop = useRef<Animated.CompositeAnimation | null>(null);
  const idleLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (selected) {
      Animated.spring(liftAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }).start();

      bounceLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.08,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.12,
            duration: 140,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.06,
            duration: 140,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.08,
            duration: 120,
            useNativeDriver: true,
          }),
        ]),
      );
      bounceLoop.current.start();
    } else {
      Animated.spring(liftAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }).start();

      if (bounceLoop.current) {
        bounceLoop.current.stop();
        bounceLoop.current = null;
      }
      scaleAnim.setValue(1);
    }
  }, [selected, liftAnim, scaleAnim]);

  useEffect(() => {
    if (highlighted && !faceDown) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 700,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    } else {
      glowAnim.setValue(0);
    }
  }, [highlighted, faceDown, glowAnim]);

  useEffect(() => {
    const shouldIdleAnimate = !selected && !disabled;

    if (shouldIdleAnimate) {
      idleLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(idleAnim, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(idleAnim, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),
      );
      idleLoop.current.start();
    } else {
      if (idleLoop.current) {
        idleLoop.current.stop();
        idleLoop.current = null;
      }
      idleAnim.setValue(0);
    }

    return () => {
      if (idleLoop.current) {
        idleLoop.current.stop();
        idleLoop.current = null;
      }
    };
  }, [disabled, idleAnim, selected]);

  const translateY = liftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [liftAmount, liftAmount - 10],
  });
  const idleLift = idleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });
  const idleRotateX = idleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-4deg", "-6deg"],
  });
  const idleRotateY = idleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["3deg", "5deg"],
  });
  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(68,170,238,0.4)", "rgba(68,170,238,1)"],
  });

  const cardTransform = [
    { perspective: 700 },
    { translateY: Animated.add(translateY, idleLift) },
    { scale: scaleAnim },
    { rotateZ },
    { rotateX: selected ? "-8deg" : idleRotateX },
    { rotateY: selected ? "7deg" : idleRotateY },
  ];

  const baseDims =
    size === "small"
      ? { width: 38, height: 56 }
      : size === "large"
        ? { width: 60, height: 88 }
        : { width: 48, height: 70 };

  const dims = {
    width: cardWidth ?? baseDims.width,
    height: cardHeight ?? baseDims.height,
  };

  const fontSize = size === "small" ? 9 : size === "large" ? 13 : 11;
  const suitSize = size === "small" ? 14 : size === "large" ? 22 : 18;

  if (faceDown) {
    return (
      <Animated.View style={{ transform: cardTransform }}>
        <View
          style={[
            styles.cardBase,
            dims,
            styles.faceDown,
            { backgroundColor: cardBackColor },
            disabled && styles.disabled,
          ]}
        >
          <View style={styles.faceDownPattern} />
          <View style={styles.cardEdge} />
        </View>
      </Animated.View>
    );
  }

  const red = isRed(card.suit);
  const textColor = red ? "#c0392b" : "#1a1a2e";
  const isFaceCard =
    card.rank === "J" || card.rank === "Q" || card.rank === "K";
  const suitCode =
    card.suit === "♥"
      ? "H"
      : card.suit === "♦"
        ? "D"
        : card.suit === "♣"
          ? "C"
          : "S";
  const faceCardImageUri = isFaceCard
    ? `https://deckofcardsapi.com/static/img/${card.rank}${suitCode}.png`
    : undefined;

  const borderStyle = selected
    ? {
        borderColor: "#ffffff",
        borderWidth: 3.5,
        shadowColor: "#ffffff",
        shadowOpacity: 0.9,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        elevation: 12,
      }
    : zeroed
      ? { borderColor: "#4ae", borderWidth: 2 }
      : { borderColor: "rgba(0,0,0,0.15)", borderWidth: 1 };

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        selected && styles.cardWrapperSelected,
        { transform: cardTransform },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || !onPress}
        activeOpacity={0.85}
      >
        <Animated.View
          style={[
            styles.cardBase,
            dims,
            styles.faceUp,
            borderStyle,
            zeroed && highlighted && { borderColor, borderWidth: 2 },
            disabled && !selected && styles.disabled,
          ]}
        >
          <View style={styles.cardEdge} />
          <View style={styles.cornerTop}>
            <Text3D style={[styles.rankText, { color: textColor, fontSize }]}>
              {card.rank}
            </Text3D>
            <Text3D
              style={[
                styles.suitSmall,
                { color: textColor, fontSize: fontSize - 1 },
              ]}
            >
              {card.suit}
            </Text3D>
          </View>

          {isFaceCard && (
            <Image
              source={{ uri: faceCardImageUri }}
              style={styles.faceCardImage}
              resizeMode="cover"
            />
          )}

          {!isFaceCard && (
            <Text3D
              style={[
                styles.centerSuit,
                { color: textColor, fontSize: suitSize },
              ]}
            >
              {card.suit}
            </Text3D>
          )}

          <View style={styles.cornerBottom}>
            <Text3D
              style={[
                styles.rankText,
                {
                  color: textColor,
                  fontSize,
                  transform: [{ rotate: "180deg" }],
                },
              ]}
            >
              {card.rank}
            </Text3D>
            <Text3D
              style={[
                styles.suitSmall,
                {
                  color: textColor,
                  fontSize: fontSize - 1,
                  transform: [{ rotate: "180deg" }],
                },
              ]}
            >
              {card.suit}
            </Text3D>
          </View>

          {zeroed && (
            <View style={styles.zeroBadge}>
              <Text3D style={styles.zeroBadgeText}>0</Text3D>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardBase: {
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
  },
  faceUp: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
    overflow: "hidden",
  },
  faceDown: {
    backgroundColor: "#1a3a8f",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
    overflow: "hidden",
  },
  faceDownPattern: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
  },
  disabled: {
    opacity: 0.65,
  },
  cornerTop: {
    position: "absolute",
    top: 3,
    left: 4,
    alignItems: "center",
  },
  cornerBottom: {
    position: "absolute",
    bottom: 3,
    right: 4,
    alignItems: "center",
  },
  rankText: {
    fontWeight: "bold",
    lineHeight: 13,
  },
  suitSmall: {
    lineHeight: 11,
  },
  centerSuit: {
    fontWeight: "400",
  },
  zeroBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#4ae",
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  zeroBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "bold",
  },
  faceCardGraphic: {
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    padding: 4,
    marginTop: 4,
  },
  faceCardGraphicRed: {
    backgroundColor: "rgba(192,57,43,0.1)",
  },
  faceCardGraphicBlack: {
    backgroundColor: "rgba(26,26,46,0.08)",
  },
  faceCardIcon: {
    lineHeight: 1,
    textAlign: "center",
  },
  faceCardLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  faceCardLabel: {
    fontWeight: "bold",
    fontSize: 10,
    lineHeight: 14,
    marginHorizontal: 2,
  },
  faceCardImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 7,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  cardWrapper: {
    overflow: "visible",
  },
  cardWrapperSelected: {
    elevation: 16,
    shadowColor: "#ffffff",
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardEdge: {
    position: "absolute",
    right: 1,
    top: 4,
    bottom: 4,
    width: 6,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
  },
});
