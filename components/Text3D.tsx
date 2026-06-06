import React, { useEffect, useRef } from "react";
import { Animated, StyleProp, TextStyle } from "react-native";

type Text3DProps = {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  animate?: boolean;
};

export default function Text3D({
  children,
  style,
  numberOfLines,
  animate = true,
}: Text3DProps): React.ReactElement {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [animate, pulse]);

  const baseStyle: TextStyle = {
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 2,
  };

  const animatedStyle: Animated.WithAnimatedObject<TextStyle> = {
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1.04],
        }),
      },
    ],
    ...baseStyle,
  };

  const resolvedStyle = animate ? animatedStyle : baseStyle;

  return (
    <Animated.Text style={[resolvedStyle, style]} numberOfLines={numberOfLines}>
      {children}
    </Animated.Text>
  );
}
