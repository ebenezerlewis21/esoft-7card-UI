import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppThemeBackdrop from "../components/AppThemeBackdrop";
import RankIcon from "../components/RankIcon";
import Text3D from "../components/Text3D";
import {
  appThemeFromShopItem,
  getActiveAppTheme,
  initializeAppThemeSettings,
  setActiveAppTheme,
  subscribeAppThemeSettings,
} from "../constants/appThemes";
import { getCurrentUserShopInventoryFromBackend } from "../constants/auth";

export default function InfoScreen(): React.ReactElement {
  const router = useRouter();
  const [appTheme, setAppTheme] = React.useState(getActiveAppTheme());

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
        <Text3D style={styles.title}>How To Play</Text3D>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text3D style={styles.sectionTitle}>Game Rules</Text3D>
          <Text3D style={styles.bodyText}>
            Build the lowest 7-card hand score you can. Lower cards are better,
            and you should avoid pairs or repeats when possible.
          </Text3D>
          <Text3D style={styles.bodyText}>
            When points are counted, no card value can exceed 10. J, Q, and K
            all count as 10 points each.
          </Text3D>
          <Text3D style={styles.bodyText}>
            On your turn, draw from deck or discard, then choose one card to
            keep and one card to discard.
          </Text3D>
          <Text3D style={styles.bodyText}>
            A round ends when someone stops. Scores are compared and the lowest
            total wins the round.
          </Text3D>

          <Text3D style={styles.sectionTitle}>Reduce Points With Combos</Text3D>
          <Text3D style={styles.bodyText}>
            Three or more cards of the same rank score 0 points together. For
            example, three 7s or four Kings can cancel out those cards.
          </Text3D>
          <Text3D style={styles.bodyText}>
            Three or more cards of the same suit can also score 0 if they form a
            sequence. That works for both low runs like A-2-3 and high runs like
            Q-K-A.
          </Text3D>
          <Text3D style={styles.bodyText}>
            The game automatically keeps the best non-overlapping combinations,
            so the more matching cards and runs you build, the lower your hand
            score becomes.
          </Text3D>

          <Text3D style={styles.sectionTitle}>Stats Explained</Text3D>
          <Text3D style={styles.bodyText}>
            Games Played: Total finished matches.
          </Text3D>
          <Text3D style={styles.bodyText}>
            Win Ratio: Percent of matches won.
          </Text3D>
          <Text3D style={styles.bodyText}>
            Ranked: Your current competitive tier.
          </Text3D>
          <View style={styles.rankIconRow}>
            {["Unranked", "Bronze", "Silver", "Gold", "Diamond", "Platinum"].map(
              (rank) => (
                <RankIcon key={rank} rank={rank} size={22} />
              ),
            )}
          </View>
          <Text3D style={styles.bodyText}>
            Each tier holds 100 players. If a tier is full and you move up, you
            replace the lowest-ranked player in that tier and they move down.
          </Text3D>

          <View style={styles.coinRow}>
            <MaterialCommunityIcons
              name="diamond-stone"
              size={16}
              color="#f6d43a"
            />
            <Text3D style={styles.bodyText}>
              Coins: Currency earned from wins and performance. Coins are not
              earned when playing against the computer.
            </Text3D>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.85}
          onPress={() => router.back()}
        >
          <Text3D style={styles.buttonText}>Back</Text3D>
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
    maxWidth: 440,
    maxHeight: "92%",
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.30)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  title: {
    color: "#f6d43a",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 14,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 8,
  },
  sectionTitle: {
    color: "#fdf0b4",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    marginTop: 4,
  },
  bodyText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    lineHeight: 21,
  },
  coinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rankIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  button: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: "#f6d43a",
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#1a1a2e",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
