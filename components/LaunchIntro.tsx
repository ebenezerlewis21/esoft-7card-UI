import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

type LaunchIntroProps = {
  onFinish: () => void;
};

export default function LaunchIntro({
  onFinish,
}: LaunchIntroProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const overlayOpacity = React.useRef(new Animated.Value(1)).current;
  const logoScale = React.useRef(new Animated.Value(0.82)).current;
  const logoOpacity = React.useRef(new Animated.Value(0)).current;
  const cardFan = React.useRef(new Animated.Value(0)).current;
  const titleRise = React.useRef(new Animated.Value(18)).current;
  const shine = React.useRef(new Animated.Value(0)).current;

  const cardGap = Math.min(width * 0.18, 64);

  React.useEffect(() => {
    const intro = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 72,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardFan, {
          toValue: 1,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleRise, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shine, {
          toValue: 1,
          duration: 880,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(8560),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    intro.start(({ finished }) => {
      if (finished) {
        onFinish();
      }
    });

    return () => {
      intro.stop();
    };
  }, [cardFan, logoOpacity, logoScale, onFinish, overlayOpacity, shine, titleRise]);

  const makeCardTransform = (index: number) => {
    const rotateOutputs = ["-15deg", "0deg", "15deg"];
    const xOutputs = [-cardGap, 0, cardGap];

    return [
      {
        translateX: cardFan.interpolate({
          inputRange: [0, 1],
          outputRange: [0, xOutputs[index]],
        }),
      },
      {
        translateY: cardFan.interpolate({
          inputRange: [0, 1],
          outputRange: [22, index === 1 ? -8 : 8],
        }),
      },
      {
        rotate: cardFan.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", rotateOutputs[index]],
        }),
      },
      {
        scale: cardFan.interpolate({
          inputRange: [0, 1],
          outputRange: [0.88, index === 1 ? 1.04 : 0.96],
        }),
      },
    ];
  };

  return (
    <Animated.View
      pointerEvents="auto"
      style={[styles.overlay, { opacity: overlayOpacity }]}
    >
      <View pointerEvents="none" style={styles.backdrop}>
        <View style={[styles.light, styles.lightTop]} />
        <View style={[styles.light, styles.lightBottom]} />
      </View>

      <Animated.View
        style={[
          styles.logoMark,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <MaterialCommunityIcons name="cards-playing" size={44} color="#fff4c4" />
      </Animated.View>

      <View style={styles.cardStage}>
        {["A", "7", "K"].map((label, index) => (
          <Animated.View
            key={label}
            style={[
              styles.playingCard,
              index === 1 ? styles.featuredCard : null,
              {
                opacity: cardFan,
                transform: makeCardTransform(index),
              },
            ]}
          >
            <Text style={styles.cardCorner}>{label}</Text>
            <MaterialCommunityIcons
              name={index === 1 ? "cards-diamond" : "cards-spade"}
              size={32}
              color={index === 1 ? "#f4c65b" : "#77d7d4"}
            />
          </Animated.View>
        ))}

        <Animated.View
          style={[
            styles.shine,
            {
              opacity: shine.interpolate({
                inputRange: [0, 0.3, 0.8, 1],
                outputRange: [0, 0.7, 0.35, 0],
              }),
              transform: [
                {
                  translateX: shine.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-140, 140],
                  }),
                },
                { rotate: "-18deg" },
              ],
            },
          ]}
        />
      </View>

      <Animated.View
        style={[
          styles.titleBlock,
          {
            opacity: logoOpacity,
            transform: [{ translateY: titleRise }],
          },
        ]}
      >
        <Text style={styles.company}>esoft</Text>
        <Text style={styles.gameTitle}>7-Card Rummy</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#090d16",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  light: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  lightTop: {
    top: -92,
    right: -76,
    backgroundColor: "rgba(244, 198, 91, 0.18)",
  },
  lightBottom: {
    left: -96,
    bottom: -84,
    backgroundColor: "rgba(82, 211, 207, 0.18)",
  },
  logoMark: {
    width: 82,
    height: 82,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 34,
    borderWidth: 1,
    borderColor: "rgba(255, 244, 196, 0.42)",
    backgroundColor: "#18243a",
    shadowColor: "#f4c65b",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 10,
  },
  cardStage: {
    width: 230,
    height: 152,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 34,
  },
  playingCard: {
    position: "absolute",
    width: 88,
    height: 124,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "#101928",
  },
  featuredCard: {
    borderColor: "rgba(244, 198, 91, 0.72)",
    backgroundColor: "#162136",
  },
  cardCorner: {
    position: "absolute",
    top: 10,
    left: 11,
    color: "#f8fbff",
    fontSize: 17,
    fontWeight: "900",
  },
  shine: {
    position: "absolute",
    width: 46,
    height: 190,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  titleBlock: {
    alignItems: "center",
  },
  company: {
    color: "#77d7d4",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  gameTitle: {
    marginTop: 8,
    color: "#ffffff",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: 0,
  },
});
