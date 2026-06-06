import type { Card as CardType } from "@/game/logic";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import Card from "./Card";

type AnimatedCardProps = {
  card: CardType;
  faceDown?: boolean;
  cardBackColor?: string;
  rotateZ?: string;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  duration: number;
  onComplete?: () => void;
};

export default function AnimatedCard({
  card,
  faceDown = false,
  cardBackColor = "#1a3a8f",
  rotateZ = "0deg",
  fromPosition,
  toPosition,
  duration,
  onComplete,
}: AnimatedCardProps): React.ReactElement {
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateXAnim, {
        toValue: toPosition.x - fromPosition.x,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: toPosition.y - fromPosition.y,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.7,
        duration,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete?.();
    });
  }, [
    duration,
    fromPosition.x,
    fromPosition.y,
    onComplete,
    opacityAnim,
    scaleAnim,
    toPosition.x,
    toPosition.y,
    translateXAnim,
    translateYAnim,
  ]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: fromPosition.y,
          left: fromPosition.x,
          transform: [
            { translateX: translateXAnim },
            { translateY: translateYAnim },
            { scale: scaleAnim },
            { rotateZ },
          ],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      <Card
        card={card}
        size="large"
        faceDown={faceDown}
        cardBackColor={cardBackColor}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
  },
});
