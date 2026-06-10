import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text3D from "../components/Text3D";
import {
  equipCurrentUserShopItemFromBackend,
  getCurrentUserProfile,
  getCurrentUserShopInventoryFromBackend,
  getShopCatalogFromBackend,
  purchaseCurrentUserShopItemFromBackend,
  syncCurrentUserProfileFromBackend,
  type ShopCatalogItem,
  type ShopItemType,
} from "../constants/auth";
import { type BackgroundId } from "../constants/backgrounds";
import { type CardBackId } from "../constants/cardbacks";
import { type PlayerIconId } from "../constants/playerIcons";
import {
  getActivePlayerIconId,
  getOwnedPlayerIconIds,
  initializeProfileSettings,
  setActiveBackgroundId,
  setActiveCardBackId,
  setActivePlayerIconId,
  subscribePlayerIconSettings,
  unlockBackground,
  unlockCardBack,
  unlockPlayerIcon,
} from "../constants/settings";

const BACKGROUND_ID_SET = new Set<BackgroundId>([
  "emerald",
  "royal",
  "golden",
  "rose",
  "ember",
  "midnight",
]);
const CARD_BACK_ID_SET = new Set<CardBackId>([
  "royal",
  "golden",
  "rose",
  "ember",
  "emerald",
  "midnight",
]);
const PLAYER_ICON_ID_SET = new Set<PlayerIconId>([
  "human",
  "crown",
  "fox",
  "ninja",
  "alien",
  "unicorn",
  "robot",
]);

type IconAnimation = "pulse" | "float" | "spin";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
type EquippedByType = Partial<Record<ShopItemType, string>>;

type ShopRenderableItem = {
  base: ShopCatalogItem;
  uiId: string | null;
  accent: string;
  previewColor: string;
  badgeLabel: string;
  iconName: IconName;
};

const toBackgroundId = (value: string | null): BackgroundId | null => {
  if (!value || !BACKGROUND_ID_SET.has(value as BackgroundId)) return null;
  return value as BackgroundId;
};

const toCardBackId = (value: string | null): CardBackId | null => {
  if (!value || !CARD_BACK_ID_SET.has(value as CardBackId)) return null;
  return value as CardBackId;
};

const toPlayerIconId = (value: string | null): PlayerIconId | null => {
  if (!value || !PLAYER_ICON_ID_SET.has(value as PlayerIconId)) return null;
  return value as PlayerIconId;
};

const getPropertyString = (
  properties: Record<string, unknown> | undefined,
  key: string,
): string | null => {
  const value = properties?.[key];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const toIconAnimation = (
  properties: Record<string, unknown> | undefined,
): IconAnimation | null => {
  const raw = getPropertyString(properties, "animation");
  if (raw === "pulse" || raw === "float" || raw === "spin") {
    return raw;
  }
  return null;
};

function AnimatedIconPreview({
  emoji,
  animation,
}: {
  emoji: string;
  animation: IconAnimation | null;
}): React.ReactElement {
  const value = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!animation) {
      value.stopAnimation();
      value.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration: animation === "spin" ? 1700 : 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );

    loop.start();

    return () => {
      loop.stop();
      value.stopAnimation();
      value.setValue(0);
    };
  }, [animation, value]);

  if (!animation) {
    return <Text3D style={styles.playerIconEmoji}>{emoji}</Text3D>;
  }

  const animatedStyle =
    animation === "pulse"
      ? {
          transform: [
            {
              scale: value.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.18, 1],
              }),
            },
          ],
        }
      : animation === "float"
        ? {
            transform: [
              {
                translateY: value.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, -8, 0],
                }),
              },
            ],
          }
        : {
            transform: [
              {
                rotate: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "360deg"],
                }),
              },
            ],
          };

  return (
    <Animated.View style={animatedStyle}>
      <Text3D style={styles.playerIconEmoji}>{emoji}</Text3D>
    </Animated.View>
  );
}

const toRenderableItem = (item: ShopCatalogItem): ShopRenderableItem => {
  const defaultIcon: IconName =
    item.type === "BACKGROUND"
      ? "image-filter-drama"
      : item.type === "CARD_BACK"
        ? "cards-playing-heart-multiple-outline"
        : "account-circle-outline";
  const defaultBadge =
    item.type === "BACKGROUND"
      ? "Gameboard"
      : item.type === "CARD_BACK"
        ? "Card"
        : "Player Icon";
  const defaultPreview =
    item.type === "BACKGROUND"
      ? "#2a3f33"
      : item.type === "CARD_BACK"
        ? "#2a2a44"
        : "#2c2a36";

  return {
    base: item,
    uiId: getPropertyString(item.properties, "uiId"),
    accent: getPropertyString(item.properties, "accent") ?? "#f6d43a",
    previewColor:
      getPropertyString(item.properties, "background") ??
      getPropertyString(item.properties, "color") ??
      defaultPreview,
    badgeLabel:
      getPropertyString(item.properties, "badgeLabel") ?? defaultBadge,
    iconName:
      (getPropertyString(item.properties, "icon") as IconName | null) ??
      defaultIcon,
  };
};

export default function ShopScreen(): React.ReactElement {
  const router = useRouter();
  const [coins, setCoins] = React.useState(0);
  const [catalogItems, setCatalogItems] = React.useState<ShopCatalogItem[]>([]);
  const [ownedSkus, setOwnedSkus] = React.useState<Set<string>>(new Set());
  const [equippedByType, setEquippedByType] = React.useState<EquippedByType>(
    {},
  );
  const [ownedPlayerIconIds, setOwnedPlayerIconIds] = React.useState(
    () => new Set<PlayerIconId>(getOwnedPlayerIconIds()),
  );
  const [activePlayerIconId, setActivePlayerIconIdState] = React.useState(
    getActivePlayerIconId(),
  );

  const backgroundItems = React.useMemo(
    () =>
      catalogItems
        .filter((item) => item.type === "BACKGROUND")
        .map(toRenderableItem),
    [catalogItems],
  );
  const cardBackItems = React.useMemo(
    () =>
      catalogItems
        .filter((item) => item.type === "CARD_BACK")
        .map(toRenderableItem),
    [catalogItems],
  );
  const playerIconItems = React.useMemo(
    () =>
      catalogItems
        .filter((item) => item.type === "PLAYER_ICON")
        .map(toRenderableItem),
    [catalogItems],
  );

  React.useEffect(() => {
    let cancelled = false;

    const loadCurrentProfileCoins = async (): Promise<void> => {
      const profile = await getCurrentUserProfile();
      if (cancelled) return;

      if (!profile) {
        router.replace("/lobby");
        return;
      }

      setCoins(profile?.coins ?? 0);

      const synced = await syncCurrentUserProfileFromBackend();
      if (!cancelled && synced) {
        setCoins(synced.coins);
      }

      const [catalog, inventory] = await Promise.all([
        getShopCatalogFromBackend(),
        getCurrentUserShopInventoryFromBackend(),
      ]);

      if (cancelled) return;

      if (catalog) {
        setCatalogItems(catalog);
      }

      if (inventory) {
        const nextOwnedSkus = new Set<string>();
        const nextEquippedByType: EquippedByType = {};

        for (const owned of inventory) {
          nextOwnedSkus.add(owned.sku);
          if (owned.equipped) {
            nextEquippedByType[owned.type] = owned.sku;
          }

          const uiId = getPropertyString(owned.properties, "uiId");
          if (owned.type === "BACKGROUND") {
            const backgroundId = toBackgroundId(uiId);
            if (backgroundId) {
              unlockBackground(backgroundId);
              if (owned.equipped) {
                setActiveBackgroundId(backgroundId);
              }
            }
            continue;
          }

          const cardBackId = toCardBackId(uiId);
          if (cardBackId) {
            unlockCardBack(cardBackId);
            if (owned.equipped) {
              setActiveCardBackId(cardBackId);
            }
          }

          if (owned.type === "PLAYER_ICON") {
            const playerIconId = toPlayerIconId(uiId);
            if (playerIconId) {
              unlockPlayerIcon(playerIconId);
              if (owned.equipped) {
                setActivePlayerIconId(playerIconId);
              }
            }
          }
        }

        setOwnedSkus(nextOwnedSkus);
        setEquippedByType(nextEquippedByType);
      }
    };

    void loadCurrentProfileCoins();

    void initializeProfileSettings();

    const unsubscribePlayerIcons = subscribePlayerIconSettings(() => {
      setOwnedPlayerIconIds(new Set<PlayerIconId>(getOwnedPlayerIconIds()));
      setActivePlayerIconIdState(getActivePlayerIconId());
    });

    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );

    return () => {
      cancelled = true;
      unsubscribePlayerIcons();
      void ScreenOrientation.unlockAsync();
    };
  }, [router]);

  const buyItem = async (item: ShopRenderableItem): Promise<void> => {
    if (ownedSkus.has(item.base.sku)) return;

    const amount = Math.max(0, Math.floor(item.base.price));
    if (coins < amount) return;

    const nextCoins = await purchaseCurrentUserShopItemFromBackend(
      item.base.sku,
    );
    if (nextCoins == null) return;

    setCoins(nextCoins);

    setOwnedSkus((prev) => new Set(prev).add(item.base.sku));

    if (item.base.type === "BACKGROUND") {
      const backgroundId = toBackgroundId(item.uiId);
      if (backgroundId) {
        unlockBackground(backgroundId);
      }
      return;
    }

    const cardBackId = toCardBackId(item.uiId);
    if (cardBackId) {
      unlockCardBack(cardBackId);
      return;
    }

    const playerIconId = toPlayerIconId(item.uiId);
    if (playerIconId) {
      unlockPlayerIcon(playerIconId);
    }
  };

  const equipItem = async (item: ShopRenderableItem): Promise<void> => {
    const equipped = await equipCurrentUserShopItemFromBackend(item.base.sku);
    if (!equipped) return;

    setEquippedByType((prev) => ({
      ...prev,
      [item.base.type]: item.base.sku,
    }));

    if (item.base.type === "BACKGROUND") {
      const backgroundId = toBackgroundId(item.uiId);
      if (backgroundId) {
        setActiveBackgroundId(backgroundId);
      }
      return;
    }

    const cardBackId = toCardBackId(item.uiId);
    if (cardBackId) {
      setActiveCardBackId(cardBackId);
      return;
    }

    const playerIconId = toPlayerIconId(item.uiId);
    if (playerIconId) {
      setActivePlayerIconId(playerIconId);
    }
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
          {backgroundItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text3D style={styles.emptyText}>
                No gameboards from server.
              </Text3D>
            </View>
          ) : null}
          {backgroundItems.map((item) => {
            const owned = ownedSkus.has(item.base.sku);
            const active = equippedByType.BACKGROUND === item.base.sku;
            const itemCost = Math.max(0, Math.floor(item.base.price));
            const canBuy = coins >= itemCost && !owned;
            const canEquip = owned && !active;
            const canInteract = canBuy || canEquip;

            return (
              <View key={item.base.sku} style={styles.card}>
                <View
                  style={[
                    styles.preview,
                    { backgroundColor: item.previewColor },
                  ]}
                >
                  <View style={styles.previewGlow} />
                  <View style={styles.previewBadge}>
                    <MaterialCommunityIcons
                      name={item.iconName}
                      size={18}
                      color={item.accent}
                    />
                    <Text3D
                      style={[styles.previewBadgeText, { color: item.accent }]}
                    >
                      {item.badgeLabel}
                    </Text3D>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text3D style={styles.cardTitle}>{item.base.name}</Text3D>
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
                        }).format(itemCost)}
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
                        void equipItem(item);
                        return;
                      }

                      void buyItem(item);
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
          {cardBackItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text3D style={styles.emptyText}>
                No card backs from server.
              </Text3D>
            </View>
          ) : null}
          {cardBackItems.map((item) => {
            const owned = ownedSkus.has(item.base.sku);
            const active = equippedByType.CARD_BACK === item.base.sku;
            const itemCost = Math.max(0, Math.floor(item.base.price));
            const canBuy = coins >= itemCost && !owned;
            const canEquip = owned && !active;
            const canInteract = canBuy || canEquip;

            return (
              <View key={item.base.sku} style={styles.card}>
                <View
                  style={[
                    styles.preview,
                    { backgroundColor: item.previewColor },
                  ]}
                >
                  <View style={styles.previewGlow} />
                  <View style={styles.previewBadge}>
                    <MaterialCommunityIcons
                      name={item.iconName}
                      size={18}
                      color={item.accent}
                    />
                    <Text3D
                      style={[styles.previewBadgeText, { color: item.accent }]}
                    >
                      {item.badgeLabel}
                    </Text3D>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text3D style={styles.cardTitle}>{item.base.name}</Text3D>
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
                        }).format(itemCost)}
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
                        void equipItem(item);
                        return;
                      }

                      void buyItem(item);
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

        <Text3D style={styles.sectionTitle}>Player Icons</Text3D>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          decelerationRate="fast"
          snapToAlignment="start"
          snapToInterval={246}
        >
          {playerIconItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text3D style={styles.emptyText}>
                No player icons from server.
              </Text3D>
            </View>
          ) : null}
          {playerIconItems.map((item) => {
            const owned = ownedSkus.has(item.base.sku);
            const activeByServer = equippedByType.PLAYER_ICON === item.base.sku;
            const localIconId = toPlayerIconId(item.uiId);
            const activeByLocal =
              localIconId !== null &&
              ownedPlayerIconIds.has(localIconId) &&
              activePlayerIconId === localIconId;
            const active = activeByServer || activeByLocal;
            const itemCost = Math.max(0, Math.floor(item.base.price));
            const canBuy = coins >= itemCost && !owned;
            const canEquip = owned && !active;
            const canInteract = canBuy || canEquip;
            const emoji =
              getPropertyString(item.base.properties, "emoji") ?? "🙂";
            const animation = toIconAnimation(item.base.properties);

            return (
              <View key={item.base.sku} style={styles.card}>
                <View
                  style={[
                    styles.preview,
                    { backgroundColor: item.previewColor },
                  ]}
                >
                  <View style={styles.previewGlow} />
                  <View style={styles.previewBadge}>
                    <MaterialCommunityIcons
                      name={item.iconName}
                      size={18}
                      color={item.accent}
                    />
                    <Text3D
                      style={[styles.previewBadgeText, { color: item.accent }]}
                    >
                      {item.badgeLabel}
                    </Text3D>
                  </View>
                  <AnimatedIconPreview emoji={emoji} animation={animation} />
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text3D style={styles.cardTitle}>{item.base.name}</Text3D>
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
                        }).format(itemCost)}
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
                        void equipItem(item);
                        return;
                      }

                      void buyItem(item);
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
                      {active ? "Active" : canEquip ? "Equip" : "Buy Icon"}
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
  emptyCard: {
    width: 236,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  emptyText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    textAlign: "center",
  },
  playerIconEmoji: {
    fontSize: 44,
    lineHeight: 54,
    textAlign: "center",
    marginTop: 8,
  },
});
