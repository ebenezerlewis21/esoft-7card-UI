import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React from "react";
import {
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
  clearCurrentEmail,
  clearCurrentName,
  getCurrentUserProfile,
  syncCurrentUserProfileFromBackend,
} from "../constants/auth";
import { BACKGROUNDS } from "../constants/backgrounds";
import {
  getActiveBackgroundId,
  getAiDifficulty,
  getTurnAlertMode,
  initializeProfileSettings,
  initializeSoundSettings,
  isSoundEnabled,
  setAiDifficulty,
  setSoundEnabled,
  setTurnAlertMode,
  subscribeBackgroundSettings,
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
  const [playerProfile, setPlayerProfile] = React.useState(DEFAULT_PROFILE);
  const [soundEnabled, setSoundEnabledState] = React.useState(isSoundEnabled());
  const [turnAlertMode, setTurnAlertModeState] =
    React.useState<TurnAlertMode>(getTurnAlertMode());
  const [selectedAiDifficulty, setSelectedAiDifficulty] =
    React.useState<AiDifficulty>(getAiDifficulty());
  const [activeBackgroundId, setActiveBackgroundIdState] = React.useState(
    getActiveBackgroundId(),
  );
  const winRatio = Math.round(
    (playerProfile.wins / Math.max(1, playerProfile.gamesPlayed)) * 100,
  );
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
      if (!profile || cancelled) return;

      setPlayerProfile({
        name: profile.name,
        wins: profile.wins,
        gamesPlayed: profile.gamesPlayed,
        rank: profile.rank,
        coins: profile.coins,
      });

      const syncedProfile = await syncCurrentUserProfileFromBackend();
      if (!cancelled && syncedProfile) {
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

    const unsubscribeBackgrounds = subscribeBackgroundSettings(() => {
      setActiveBackgroundIdState(getActiveBackgroundId());
    });

    const unsubscribeTurnAlertMode = subscribeTurnAlertMode((mode) => {
      setTurnAlertModeState(mode);
    });

    void initializeSoundSettings();
    void initializeProfileSettings();

    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeBackgrounds();
      unsubscribeTurnAlertMode();
    };
  }, []);

  const activeBackground = React.useMemo(
    () =>
      BACKGROUNDS.find((item) => item.id === activeBackgroundId) ??
      BACKGROUNDS[0],
    [activeBackgroundId],
  );

  const handleSignOut = React.useCallback(async () => {
    try {
      await AsyncStorage.removeItem(SAVED_LOGIN_KEY);
      await clearCurrentEmail();
      await clearCurrentName();
    } catch {
      // Continue sign-out flow even if storage removal fails.
    }

    setSettingsOpen(false);
    router.replace("/login");
  }, [router]);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: activeBackground.background },
      ]}
    >
      <SafeAreaView style={styles.topSafeArea} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.storeButton}
            activeOpacity={0.85}
            onPress={() => router.push("./shop")}
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
              <Text3D style={styles.statLabel}>Win Ratio</Text3D>
              <Text3D style={styles.statValue}>{winRatio}%</Text3D>
            </View>

            <View style={styles.statItem}>
              <Text3D style={styles.statLabel}>Games</Text3D>
              <Text3D style={styles.statValue}>
                {playerProfile.gamesPlayed}
              </Text3D>
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
            onPress={() => router.push("/under-construction")}
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
            ]}
            activeOpacity={0.85}
            onPress={() => router.push("/under-construction")}
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
            ]}
            activeOpacity={0.85}
            onPress={() => router.push("/under-construction")}
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
