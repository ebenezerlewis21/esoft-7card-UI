import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text3D from "../components/Text3D";
import {
  clearAuthCredential,
  clearCurrentEmail,
  clearCurrentName,
  clearGuestSession,
  getCurrentUserProfile,
  syncCurrentUserProfileFromBackend,
} from "../constants/auth";
import {
  getQuickMatch,
  getQuickMatchIdentity,
  joinQuickMatch,
  leaveQuickMatch,
  QUICK_MATCH_MAX_PLAYERS,
  startQuickMatchGame,
  type QuickMatchIdentity,
  type QuickMatchSession,
} from "../constants/multiplayer";
import {
  getAiDifficulty,
  getTurnAlertMode,
  initializeProfileSettings,
  initializeSoundSettings,
  isSoundEnabled,
  setAiDifficulty,
  setSoundEnabled,
  setTurnAlertMode,
  subscribeSoundEnabled,
  subscribeTurnAlertMode,
  type AiDifficulty,
  type TurnAlertMode,
} from "../constants/settings";

const DEFAULT_PROFILE = {
  name: "Player",
  wins: 0,
  gamesPlayed: 0,
  rank: "Unranked",
  coins: 0,
};

const SAVED_LOGIN_KEY = "@auth/savedLogin";

export default function LobbyScreen(): React.ReactElement {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [playModeOpen, setPlayModeOpen] = React.useState(false);
  const [guestPromptOpen, setGuestPromptOpen] = React.useState(false);
  const [quickMatchOpen, setQuickMatchOpen] = React.useState(false);
  const [quickMatchLoading, setQuickMatchLoading] = React.useState(false);
  const [quickMatchError, setQuickMatchError] = React.useState<string | null>(
    null,
  );
  const [quickMatchSession, setQuickMatchSession] =
    React.useState<QuickMatchSession | null>(null);
  const [quickMatchIdentity, setQuickMatchIdentity] =
    React.useState<QuickMatchIdentity | null>(null);
  const [latestQuickMatchPlayerId, setLatestQuickMatchPlayerId] =
    React.useState<string | null>(null);
  const [isGuest, setIsGuest] = React.useState(true);
  const [playerProfile, setPlayerProfile] = React.useState(DEFAULT_PROFILE);
  const [soundEnabled, setSoundEnabledState] = React.useState(isSoundEnabled());
  const [turnAlertMode, setTurnAlertModeState] =
    React.useState<TurnAlertMode>(getTurnAlertMode());
  const [selectedAiDifficulty, setSelectedAiDifficulty] =
    React.useState<AiDifficulty>(getAiDifficulty());
  const winRatio = Math.round(
    (playerProfile.wins / Math.max(1, playerProfile.gamesPlayed)) * 100,
  );
  const winRatioDisplay = winRatio === 0 ? "-" : `${winRatio}%`;
  const coinsDisplay = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(playerProfile.coins),
    [playerProfile.coins],
  );

  React.useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => {
      // Some devices do not support screen orientation lock at runtime.
    });

    return () => {
      void ScreenOrientation.unlockAsync().catch(() => {
        // Keep teardown safe on devices that do not support orientation APIs.
      });
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const loadCurrentProfile = async (): Promise<void> => {
      const profile = await getCurrentUserProfile();
      if (!profile || cancelled) {
        if (!cancelled) {
          setIsGuest(true);
        }
        return;
      }

      setIsGuest(false);

      setPlayerProfile({
        name: profile.name,
        wins: profile.wins,
        gamesPlayed: profile.gamesPlayed,
        rank: profile.rank,
        coins: profile.coins,
      });

      const syncedProfile = await syncCurrentUserProfileFromBackend();
      if (!cancelled && syncedProfile) {
        setIsGuest(false);
        setPlayerProfile((prev) => ({
          ...prev,
          name: syncedProfile.name,
          wins: syncedProfile.wins,
          gamesPlayed: syncedProfile.gamesPlayed,
          rank: syncedProfile.rank,
          coins: syncedProfile.coins,
        }));
      }
    };

    void loadCurrentProfile();

    const unsubscribe = subscribeSoundEnabled((enabled) => {
      setSoundEnabledState(enabled);
    });

    const unsubscribeTurnAlertMode = subscribeTurnAlertMode((mode) => {
      setTurnAlertModeState(mode);
    });

    void initializeSoundSettings();
    void initializeProfileSettings();

    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeTurnAlertMode();
    };
  }, []);

  const handleSignOut = React.useCallback(async () => {
    try {
      await AsyncStorage.removeItem(SAVED_LOGIN_KEY);
      await clearAuthCredential();
      await clearCurrentEmail();
      await clearCurrentName();
      await clearGuestSession();
    } catch {
      // Continue sign-out flow even if storage removal fails.
    }

    setSettingsOpen(false);
    router.replace("/login");
  }, [router]);

  const handleRestrictedGuestAction = React.useCallback(() => {
    setGuestPromptOpen(true);
  }, []);

  const handleGuestPromptDismiss = React.useCallback(() => {
    setGuestPromptOpen(false);
  }, []);

  const updateQuickMatchSession = React.useCallback(
    (nextSession: QuickMatchSession) => {
      setQuickMatchSession((previousSession) => {
        if (
          previousSession &&
          nextSession.players.length > previousSession.players.length
        ) {
          const previousPlayerIds = new Set(
            previousSession.players.map((player) => player.playerId),
          );
          const joinedPlayer = nextSession.players.find(
            (player) => !previousPlayerIds.has(player.playerId),
          );
          setLatestQuickMatchPlayerId(joinedPlayer?.playerId ?? null);
        } else if (!previousSession && nextSession.players.length > 0) {
          const newestPlayer =
            nextSession.players[nextSession.players.length - 1];
          setLatestQuickMatchPlayerId(newestPlayer?.playerId ?? null);
        }

        return nextSession;
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!quickMatchOpen || !quickMatchSession?.matchId) {
      return;
    }

    const interval = setInterval(() => {
      void (async () => {
        const nextSession = await getQuickMatch(quickMatchSession.matchId);
        if (nextSession) {
          updateQuickMatchSession(nextSession);
          setQuickMatchError(null);
        }
      })();
    }, 1500);

    return () => clearInterval(interval);
  }, [
    quickMatchOpen,
    quickMatchSession?.matchId,
    updateQuickMatchSession,
  ]);

  React.useEffect(() => {
    if (
      !quickMatchOpen ||
      quickMatchSession?.status !== "IN_PROGRESS" ||
      !quickMatchSession.matchId ||
      !quickMatchIdentity?.playerId
    ) {
      return;
    }

    setQuickMatchOpen(false);
    router.push({
      pathname: "/game",
      params: {
        mode: "online",
        matchId: quickMatchSession.matchId,
        playerId: quickMatchIdentity.playerId,
      },
    });
  }, [
    quickMatchIdentity?.playerId,
    quickMatchOpen,
    quickMatchSession?.matchId,
    quickMatchSession?.status,
    router,
  ]);

  const handleGuestPromptSignIn = React.useCallback(() => {
    setGuestPromptOpen(false);
    router.replace("/login");
  }, [router]);

  const handleQuickMatchPress = React.useCallback(async () => {
    setQuickMatchOpen(true);
    setQuickMatchLoading(true);
    setQuickMatchError(null);
    setQuickMatchSession(null);
    setLatestQuickMatchPlayerId(null);

    try {
      const identity = await getQuickMatchIdentity();
      setQuickMatchIdentity(identity);

      const session = await joinQuickMatch(identity);
      if (!session) {
        setQuickMatchError(
          "Unable to join quick match. Check that the multiplayer server is running.",
        );
        return;
      }

      updateQuickMatchSession(session);
    } catch {
      setQuickMatchError(
        "Unable to join quick match. Check that the multiplayer server is running.",
      );
    } finally {
      setQuickMatchLoading(false);
    }
  }, [updateQuickMatchSession]);

  const handleQuickMatchCancel = React.useCallback(() => {
    const matchId = quickMatchSession?.matchId;
    const playerId = quickMatchIdentity?.playerId;

    setQuickMatchOpen(false);
    setQuickMatchLoading(false);
    setQuickMatchError(null);
    setQuickMatchSession(null);
    setLatestQuickMatchPlayerId(null);

    if (matchId && playerId) {
      void leaveQuickMatch(matchId, playerId);
    }
  }, [quickMatchIdentity?.playerId, quickMatchSession?.matchId]);

  const handleQuickMatchStart = React.useCallback(async () => {
    const matchId = quickMatchSession?.matchId;
    const playerId = quickMatchIdentity?.playerId;
    if (!matchId || !playerId) {
      return;
    }

    setQuickMatchLoading(true);
    setQuickMatchError(null);

    try {
      const session = await startQuickMatchGame(matchId, playerId);
      if (!session) {
        setQuickMatchError("Unable to start quick match yet.");
        return;
      }

      updateQuickMatchSession(session);
    } catch {
      setQuickMatchError("Unable to start quick match yet.");
    } finally {
      setQuickMatchLoading(false);
    }
  }, [
    quickMatchIdentity?.playerId,
    quickMatchSession?.matchId,
    updateQuickMatchSession,
  ]);

  const quickMatchPlayerCount = quickMatchSession?.players.length ?? 0;
  const quickMatchMaxPlayers =
    quickMatchSession?.maxPlayers ?? QUICK_MATCH_MAX_PLAYERS;
  const quickMatchReady =
    quickMatchSession?.status === "READY" ||
    quickMatchPlayerCount === quickMatchMaxPlayers;

  return (
    <SafeAreaView style={styles.container}>
      <SafeAreaView style={styles.topSafeArea} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.storeButton, isGuest && styles.disabledStoreButton]}
            activeOpacity={0.85}
            onPress={() => {
              if (isGuest) {
                handleRestrictedGuestAction();
                return;
              }
              router.push("./shop");
            }}
            accessibilityRole="button"
            accessibilityLabel="Store"
          >
            <MaterialCommunityIcons
              name="store-outline"
              size={30}
              color="#ffffff"
            />
          </TouchableOpacity>

          <View style={styles.actionStack}>
            <TouchableOpacity
              style={styles.settingsButton}
              activeOpacity={0.85}
              onPress={() => setSettingsOpen(true)}
            >
              <Text3D style={styles.settingsButtonText}>Settings</Text3D>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.infoButton}
              activeOpacity={0.85}
              onPress={() => router.push("./info")}
              accessibilityRole="button"
              accessibilityLabel="Info"
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={20}
                color="#ffffff"
              />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.panel}>
        <Text3D style={styles.title}>7-Card Lowball</Text3D>
        <Text3D style={styles.subtitle}>Choose a mode to start</Text3D>

        <View style={styles.profileCard}>
          <Text3D style={styles.profileName}>{playerProfile.name}</Text3D>

          <View style={styles.profileStatsGrid}>
            <View style={styles.statItem}>
              <Text3D style={styles.statLabel}>Win Percentage</Text3D>
              <Text3D style={styles.statValue}>{winRatioDisplay}</Text3D>
            </View>

            <View style={styles.statItem}>
              <Text3D style={styles.statLabel}>Games Won</Text3D>
              <Text3D style={styles.statValue}>{playerProfile.wins}</Text3D>
            </View>

            <View style={styles.statItem}>
              <Text3D style={styles.statLabel}>Ranked</Text3D>
              <Text3D style={styles.statValue}>{playerProfile.rank}</Text3D>
            </View>

            <View style={styles.statItem}>
              <Text3D style={styles.statLabel}>Coins</Text3D>
              <View style={styles.coinValueRow}>
                <MaterialCommunityIcons
                  name="diamond-stone"
                  size={16}
                  color="#f6d43a"
                  style={styles.coinIcon}
                />
                <Text3D style={[styles.statValue, styles.coinValueText]}>
                  {coinsDisplay}
                </Text3D>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actionsOrbit}>
          <TouchableOpacity
            style={[styles.diamondButton, styles.playButton, styles.actionTop]}
            activeOpacity={0.85}
            onPress={() => {
              setSelectedAiDifficulty(getAiDifficulty());
              setPlayModeOpen(true);
            }}
          >
            <View style={styles.diamondButtonContent}>
              <Text3D style={[styles.diamondButtonText, styles.playButtonText]}>
                Play vs Computer
              </Text3D>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.diamondButton,
              styles.onlineButton,
              styles.actionRight,
            ]}
            activeOpacity={0.85}
            onPress={() => {
              void handleQuickMatchPress();
            }}
          >
            <View style={styles.diamondButtonContent}>
              <Text3D
                style={[styles.diamondButtonText, styles.onlineButtonText]}
              >
                Quick Match Online
              </Text3D>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.diamondButton,
              styles.friendButton,
              styles.actionBottom,
              isGuest && styles.disabledDiamondButton,
            ]}
            activeOpacity={0.85}
            onPress={() => {
              if (isGuest) {
                handleRestrictedGuestAction();
                return;
              }
              router.push("/under-construction");
            }}
          >
            <View style={styles.diamondButtonContent}>
              <Text3D
                style={[styles.diamondButtonText, styles.friendButtonText]}
              >
                Challenge Friend
              </Text3D>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.diamondButton,
              styles.tournamentButton,
              styles.actionLeft,
              isGuest && styles.disabledDiamondButton,
            ]}
            activeOpacity={0.85}
            onPress={() => {
              if (isGuest) {
                handleRestrictedGuestAction();
                return;
              }
              router.push("/under-construction");
            }}
          >
            <View style={styles.diamondButtonContent}>
              <Text3D
                style={[styles.diamondButtonText, styles.tournamentButtonText]}
              >
                Tournament
              </Text3D>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={settingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text3D style={styles.modalTitle}>Settings</Text3D>

            <View style={styles.optionRow}>
              <Text3D style={styles.optionLabel}>Enable Sound</Text3D>
              <Switch
                value={soundEnabled}
                onValueChange={(value) => {
                  setSoundEnabledState(value);
                  setSoundEnabled(value);
                }}
                trackColor={{ false: "#6b6b6b", true: "#4caf50" }}
                thumbColor={soundEnabled ? "#e9ffe9" : "#f2f2f2"}
              />
            </View>

            <View style={styles.turnAlertSection}>
              <View style={styles.optionRow}>
                <Text3D style={styles.optionLabel}>Enable Vibrate</Text3D>
                <Switch
                  value={turnAlertMode === "vibrate"}
                  onValueChange={(value) => {
                    const nextMode: TurnAlertMode = value ? "vibrate" : "none";
                    setTurnAlertModeState(nextMode);
                    setTurnAlertMode(nextMode);
                  }}
                  trackColor={{ false: "#6b6b6b", true: "#4caf50" }}
                  thumbColor={
                    turnAlertMode === "vibrate" ? "#e9ffe9" : "#f2f2f2"
                  }
                />
              </View>
            </View>

            <Text3D style={styles.settingsHint}>
              Equip gameboards and cards from the Shop.
            </Text3D>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              activeOpacity={0.85}
              onPress={() => setSettingsOpen(false)}
            >
              <Text3D style={styles.modalCloseText}>Done</Text3D>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signOutBtn}
              activeOpacity={0.85}
              onPress={() => {
                void handleSignOut();
              }}
            >
              <Text3D style={styles.signOutText}>Sign Out</Text3D>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={playModeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPlayModeOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text3D style={styles.modalTitle}>Choose AI Difficulty</Text3D>

            <View style={styles.aiModeSection}>
              <View style={styles.aiModeOptionsRow}>
                {(
                  [
                    { label: "Beginner", value: "beginner" as const },
                    { label: "Pro", value: "pro" as const },
                    { label: "Advance", value: "advance" as const },
                    { label: "Expert", value: "expert" as const },
                  ] as const
                ).map((option) => {
                  const active = selectedAiDifficulty === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      activeOpacity={0.85}
                      style={[
                        styles.aiModeOptionBtn,
                        active && styles.aiModeOptionBtnActive,
                      ]}
                      onPress={() => {
                        setSelectedAiDifficulty(option.value);
                      }}
                    >
                      <Text3D
                        style={[
                          styles.aiModeOptionText,
                          active && styles.aiModeOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text3D>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <Text3D style={styles.settingsHint}>
              Select a difficulty before starting Play vs Computer.
            </Text3D>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              activeOpacity={0.85}
              onPress={() => {
                setAiDifficulty(selectedAiDifficulty);
                setPlayModeOpen(false);
                router.push("/game");
              }}
            >
              <Text3D style={styles.modalCloseText}>Start Match</Text3D>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playModeCancelBtn}
              activeOpacity={0.85}
              onPress={() => setPlayModeOpen(false)}
            >
              <Text3D style={styles.playModeCancelText}>Cancel</Text3D>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={guestPromptOpen}
        transparent
        animationType="fade"
        onRequestClose={handleGuestPromptDismiss}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text3D style={[styles.modalTitle, styles.modalHeaderTitle]}>
                Sign In Required
              </Text3D>
              <TouchableOpacity
                style={styles.modalIconCloseBtn}
                activeOpacity={0.8}
                onPress={handleGuestPromptDismiss}
                accessibilityRole="button"
                accessibilityLabel="Close sign in required modal"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>

            <Text3D style={styles.settingsHint}>
              This feature is available for signed-in players only.
            </Text3D>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              activeOpacity={0.85}
              onPress={handleGuestPromptSignIn}
            >
              <Text3D style={styles.modalCloseText}>Go to Sign In</Text3D>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={quickMatchOpen}
        transparent
        animationType="fade"
        onRequestClose={handleQuickMatchCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text3D style={[styles.modalTitle, styles.modalHeaderTitle]}>
                Quick Match Online
              </Text3D>
              <TouchableOpacity
                style={styles.modalIconCloseBtn}
                activeOpacity={0.8}
                onPress={handleQuickMatchCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel quick match"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.quickMatchStatusBox}>
              {quickMatchReady ? (
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={28}
                  color="#7dffa1"
                />
              ) : (
                <ActivityIndicator size="small" color="#f6d43a" />
              )}
              <Text3D style={styles.quickMatchStatusText}>
                {quickMatchReady
                  ? "Match ready"
                  : quickMatchLoading
                    ? "Joining with ..."
                    : "Waiting for players to join"}
              </Text3D>
            </View>

            <Text3D style={styles.quickMatchCountText}>
              {quickMatchPlayerCount} / {quickMatchMaxPlayers} players
            </Text3D>

            <View style={styles.quickMatchPlayerList}>
              {quickMatchSession?.players.map((player, index) => {
                const isNewest =
                  latestQuickMatchPlayerId === player.playerId;
                const isYou =
                  quickMatchIdentity?.playerId === player.playerId;

                return (
                  <View
                    key={player.playerId}
                    style={[
                      styles.quickMatchPlayerRow,
                      isNewest && styles.quickMatchPlayerRowNewest,
                    ]}
                  >
                    <View style={styles.quickMatchPlayerBadge}>
                      <Text3D style={styles.quickMatchPlayerBadgeText}>
                        {index + 1}
                      </Text3D>
                    </View>
                    <Text3D style={styles.quickMatchPlayerName}>
                      {player.playerName}
                      {isYou ? " (You)" : ""}
                    </Text3D>
                  </View>
                );
              })}

              {Array.from({
                length: Math.max(0, quickMatchMaxPlayers - quickMatchPlayerCount),
              }).map((_, index) => (
                <View
                  key={`waiting-${index}`}
                  style={[
                    styles.quickMatchPlayerRow,
                    styles.quickMatchWaitingRow,
                  ]}
                >
                  <View style={styles.quickMatchPlayerBadge}>
                    <Text3D style={styles.quickMatchPlayerBadgeText}>
                      {quickMatchPlayerCount + index + 1}
                    </Text3D>
                  </View>
                  <Text3D style={styles.quickMatchWaitingText}>
                    Waiting for player
                  </Text3D>
                </View>
              ))}
            </View>

            {quickMatchError ? (
              <Text3D style={styles.quickMatchErrorText}>
                {quickMatchError}
              </Text3D>
            ) : null}

            {quickMatchReady ? (
              <TouchableOpacity
                style={styles.modalCloseBtn}
                activeOpacity={0.85}
                onPress={() => {
                  void handleQuickMatchStart();
                }}
              >
                <Text3D style={styles.modalCloseText}>Start Game</Text3D>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.playModeCancelBtn}
              activeOpacity={0.85}
              onPress={handleQuickMatchCancel}
            >
              <Text3D style={styles.playModeCancelText}>Cancel</Text3D>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  topSafeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 6,
    gap: 8,
  },
  actionStack: {
    alignItems: "flex-end",
    gap: 8,
  },
  storeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderColor: "rgba(255,255,255,0.26)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledStoreButton: {
    opacity: 0.42,
  },
  settingsButton: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderColor: "rgba(255,255,255,0.26)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  settingsButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderColor: "rgba(255,255,255,0.26)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#f6d43a",
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "bold",
    letterSpacing: 0.8,
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 6,
  },
  profileCard: {
    width: "100%",
    borderRadius: 14,
    backgroundColor: "rgba(7, 23, 14, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(246, 212, 58, 0.35)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 10,
  },
  profileName: {
    color: "#fdf0b4",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  profileStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
  },
  statItem: {
    width: "50%",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  statLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  statValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  coinValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  coinIcon: {
    marginRight: 4,
  },
  coinValueText: {
    color: "#ffe89a",
  },
  actionsOrbit: {
    width: 300,
    height: 300,
    marginTop: 6,
    marginBottom: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  diamondButton: {
    position: "absolute",
    width: 108,
    height: 108,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledDiamondButton: {
    opacity: 0.42,
  },
  diamondButtonContent: {
    transform: [{ rotate: "-45deg" }],
    width: 86,
    alignItems: "center",
    justifyContent: "center",
  },
  diamondButtonText: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 0.2,
    lineHeight: 14,
  },
  actionTop: {
    top: 0,
    left: "50%",
    marginLeft: -54,
  },
  actionRight: {
    right: 0,
    top: "50%",
    marginTop: -54,
  },
  actionBottom: {
    bottom: 0,
    left: "50%",
    marginLeft: -54,
  },
  actionLeft: {
    left: 0,
    top: "50%",
    marginTop: -54,
  },
  playButton: {
    backgroundColor: "#f6d43a",
  },
  playButtonText: {
    color: "#1a1a2e",
  },
  onlineButton: {
    backgroundColor: "#0f6bd8",
  },
  onlineButtonText: {
    color: "#ffffff",
  },
  friendButton: {
    backgroundColor: "#7a2bbf",
  },
  friendButtonText: {
    color: "#ffffff",
  },
  tournamentButton: {
    backgroundColor: "#d35400",
  },
  tournamentButtonText: {
    color: "#ffffff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: "#173f2f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  modalTitle: {
    color: "#f6d43a",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 14,
    textAlign: "center",
  },
  modalHeader: {
    minHeight: 32,
    marginBottom: 14,
    justifyContent: "center",
  },
  modalHeaderTitle: {
    marginBottom: 0,
    paddingHorizontal: 40,
  },
  modalIconCloseBtn: {
    position: "absolute",
    right: -4,
    top: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 12,
  },
  optionLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  turnAlertSection: {
    marginBottom: 14,
  },
  aiModeSection: {
    marginBottom: 14,
    gap: 10,
  },
  aiModeOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  aiModeOptionBtn: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 8,
    paddingHorizontal: 11,
    minWidth: 76,
    alignItems: "center",
  },
  aiModeOptionBtnActive: {
    borderColor: "rgba(246,212,58,0.95)",
    backgroundColor: "rgba(246,212,58,0.16)",
  },
  aiModeOptionText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "700",
  },
  aiModeOptionTextActive: {
    color: "#fdf0b4",
  },
  playModeCancelBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingVertical: 9,
    alignItems: "center",
    marginTop: 10,
  },
  playModeCancelText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  quickMatchStatusBox: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(246,212,58,0.26)",
    backgroundColor: "rgba(7, 23, 14, 0.42)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  quickMatchStatusText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  quickMatchCountText: {
    color: "#fdf0b4",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  quickMatchPlayerList: {
    gap: 8,
    marginBottom: 12,
  },
  quickMatchPlayerRow: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
  },
  quickMatchPlayerRowNewest: {
    borderColor: "rgba(125,255,161,0.75)",
    backgroundColor: "rgba(125,255,161,0.16)",
  },
  quickMatchWaitingRow: {
    opacity: 0.7,
  },
  quickMatchPlayerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickMatchPlayerBadgeText: {
    color: "#f6d43a",
    fontSize: 12,
    fontWeight: "900",
  },
  quickMatchPlayerName: {
    color: "#ffffff",
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  quickMatchWaitingText: {
    color: "rgba(255,255,255,0.66)",
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  quickMatchErrorText: {
    color: "#ffb4b4",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 12,
    textAlign: "center",
  },
  settingsHint: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    textAlign: "center",
  },
  modalCloseBtn: {
    borderRadius: 16,
    backgroundColor: "#f6d43a",
    paddingVertical: 11,
    alignItems: "center",
  },
  modalCloseText: {
    color: "#1a1a2e",
    fontWeight: "bold",
    fontSize: 14,
  },
  signOutBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingVertical: 9,
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "rgba(147, 24, 24, 0.45)",
  },
  signOutText: {
    color: "#ffe6e6",
    fontWeight: "700",
    fontSize: 13,
  },
});
