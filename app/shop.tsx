import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text3D from "../components/Text3D";
import {
  getCurrentUserProfile,
  spendCurrentUserCoins,
} from "../constants/auth";
import {
  BACKGROUNDS,
  type BackgroundDefinition,
  type BackgroundId,
} from "../constants/backgrounds";
import {
  CARD_BACKS,
  type CardBackDefinition,
  type CardBackId,
} from "../constants/cardbacks";
import {
  getActiveBackgroundId,
  getActiveCardBackId,
  getOwnedBackgroundIds,
  getOwnedCardBackIds,
  initializeProfileSettings,
  setActiveBackgroundId,
  setActiveCardBackId,
  subscribeBackgroundSettings,
  subscribeCardBackSettings,
  unlockBackground,
  unlockCardBack,
} from "../constants/settings";

export default function ShopScreen(): React.ReactElement {
  const router = useRouter();
  const [coins, setCoins] = React.useState(0);
  const [ownedIds, setOwnedIds] = React.useState(
    () => new Set<BackgroundId>(getOwnedBackgroundIds()),
  );
  const [activeBackgroundId, setActiveBackgroundIdState] = React.useState(
    getActiveBackgroundId(),
  );
  const [ownedCardBackIds, setOwnedCardBackIds] = React.useState(
    () => new Set<CardBackId>(getOwnedCardBackIds()),
  );
  const [activeCardBackId, setActiveCardBackIdState] = React.useState(
    getActiveCardBackId(),
  );

  React.useEffect(() => {
    let cancelled = false;

    const loadCurrentProfileCoins = async (): Promise<void> => {
      const profile = await getCurrentUserProfile();
      if (cancelled) return;
      setCoins(profile?.coins ?? 0);
    };

    void loadCurrentProfileCoins();

    const unsubscribeBackgrounds = subscribeBackgroundSettings(() => {
      setOwnedIds(new Set<BackgroundId>(getOwnedBackgroundIds()));
      setActiveBackgroundIdState(getActiveBackgroundId());
    });

    const unsubscribeCardBacks = subscribeCardBackSettings(() => {
      setOwnedCardBackIds(new Set<CardBackId>(getOwnedCardBackIds()));
      setActiveCardBackIdState(getActiveCardBackId());
    });

    void initializeProfileSettings();

    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );

    return () => {
      cancelled = true;
      unsubscribeBackgrounds();
      unsubscribeCardBacks();
      void ScreenOrientation.unlockAsync();
    };
  }, []);

  const buyBackground = async (item: BackgroundDefinition): Promise<void> => {
    if (ownedIds.has(item.id) || coins < item.cost) return;

    const nextCoins = await spendCurrentUserCoins(item.cost);
    if (nextCoins == null) return;

    setCoins(nextCoins);

    unlockBackground(item.id as BackgroundId);
  };

  const equipBackground = (backgroundId: BackgroundId): void => {
    setActiveBackgroundId(backgroundId);
  };

  const buyCardBack = async (item: CardBackDefinition): Promise<void> => {
    if (ownedCardBackIds.has(item.id) || coins < item.cost) return;

    const nextCoins = await spendCurrentUserCoins(item.cost);
    if (nextCoins == null) return;

    setCoins(nextCoins);

    unlockCardBack(item.id);
  };

  const equipCardBack = (cardBackId: CardBackId): void => {
    setActiveCardBackId(cardBackId);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.85}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <Text3D style={styles.title}>Shop</Text3D>
          <Text3D style={styles.subtitle}>Buy gameboards with coins</Text3D>
        </View>

        <View style={styles.coinPill}>
          <MaterialCommunityIcons
            name="diamond-stone"
            size={16}
            color="#f6d43a"
          />
          <Text3D style={styles.coinText}>
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(coins)}
          </Text3D>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        <Text3D style={styles.sectionTitle}>Gameboards</Text3D>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          decelerationRate="fast"
          snapToAlignment="start"
          snapToInterval={246}
        >
          {BACKGROUNDS.map((item) => {
            const owned = ownedIds.has(item.id);
            const active = activeBackgroundId === item.id;
            const canBuy = coins >= item.cost && !owned;
            const canEquip = owned && !active;
            const canInteract = canBuy || canEquip;

            return (
              <View key={item.id} style={styles.card}>
                <View
                  style={[styles.preview, { backgroundColor: item.background }]}
                >
                  <View style={styles.previewGlow} />
                  <View style={styles.previewBadge}>
                    <MaterialCommunityIcons
                      name="image-filter-drama"
                      size={18}
                      color={item.accent}
                    />
                    <Text3D
                      style={[styles.previewBadgeText, { color: item.accent }]}
                    >
                      Gameboard
                    </Text3D>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text3D style={styles.cardTitle}>{item.name}</Text3D>
                    {active ? (
                      <View style={styles.activeChip}>
                        <Text3D style={styles.activeChipText}>Active</Text3D>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.costRow}>
                      <MaterialCommunityIcons
                        name="diamond-stone"
                        size={14}
                        color="#f6d43a"
                      />
                      <Text3D style={styles.costText}>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(item.cost)}
                      </Text3D>
                    </View>

                    <Text3D style={styles.statusText}>
                      {owned
                        ? "Owned"
                        : canBuy
                          ? "Available"
                          : "Need more coins"}
                    </Text3D>
                  </View>

                  <Pressable
                    onPress={() => {
                      if (canEquip) {
                        equipBackground(item.id);
                        return;
                      }

                      void buyBackground(item);
                    }}
                    disabled={!canInteract}
                    style={({ pressed }) => [
                      styles.buyButton,
                      active && styles.ownedButton,
                      canEquip && styles.equipButton,
                      !canInteract && styles.disabledButton,
                      pressed && canInteract && styles.pressedButton,
                    ]}
                  >
                    <Text3D style={styles.buyButtonText}>
                      {active ? "Active" : canEquip ? "Equip" : "Buy Gameboard"}
                    </Text3D>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <Text3D style={styles.sectionTitle}>Cards</Text3D>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          decelerationRate="fast"
          snapToAlignment="start"
          snapToInterval={246}
        >
          {CARD_BACKS.map((item) => {
            const owned = ownedCardBackIds.has(item.id);
            const active = activeCardBackId === item.id;
            const canBuy = coins >= item.cost && !owned;
            const canEquip = owned && !active;
            const canInteract = canBuy || canEquip;

            return (
              <View key={item.id} style={styles.card}>
                <View style={[styles.preview, { backgroundColor: item.color }]}>
                  <View style={styles.previewGlow} />
                  <View style={styles.previewBadge}>
                    <MaterialCommunityIcons
                      name="cards-playing-heart-multiple-outline"
                      size={18}
                      color={item.accent}
                    />
                    <Text3D
                      style={[styles.previewBadgeText, { color: item.accent }]}
                    >
                      Card
                    </Text3D>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text3D style={styles.cardTitle}>{item.name}</Text3D>
                    {active ? (
                      <View style={styles.activeChip}>
                        <Text3D style={styles.activeChipText}>Active</Text3D>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.costRow}>
                      <MaterialCommunityIcons
                        name="diamond-stone"
                        size={14}
                        color="#f6d43a"
                      />
                      <Text3D style={styles.costText}>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(item.cost)}
                      </Text3D>
                    </View>

                    <Text3D style={styles.statusText}>
                      {owned
                        ? "Owned"
                        : canBuy
                          ? "Available"
                          : "Need more coins"}
                    </Text3D>
                  </View>

                  <Pressable
                    onPress={() => {
                      if (canEquip) {
                        equipCardBack(item.id);
                        return;
                      }

                      void buyCardBack(item);
                    }}
                    disabled={!canInteract}
                    style={({ pressed }) => [
                      styles.buyButton,
                      active && styles.ownedButton,
                      canEquip && styles.equipButton,
                      !canInteract && styles.disabledButton,
                      pressed && canInteract && styles.pressedButton,
                    ]}
                  >
                    <Text3D style={styles.buyButtonText}>
                      {active ? "Active" : canEquip ? "Equip" : "Buy Card"}
                    </Text3D>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a5c2e",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: "#f6d43a",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "bold",
  },
  subtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  coinPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
  },
  coinText: {
    color: "#ffe89a",
    fontSize: 13,
    fontWeight: "800",
  },
  list: {
    paddingVertical: 16,
    gap: 14,
    paddingBottom: 24,
  },
  carouselContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  sectionTitle: {
    color: "#fdf0b4",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    marginTop: 4,
    marginBottom: 2,
  },
  card: {
    width: 236,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.22)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
  },
  preview: {
    height: 108,
    padding: 10,
    justifyContent: "space-between",
  },
  previewGlow: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  previewBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cardBody: {
    padding: 11,
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    flex: 1,
  },
  activeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(84, 214, 129, 0.2)",
    borderColor: "rgba(84, 214, 129, 0.35)",
    borderWidth: 1,
  },
  activeChipText: {
    color: "#8ef0ae",
    fontSize: 11,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  costText: {
    color: "#ffe89a",
    fontSize: 13,
    fontWeight: "800",
  },
  statusText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "600",
  },
  buyButton: {
    borderRadius: 14,
    backgroundColor: "#f6d43a",
    paddingVertical: 10,
    alignItems: "center",
  },
  buyButtonText: {
    color: "#1a1a2e",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  ownedButton: {
    backgroundColor: "#7fd08b",
  },
  equipButton: {
    backgroundColor: "#7ab8ff",
  },
  disabledButton: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  pressedButton: {
    opacity: 0.88,
  },
});
