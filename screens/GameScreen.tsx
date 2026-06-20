import ActionBar from "@/components/ActionBar";
import AnimatedCard from "@/components/AnimatedCard";
import PlayingCard from "@/components/Card";
import CenterZone from "@/components/CenterZone";
import PlayerHand from "@/components/PlayerHand";
import ResultModal from "@/components/ResultModal";
import Text3D from "@/components/Text3D";
import { useInterstitialAd } from "@/components/useInterstitialAd";
import {
  awardCurrentUserCredits,
  awardGuestCredits,
  incrementCurrentUserGamesPlayedFromBackend,
  isGuestSession,
} from "@/constants/auth";
import { BACKGROUNDS } from "@/constants/backgrounds";
import { CARD_BACKS } from "@/constants/cardbacks";
import {
  getQuickMatch,
  sendQuickMatchAction,
  type QuickMatchAction,
  type QuickMatchGame,
  type QuickMatchSession,
} from "@/constants/multiplayer";
import { getEmojiForPlayerIconId } from "@/constants/playerIcons";
import {
  getActiveBackgroundId,
  getActiveCardBackId,
  getActivePlayerIconId,
  getAiDifficulty,
  getTurnAlertMode,
  initializeProfileSettings,
  initializeSoundSettings,
  isSoundEnabled,
  isTutorialEnabled,
  subscribeAiDifficulty,
  subscribeBackgroundSettings,
  subscribeCardBackSettings,
  subscribePlayerIconSettings,
  subscribeSoundEnabled,
  subscribeTurnAlertMode,
  subscribeTutorialEnabled,
  type AiDifficulty,
  type TurnAlertMode,
} from "@/constants/settings";
import {
  aiDecide,
  aiDecideSwap,
  aiShouldStop,
  calcHandScore,
  Card,
  DiscardSource,
  GamePhase,
  makeDeck,
  Player,
  shuffle,
} from "@/game/logic";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type GameState = {
  deck: Card[];
  discard: Card[];
  players: Player[];
  turn: number;
  phase: GamePhase;
  drawnCard: Card | null;
  drawnFrom: DiscardSource;
  selectedHandIdx: number | null;
  movingCardIdx: number | null;
  message: string;
  gameOver: boolean;
  aiThinking: boolean;
  stopPending?: boolean;
};

function createInitialState(humanIcon = "🧑"): GameState {
  const deck = shuffle(makeDeck());
  const players: Player[] = [
    { name: "You", cards: deck.splice(0, 7), isHuman: true, icon: humanIcon },
    {
      name: "Player 2",
      cards: deck.splice(0, 7),
      isHuman: false,
      icon: "🤖",
    },
    {
      name: "Player 3",
      cards: deck.splice(0, 7),
      isHuman: false,
      icon: "🤖",
    },
  ];

  return {
    deck,
    discard: [],
    players,
    turn: 0,
    phase: "action",
    drawnCard: null,
    drawnFrom: null,
    selectedHandIdx: null,
    movingCardIdx: null,
    message: "",
    gameOver: false,
    aiThinking: false,
    stopPending: false,
  };
}

function createOnlineDisplayState(
  game: QuickMatchGame,
  viewerPlayerId: string,
  humanIcon = "🧑",
): GameState | null {
  if (game.players.length < 3) {
    return null;
  }

  const viewerIndex = game.players.findIndex(
    (player) => player.playerId === viewerPlayerId,
  );
  if (viewerIndex < 0) {
    return null;
  }

  const displayOrder = [
    viewerIndex,
    (viewerIndex + 1) % game.players.length,
    (viewerIndex + game.players.length - 1) % game.players.length,
  ];
  const currentTurnIndex = game.players.findIndex(
    (player) => player.playerId === game.currentTurnPlayerId,
  );
  const displayTurn = Math.max(0, displayOrder.indexOf(currentTurnIndex));
  const displayPlayers: Player[] = displayOrder.map((playerIndex, index) => {
    const player = game.players[playerIndex];
    return {
      name: index === 0 ? player.playerName || "You" : player.playerName,
      cards: player.cards,
      isHuman: index === 0,
      icon: index === 0 ? humanIcon : "👤",
    };
  });
  const turnPlayerName = displayPlayers[displayTurn]?.name ?? "Player";

  return {
    deck: game.deck,
    discard: game.discard,
    players: displayPlayers,
    turn: displayTurn,
    phase: game.phase,
    drawnCard: game.drawnCard,
    drawnFrom: game.drawnFrom,
    selectedHandIdx: null,
    movingCardIdx: null,
    message:
      game.message ||
      (displayTurn === 0 ? "Your turn." : `${turnPlayerName}'s turn.`),
    gameOver: game.gameOver,
    aiThinking: false,
    stopPending: false,
  };
}

function getOnlineDisplayOrder(
  game: QuickMatchGame,
  viewerPlayerId: string,
): number[] | null {
  const viewerIndex = game.players.findIndex(
    (player) => player.playerId === viewerPlayerId,
  );
  if (viewerIndex < 0 || game.players.length < 3) {
    return null;
  }

  return [
    viewerIndex,
    (viewerIndex + 1) % game.players.length,
    (viewerIndex + game.players.length - 1) % game.players.length,
  ];
}

function getWinnerIndex(players: Player[]): number {
  let winnerIdx = 0;
  let bestScore = calcHandScore(players[0].cards);

  for (let i = 1; i < players.length; i++) {
    const score = calcHandScore(players[i].cards);
    if (score < bestScore) {
      bestScore = score;
      winnerIdx = i;
    }
  }

  return winnerIdx;
}

export default function GameScreen(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    matchId?: string;
    playerId?: string;
    bet?: string;
  }>();
  const insets = useSafeAreaInsets();
  const onlineMatchId =
    typeof params.matchId === "string" ? params.matchId : undefined;
  const onlinePlayerId =
    typeof params.playerId === "string" ? params.playerId : undefined;
  const onlineBet = React.useMemo(() => {
    const parsed = Number.parseInt(
      typeof params.bet === "string" ? params.bet : "",
      10,
    );
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [params.bet]);
  const isOnlineMode =
    params.mode === "online" && Boolean(onlineMatchId && onlinePlayerId);
  const [activeBackgroundId, setActiveBackgroundId] = useState(
    getActiveBackgroundId(),
  );
  const [activeCardBackId, setActiveCardBackId] = useState(
    getActiveCardBackId(),
  );
  const [activePlayerIconId, setActivePlayerIconId] = useState(
    getActivePlayerIconId(),
  );
  const MATCH_WINS_TO_WIN = 3;
  const SHUFFLE_SOUND_SOURCE = require("../assets/audio/shuffle.mp3");
  const SWAP_SOUND_SOURCE = require("../assets/audio/swap.mp3");
  const CARD_MOVE_DURATION_MS = 1400;
  const CARD_MOVE_CLEANUP_MS = 1500;
  const AI_TURN_DELAY_AFTER_ANIMATION_MS = 2000;
  const HAND_REORDER_DURATION_MS = 550;
  const HAND_REORDER_CLEANUP_MS = 650;
  const SHUFFLE_PASS_COUNT = 10;
  const SHUFFLE_MOVE_DURATION_MS = 300;
  const SHUFFLE_GAP_MS = 70;
  const SHUFFLE_AUDIO_BASE_RATE = 1.08;
  const SWAP_AUDIO_RATE = 1.92;
  const SWAP_AUDIO_VARIANCE = 0.1;
  const SWAP_DOUBLE_HIT_DELAY_MS = 45;
  const ANIM_CARD_HALF_WIDTH = 30;
  const ANIM_CARD_HALF_HEIGHT = 44;
  const WINNER_REVEAL_DURATION_SECONDS = 15;
  const DECK_TOAST_STEP = 7;
  const DECK_TOAST_FADE_MS = 220;
  const DECK_TOAST_VISIBLE_MS = 5000;
  const SHUFFLE_STEP_MS = SHUFFLE_MOVE_DURATION_MS + SHUFFLE_GAP_MS;
  const HAND_REVEAL_STAGGER_MS = 130;
  const [state, setState] = useState<GameState>(() =>
    createInitialState(getEmojiForPlayerIconId(getActivePlayerIconId())),
  );
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(isSoundEnabled());
  const [tutorialEnabled, setTutorialEnabled] =
    useState<boolean>(isTutorialEnabled());
  const [turnAlertMode, setTurnAlertMode] =
    useState<TurnAlertMode>(getTurnAlertMode());
  const [aiDifficulty, setAiDifficulty] =
    useState<AiDifficulty>(getAiDifficulty());
  const [matchWins, setMatchWins] = useState<number[]>([0, 0, 0]);
  const [matchWinnerIdx, setMatchWinnerIdx] = useState<number | null>(null);
  const [isShuffling, setIsShuffling] = useState<boolean>(true);
  const [revealedHumanCount, setRevealedHumanCount] = useState<number>(0);
  const [showWinnerReveal, setShowWinnerReveal] = useState<boolean>(false);
  const [resultModalVisible, setResultModalVisible] = useState<boolean>(false);
  const { showAd: showInterstitialAd } = useInterstitialAd();
  const [winnerRevealCountdown, setWinnerRevealCountdown] = useState<number>(
    WINNER_REVEAL_DURATION_SECONDS,
  );
  const [deckToastMessage, setDeckToastMessage] = useState<string | null>(null);
  const [animatedCards, setAnimatedCards] = useState<
    Array<{
      id: string;
      card: Card;
      faceDown?: boolean;
      rotateZ?: string;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    }>
  >([]);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerHandOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const player2WrapperRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({ x: 0, y: 0, width: 120, height: 100 });
  const player3WrapperRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({ x: 0, y: 0, width: 120, height: 100 });
  const topRowOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const centerPanelOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const deckSlotPosRef = useRef<{ x: number; y: number }>({ x: 20, y: 40 });
  const discardSlotPosRef = useRef<{ x: number; y: number }>({ x: 160, y: 40 });
  const firstSelectedCardPosRef = useRef<{ x: number; y: number } | null>(null);
  const selectedSwapCardPosRef = useRef<{ x: number; y: number } | null>(null);
  const shuffleTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const swapSoundTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const roundScoredRef = useRef<boolean>(false);
  const shuffleRunIdRef = useRef<number>(0);
  const deckToastAnimRef = useRef(new Animated.Value(0));
  const deckToastRunIdRef = useRef<number>(0);
  const initialDeckCountRef = useRef<number>(state.deck.length);
  const deckToastStepReachedRef = useRef<number>(0);
  const wasMyTurnRef = useRef<boolean>(false);
  const winnerRevealIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const winnerRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const handTooltipResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const gameRecordedForRoundRef = useRef<boolean>(false);
  const onlineBetSettledRef = useRef<boolean>(false);
  const shuffleAudio = useAudioPlayer(SHUFFLE_SOUND_SOURCE, {
    downloadFirst: true,
    keepAudioSessionActive: true,
  });
  const shuffleAudioStatus = useAudioPlayerStatus(shuffleAudio);
  const swapAudio = useAudioPlayer(SWAP_SOUND_SOURCE, {
    downloadFirst: true,
    keepAudioSessionActive: true,
  });
  const swapAudioStatus = useAudioPlayerStatus(swapAudio);

  useEffect(() => {
    shuffleAudio.volume = soundEnabled ? 0.95 : 0;
    shuffleAudio.loop = false;
    shuffleAudio.setPlaybackRate(SHUFFLE_AUDIO_BASE_RATE);
    if (!soundEnabled) {
      try {
        shuffleAudio.pause();
      } catch {
        // Ignore pause errors for unloaded states.
      }
    }
  }, [shuffleAudio, soundEnabled]);

  useEffect(() => {
    swapAudio.volume = soundEnabled ? 0.82 : 0;
    swapAudio.loop = false;
    swapAudio.setPlaybackRate(SWAP_AUDIO_RATE);
  }, [swapAudio, soundEnabled]);

  useEffect(() => {
    void initializeSoundSettings();
    void initializeProfileSettings();
    const unsubscribeSound = subscribeSoundEnabled((enabled) => {
      setSoundEnabled(enabled);
    });

    const unsubscribeTurnAlertMode = subscribeTurnAlertMode((mode) => {
      setTurnAlertMode(mode);
    });

    const unsubscribeAiDifficulty = subscribeAiDifficulty((mode) => {
      setAiDifficulty(mode);
    });

    const unsubscribeTutorial = subscribeTutorialEnabled((enabled) => {
      setTutorialEnabled(enabled);
    });

    return () => {
      unsubscribeSound();
      unsubscribeTurnAlertMode();
      unsubscribeAiDifficulty();
      unsubscribeTutorial();
    };
  }, []);

  useEffect(() => {
    setActiveBackgroundId(getActiveBackgroundId());
    const unsubscribe = subscribeBackgroundSettings(() => {
      setActiveBackgroundId(getActiveBackgroundId());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    setActiveCardBackId(getActiveCardBackId());
    const unsubscribe = subscribeCardBackSettings(() => {
      setActiveCardBackId(getActiveCardBackId());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    setActivePlayerIconId(getActivePlayerIconId());
    const unsubscribe = subscribePlayerIconSettings(() => {
      setActivePlayerIconId(getActivePlayerIconId());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const humanIcon = getEmojiForPlayerIconId(activePlayerIconId);
    setState((prev) => {
      const nextPlayers = prev.players.map((player, index) =>
        index === 0 ? { ...player, icon: humanIcon } : player,
      );

      return {
        ...prev,
        players: nextPlayers,
      };
    });
  }, [activePlayerIconId]);

  const activeBackground =
    BACKGROUNDS.find((item) => item.id === activeBackgroundId) ??
    BACKGROUNDS[0];
  const activeCardBack =
    CARD_BACKS.find((item) => item.id === activeCardBackId) ?? CARD_BACKS[0];
  const sharedCardBackColor = activeCardBack.color;

  const applyOnlineSession = useCallback(
    (session: QuickMatchSession | null) => {
      if (!session?.game || !onlinePlayerId) {
        return;
      }

      const nextState = createOnlineDisplayState(
        session.game,
        onlinePlayerId,
        getEmojiForPlayerIconId(activePlayerIconId),
      );
      if (!nextState) {
        setOnlineError("Unable to load this online game.");
        return;
      }

      const displayOrder = getOnlineDisplayOrder(session.game, onlinePlayerId);
      if (displayOrder) {
        setMatchWins(
          displayOrder.map((playerIndex) => session.game?.matchWins[playerIndex] ?? 0),
        );
        const matchWinnerServerIndex = session.game.players.findIndex(
          (player) => player.playerId === session.game?.matchWinnerPlayerId,
        );
        const matchWinnerDisplayIndex =
          matchWinnerServerIndex >= 0
            ? displayOrder.indexOf(matchWinnerServerIndex)
            : -1;
        setMatchWinnerIdx(
          matchWinnerDisplayIndex >= 0 ? matchWinnerDisplayIndex : null,
        );
      }

      setState((prev) => ({
        ...nextState,
        selectedHandIdx:
          prev.phase === nextState.phase && prev.turn === nextState.turn
            ? prev.selectedHandIdx
            : null,
      }));
      setIsShuffling(false);
      setRevealedHumanCount(Number.MAX_SAFE_INTEGER);
      setOnlineError(null);
    },
    [activePlayerIconId, onlinePlayerId],
  );

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  useEffect(() => {
    const deckToastAnim = deckToastAnimRef.current;

    if (isShuffling) {
      initialDeckCountRef.current = state.deck.length;
      deckToastStepReachedRef.current = 0;
      deckToastRunIdRef.current += 1;
      deckToastAnim.stopAnimation();
      deckToastAnim.setValue(0);
      if (deckToastMessage !== null) {
        setDeckToastMessage(null);
      }
      return;
    }

    const cardsUsed = Math.max(
      0,
      initialDeckCountRef.current - state.deck.length,
    );
    const reachedStep = Math.floor(cardsUsed / DECK_TOAST_STEP);
    if (reachedStep <= deckToastStepReachedRef.current) return;

    deckToastStepReachedRef.current = reachedStep;
    if (state.deck.length <= 0) return;

    const runId = deckToastRunIdRef.current + 1;
    deckToastRunIdRef.current = runId;
    setDeckToastMessage(`${state.deck.length} cards left in deck`);
    deckToastAnim.stopAnimation();
    deckToastAnim.setValue(0);

    Animated.sequence([
      Animated.timing(deckToastAnim, {
        toValue: 1,
        duration: DECK_TOAST_FADE_MS,
        useNativeDriver: true,
      }),
      Animated.delay(DECK_TOAST_VISIBLE_MS),
      Animated.timing(deckToastAnim, {
        toValue: 0,
        duration: DECK_TOAST_FADE_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      if (deckToastRunIdRef.current !== runId) return;
      setDeckToastMessage(null);
    });
  }, [deckToastMessage, isShuffling, state.deck.length]);

  const stopShuffleAudio = useCallback(() => {
    try {
      shuffleAudio.pause();
      shuffleAudio.seekTo(0);
    } catch {
      // Ignore stop errors from unloaded/idle player states.
    }
  }, [shuffleAudio]);

  const playSwapAudio = useCallback(() => {
    try {
      if (!soundEnabled) return;
      if (!swapAudioStatus.isLoaded) return;
      const jitter = (Math.random() * 2 - 1) * SWAP_AUDIO_VARIANCE;
      swapAudio.setPlaybackRate(SWAP_AUDIO_RATE + jitter);
      swapAudio.seekTo(0);
      swapAudio.play();

      const timer = setTimeout(() => {
        try {
          if (!swapAudioStatus.isLoaded) return;
          swapAudio.setPlaybackRate(SWAP_AUDIO_RATE - 0.14 + jitter * 0.5);
          swapAudio.seekTo(0);
          swapAudio.play();
        } catch {
          // Ignore transient playback errors.
        }
      }, SWAP_DOUBLE_HIT_DELAY_MS);
      swapSoundTimersRef.current.push(timer);
    } catch {
      // Ignore transient playback errors.
    }
  }, [soundEnabled, swapAudio, swapAudioStatus.isLoaded]);

  const clearShuffleTimers = useCallback(() => {
    shuffleRunIdRef.current += 1;
    shuffleTimersRef.current.forEach((timer) => clearTimeout(timer));
    shuffleTimersRef.current = [];
    swapSoundTimersRef.current.forEach((timer) => clearTimeout(timer));
    swapSoundTimersRef.current = [];
    stopShuffleAudio();
  }, [stopShuffleAudio]);

  const clearWinnerRevealTimers = useCallback(() => {
    if (winnerRevealIntervalRef.current) {
      clearInterval(winnerRevealIntervalRef.current);
      winnerRevealIntervalRef.current = null;
    }
    if (winnerRevealTimeoutRef.current) {
      clearTimeout(winnerRevealTimeoutRef.current);
      winnerRevealTimeoutRef.current = null;
    }
  }, []);

  const revealResultModal = useCallback(() => {
    setResultModalVisible(true);
    setWinnerRevealCountdown(WINNER_REVEAL_DURATION_SECONDS);
  }, [WINNER_REVEAL_DURATION_SECONDS]);

  const openResultModal = useCallback(() => {
    clearWinnerRevealTimers();
    setShowWinnerReveal(false);
    // Play a full-screen video (interstitial) ad before revealing the result
    // modal. If ads are unavailable or none is loaded yet, the result modal
    // opens immediately.
    showInterstitialAd(revealResultModal);
  }, [clearWinnerRevealTimers, revealResultModal, showInterstitialAd]);

  const runStartShuffleAnimation = useCallback(() => {
    clearShuffleTimers();
    const runId = shuffleRunIdRef.current + 1;
    shuffleRunIdRef.current = runId;
    setIsShuffling(true);
    setRevealedHumanCount(0);
    setAnimatedCards([]);

    try {
      if (soundEnabled && shuffleAudioStatus.isLoaded) {
        shuffleAudio.seekTo(0);
        shuffleAudio.play();
      }
    } catch {
      // Ignore startup audio errors; per-pass bursts retry playback.
    }

    const fullDeck = makeDeck();
    const deckX =
      topRowOriginRef.current.x +
      centerPanelOriginRef.current.x +
      deckSlotPosRef.current.x -
      ANIM_CARD_HALF_WIDTH;
    const deckY =
      topRowOriginRef.current.y +
      centerPanelOriginRef.current.y +
      deckSlotPosRef.current.y -
      ANIM_CARD_HALF_HEIGHT;

    for (let i = 0; i < SHUFFLE_PASS_COUNT; i++) {
      const spawnTimer = setTimeout(() => {
        if (shuffleRunIdRef.current !== runId) return;
        try {
          if (soundEnabled && shuffleAudioStatus.isLoaded) {
            shuffleAudio.setPlaybackRate(
              SHUFFLE_AUDIO_BASE_RATE + (i % 3) * 0.02,
            );
            shuffleAudio.seekTo(0);
            shuffleAudio.play();
          }
        } catch {
          // Ignore burst playback errors.
        }

        const leftCard = fullDeck[(i * 7 + 3) % fullDeck.length];
        const rightCard = fullDeck[(i * 7 + 27) % fullDeck.length];
        const sourceSpread = 92;
        const sourceYJitter = ((i % 3) - 1) * 10;
        const centerOffset = (i % 2 === 0 ? -1 : 1) * 7;
        const leftId = `shuffle-left-${Date.now()}-${i}`;
        const rightId = `shuffle-right-${Date.now()}-${i}`;

        setAnimatedCards((prev) => [
          ...prev,
          {
            id: leftId,
            card: leftCard,
            faceDown: true,
            rotateZ: "-16deg",
            fromX: deckX - sourceSpread,
            fromY: deckY + sourceYJitter,
            toX: deckX + centerOffset,
            toY: deckY + ((i % 2) * 6 - 3),
          },
          {
            id: rightId,
            card: rightCard,
            faceDown: true,
            rotateZ: "16deg",
            fromX: deckX + sourceSpread,
            fromY: deckY - sourceYJitter,
            toX: deckX - centerOffset,
            toY: deckY + (((i + 1) % 2) * 6 - 3),
          },
        ]);

        const cleanupTimer = setTimeout(() => {
          if (shuffleRunIdRef.current !== runId) return;
          setAnimatedCards((prev) =>
            prev.filter((ac) => ac.id !== leftId && ac.id !== rightId),
          );
        }, SHUFFLE_MOVE_DURATION_MS);
        shuffleTimersRef.current.push(cleanupTimer);
      }, i * SHUFFLE_STEP_MS);

      shuffleTimersRef.current.push(spawnTimer);
    }

    const revealStartDelay = SHUFFLE_PASS_COUNT * SHUFFLE_STEP_MS;
    for (let i = 0; i < 7; i++) {
      const revealTimer = setTimeout(
        () => {
          if (shuffleRunIdRef.current !== runId) return;
          setRevealedHumanCount(i + 1);
        },
        revealStartDelay + i * HAND_REVEAL_STAGGER_MS,
      );
      shuffleTimersRef.current.push(revealTimer);
    }

    const doneTimer = setTimeout(
      () => {
        if (shuffleRunIdRef.current !== runId) return;
        setAnimatedCards([]);
        setIsShuffling(false);
        stopShuffleAudio();
      },
      revealStartDelay + 7 * HAND_REVEAL_STAGGER_MS,
    );
    shuffleTimersRef.current.push(doneTimer);
  }, [
    clearShuffleTimers,
    soundEnabled,
    shuffleAudio,
    shuffleAudioStatus.isLoaded,
    stopShuffleAudio,
  ]);

  useEffect(() => {
    if (isOnlineMode) {
      clearShuffleTimers();
      setIsShuffling(false);
      setRevealedHumanCount(Number.MAX_SAFE_INTEGER);
      return;
    }

    const startTimer = setTimeout(() => {
      runStartShuffleAnimation();
    }, 120);
    shuffleTimersRef.current.push(startTimer);

    return () => {
      clearShuffleTimers();
    };
  }, [clearShuffleTimers, isOnlineMode, runStartShuffleAnimation]);

  useEffect(() => {
    if (!isOnlineMode || !onlineMatchId) {
      return;
    }

    let cancelled = false;
    const loadSession = async (): Promise<void> => {
      const session = await getQuickMatch(onlineMatchId);
      if (cancelled) {
        return;
      }

      if (!session) {
        setOnlineError("Unable to load online match.");
        return;
      }

      applyOnlineSession(session);
    };

    void loadSession();
    const interval = setInterval(() => {
      void loadSession();
    }, 1200);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [applyOnlineSession, isOnlineMode, onlineMatchId]);

  useEffect(() => {
    if (isOnlineMode) {
      return;
    }

    if (!state.gameOver) {
      roundScoredRef.current = false;
      return;
    }

    if (roundScoredRef.current) return;
    roundScoredRef.current = true;

    const winnerIdx = getWinnerIndex(state.players);

    setMatchWins((prev) => {
      const next = prev.slice();
      next[winnerIdx] += 1;
      if (next[winnerIdx] >= MATCH_WINS_TO_WIN) {
        setMatchWinnerIdx(winnerIdx);
      }
      return next;
    });
  }, [MATCH_WINS_TO_WIN, isOnlineMode, state.gameOver, state.players]);

  useEffect(() => {
    if (!state.gameOver) {
      gameRecordedForRoundRef.current = false;
      clearWinnerRevealTimers();
      setShowWinnerReveal(false);
      setResultModalVisible(false);
      setWinnerRevealCountdown(WINNER_REVEAL_DURATION_SECONDS);
      return;
    }

    setResultModalVisible(false);
    setShowWinnerReveal(true);
    setWinnerRevealCountdown(WINNER_REVEAL_DURATION_SECONDS);
    clearWinnerRevealTimers();

    winnerRevealIntervalRef.current = setInterval(() => {
      setWinnerRevealCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    winnerRevealTimeoutRef.current = setTimeout(() => {
      openResultModal();
    }, WINNER_REVEAL_DURATION_SECONDS * 1000);

    return () => {
      clearWinnerRevealTimers();
    };
  }, [
    WINNER_REVEAL_DURATION_SECONDS,
    clearWinnerRevealTimers,
    isOnlineMode,
    openResultModal,
    state.gameOver,
  ]);

  const recordCurrentGameStats = useCallback(() => {
    const shouldRecordNow = matchWinnerIdx !== null;
    if (
      isOnlineMode ||
      !state.gameOver ||
      gameRecordedForRoundRef.current ||
      !shouldRecordNow
    ) {
      return;
    }

    const winnerIdx = getWinnerIndex(state.players);
    const matchWinner = matchWinnerIdx ?? winnerIdx;
    const won = matchWinner === 0;

    gameRecordedForRoundRef.current = true;
    void incrementCurrentUserGamesPlayedFromBackend(won);
  }, [isOnlineMode, matchWinnerIdx, state.gameOver, state.players]);

  useEffect(() => {
    recordCurrentGameStats();
  }, [recordCurrentGameStats]);

  useEffect(() => {
    if (!isOnlineMode) {
      onlineBetSettledRef.current = false;
      return;
    }

    if (matchWinnerIdx === null) {
      onlineBetSettledRef.current = false;
      return;
    }

    if (onlineBetSettledRef.current) {
      return;
    }
    onlineBetSettledRef.current = true;

    if (onlineBet <= 0) {
      return;
    }

    const winnerIsCurrentUser = matchWinnerIdx === 0;
    if (!winnerIsCurrentUser) {
      return;
    }

    const payoutAmount = onlineBet * 2;
    void (async () => {
      const guest = await isGuestSession();
      if (guest) {
        await awardGuestCredits(payoutAmount);
        return;
      }
      await awardCurrentUserCredits(payoutAmount);
    })();
  }, [isOnlineMode, matchWinnerIdx, onlineBet]);

  const endGame = useCallback((message: string) => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    setState((prev) => ({
      ...prev,
      gameOver: true,
      message,
      aiThinking: false,
      stopPending: false,
    }));
  }, []);

  const submitOnlineAction = useCallback(
    async (action: QuickMatchAction) => {
      if (!onlineMatchId || !onlinePlayerId) {
        return;
      }

      const session = await sendQuickMatchAction(
        onlineMatchId,
        onlinePlayerId,
        action,
      );
      if (!session) {
        setOnlineError("Unable to send move. Please try again.");
        return;
      }

      applyOnlineSession(session);
    },
    [applyOnlineSession, onlineMatchId, onlinePlayerId],
  );

  const runAiTurn = useCallback(
    (pidx: number) => {
      setState((prev) => {
        if (prev.gameOver) return prev;

        const player = prev.players[pidx];
        const currentOpponentHands = prev.players
          .filter((_, idx) => idx !== pidx)
          .map((p) => p.cards);

        if (
          aiShouldStop(player.cards, {
            difficulty: aiDifficulty,
            opponentHands: currentOpponentHands,
          })
        ) {
          const currentScore = calcHandScore(player.cards);
          return {
            ...prev,
            gameOver: true,
            aiThinking: false,
            message: `${player.name} stopped immediately with a winning hand (score ${currentScore})!`,
          };
        }

        const discardTop =
          prev.discard.length > 0
            ? prev.discard[prev.discard.length - 1]
            : null;
        const newDeck = prev.deck.slice();
        const deckPreview = [
          newDeck[newDeck.length - 1],
          newDeck[newDeck.length - 2],
        ].filter((card): card is Card => Boolean(card));
        const decision = aiDecide(player.cards, discardTop, {
          difficulty: aiDifficulty,
          deckPreview,
        });

        const newDiscard = prev.discard.slice();
        const newPlayers = prev.players.map((p) => ({
          ...p,
          cards: p.cards.slice(),
        }));
        let message = "";
        let discardedCard: Card | null = null;
        let incomingCard: Card | null = null;
        let incomingSource: "deck" | "discard" | null = null;

        if (decision.action === "takeDiscard") {
          const taken = newDiscard.pop() as Card;
          incomingCard = taken;
          incomingSource = "discard";
          const discarded = newPlayers[pidx].cards.splice(
            decision.swapIdx,
            1,
            taken,
          )[0];
          discardedCard = discarded;
          newDiscard.push(discarded);
          message = `${player.name} took the discard and swapped a card.`;
        } else {
          if (newDeck.length === 0) {
            return {
              ...prev,
              gameOver: true,
              message: "Deck is empty — game over!",
              aiThinking: false,
            };
          }
          const drawn = newDeck.pop() as Card;
          const swapIdx = aiDecideSwap(newPlayers[pidx].cards, drawn, {
            difficulty: aiDifficulty,
          });
          if (swapIdx >= 0) {
            incomingCard = drawn;
            incomingSource = "deck";
            const discarded = newPlayers[pidx].cards.splice(
              swapIdx,
              1,
              drawn,
            )[0];
            discardedCard = discarded;
            newDiscard.push(discarded);
            message = `${player.name} drew and swapped a card.`;
          } else {
            newDiscard.push(drawn);
            message = `${player.name} drew and kept their hand.`;
          }
        }

        // Trigger animation if a card was discarded
        if (discardedCard) {
          playSwapAudio();
          const animId = `${discardedCard.suit}${discardedCard.rank}-${Date.now()}`;
          const aiWrapper =
            pidx === 1 ? player2WrapperRef.current : player3WrapperRef.current;
          const handTargetX =
            topRowOriginRef.current.x + aiWrapper.x + aiWrapper.width * 0.5;
          const handTargetY =
            topRowOriginRef.current.y + aiWrapper.y + aiWrapper.height * 0.55;
          const discardTargetX =
            topRowOriginRef.current.x +
            centerPanelOriginRef.current.x +
            discardSlotPosRef.current.x -
            ANIM_CARD_HALF_WIDTH;
          const discardTargetY =
            topRowOriginRef.current.y +
            centerPanelOriginRef.current.y +
            discardSlotPosRef.current.y -
            ANIM_CARD_HALF_HEIGHT;
          setAnimatedCards((prev) => [
            ...prev,
            {
              id: animId,
              card: discardedCard,
              fromX: handTargetX,
              fromY: handTargetY,
              toX: discardTargetX,
              toY: discardTargetY,
            },
          ]);

          if (incomingCard && incomingSource) {
            const incomingAnimId = `${incomingCard.suit}${incomingCard.rank}-incoming-ai-${Date.now()}`;
            const sourceX =
              topRowOriginRef.current.x +
              centerPanelOriginRef.current.x +
              (incomingSource === "deck"
                ? deckSlotPosRef.current.x - ANIM_CARD_HALF_WIDTH
                : discardSlotPosRef.current.x - ANIM_CARD_HALF_WIDTH);
            const sourceY =
              topRowOriginRef.current.y +
              centerPanelOriginRef.current.y +
              (incomingSource === "deck"
                ? deckSlotPosRef.current.y - ANIM_CARD_HALF_HEIGHT
                : discardSlotPosRef.current.y - ANIM_CARD_HALF_HEIGHT);

            setAnimatedCards((prev) => [
              ...prev,
              {
                id: incomingAnimId,
                card: incomingCard,
                fromX: sourceX,
                fromY: sourceY,
                toX: handTargetX,
                toY: handTargetY,
              },
            ]);

            setTimeout(() => {
              setAnimatedCards((prev) =>
                prev.filter((ac) => ac.id !== incomingAnimId),
              );
            }, CARD_MOVE_CLEANUP_MS);
          }

          setTimeout(() => {
            setAnimatedCards((prev) => prev.filter((ac) => ac.id !== animId));
          }, CARD_MOVE_CLEANUP_MS);
        }

        const nextOpponentHands = newPlayers
          .filter((_, idx) => idx !== pidx)
          .map((p) => p.cards);

        if (
          aiShouldStop(newPlayers[pidx].cards, {
            difficulty: aiDifficulty,
            opponentHands: nextOpponentHands,
          })
        ) {
          const newScore = calcHandScore(newPlayers[pidx].cards);
          return {
            ...prev,
            deck: newDeck,
            discard: newDiscard,
            players: newPlayers,
            gameOver: true,
            aiThinking: false,
            message: `${player.name} stopped the game with a score of ${newScore}!`,
          };
        }

        const nextTurn = (pidx + 1) % 3;
        const isNextHuman = nextTurn === 0;
        const hasAnimation = discardedCard !== null;

        if (newDeck.length === 0) {
          return {
            ...prev,
            deck: newDeck,
            discard: newDiscard,
            players: newPlayers,
            gameOver: true,
            aiThinking: false,
            message: "Deck is empty — game over!",
          };
        }

        const nextState: GameState = {
          ...prev,
          deck: newDeck,
          discard: newDiscard,
          players: newPlayers,
          turn: nextTurn,
          phase: "action",
          message: isNextHuman
            ? `${message} Your turn!`
            : `${message} ${prev.players[nextTurn].name} is thinking…`,
          aiThinking: !isNextHuman,
          drawnCard: null,
          drawnFrom: null,
          selectedHandIdx: null,
          movingCardIdx: null,
          gameOver: false,
        };

        if (hasAnimation) {
          const nextPlayerMessage = isNextHuman
            ? `${message} Your turn!`
            : `${message} ${newPlayers[nextTurn].name} is thinking…`;

          setTimeout(() => {
            setState((current) => {
              if (current.gameOver) return current;
              return {
                ...current,
                deck: newDeck,
                discard: newDiscard,
                players: newPlayers,
                turn: nextTurn,
                phase: "action",
                message: nextPlayerMessage,
                aiThinking: !isNextHuman,
                drawnCard: null,
                drawnFrom: null,
                selectedHandIdx: null,
                movingCardIdx: null,
                gameOver: false,
              };
            });
          }, CARD_MOVE_CLEANUP_MS + AI_TURN_DELAY_AFTER_ANIMATION_MS);

          if (!isNextHuman) {
            aiTimerRef.current = setTimeout(
              () => runAiTurn(nextTurn),
              CARD_MOVE_CLEANUP_MS + AI_TURN_DELAY_AFTER_ANIMATION_MS * 2,
            );
          }

          return {
            ...prev,
            deck: newDeck,
            discard: newDiscard,
            players: newPlayers,
            turn: pidx,
            phase: "action",
            message,
            aiThinking: true,
            drawnCard: null,
            drawnFrom: null,
            selectedHandIdx: null,
            movingCardIdx: null,
            gameOver: false,
          };
        }

        if (!isNextHuman) {
          aiTimerRef.current = setTimeout(
            () => runAiTurn(nextTurn),
            AI_TURN_DELAY_AFTER_ANIMATION_MS,
          );
        }

        return nextState;
      });
    },
    [aiDifficulty, playSwapAudio],
  );

  const handleDrawDeck = useCallback(() => {
    if (isOnlineMode) {
      void submitOnlineAction({ action: "DRAW_DECK" });
      return;
    }

    selectedSwapCardPosRef.current = null;
    setState((prev) => {
      if (prev.phase !== "action" || prev.turn !== 0 || prev.deck.length === 0)
        return prev;
      const newDeck = prev.deck.slice();
      const drawn = newDeck.pop() as Card;
      return {
        ...prev,
        deck: newDeck,
        drawnCard: drawn,
        drawnFrom: "deck",
        phase: "drawn",
        selectedHandIdx: null,
        movingCardIdx: null,
        message:
          "Card drawn! Double tap a hand card to swap, or keep your hand.",
      };
    });
  }, [isOnlineMode, submitOnlineAction]);

  const handleTakeDiscard = useCallback(() => {
    if (isOnlineMode) {
      void submitOnlineAction({ action: "TAKE_DISCARD" });
      return;
    }

    selectedSwapCardPosRef.current = null;
    setState((prev) => {
      if (
        prev.phase !== "action" ||
        prev.turn !== 0 ||
        prev.discard.length === 0
      )
        return prev;
      const newDiscard = prev.discard.slice();
      const taken = newDiscard.pop() as Card;
      return {
        ...prev,
        discard: newDiscard,
        drawnCard: taken,
        drawnFrom: "discard",
        phase: "drawn",
        selectedHandIdx: null,
        movingCardIdx: null,
        message: "You took the discard! Double tap a hand card to swap.",
      };
    });
  }, [isOnlineMode, submitOnlineAction]);

  const handleSelectCard = useCallback(
    (idx: number, cardPos?: { x: number; y: number }) => {
      setState((prev) => {
        // During drawn phase: select card for swap
        if (prev.phase === "drawn" && prev.turn === 0) {
          const nextSelectedIdx = prev.selectedHandIdx === idx ? null : idx;
          selectedSwapCardPosRef.current =
            nextSelectedIdx === null ? null : (cardPos ?? null);
          return {
            ...prev,
            selectedHandIdx: nextSelectedIdx,
          };
        }

        // During action phase: reorder cards
        if (prev.phase === "action" && prev.turn === 0) {
          const movingIdx = prev.movingCardIdx;

          // If no card is being moved, start moving this card
          if (movingIdx === null) {
            firstSelectedCardPosRef.current = cardPos ?? null;
            return {
              ...prev,
              movingCardIdx: idx,
            };
          }

          // If clicking the same card, cancel
          if (movingIdx === idx) {
            firstSelectedCardPosRef.current = null;
            return {
              ...prev,
              movingCardIdx: null,
            };
          }

          // Keep current selection on single tap; swapping is handled on double tap.
          return prev;
        }

        return prev;
      });
    },
    [],
  );

  const swapHumanCards = useCallback(
    (
      fromIdx: number,
      toIdx: number,
      fromPos?: { x: number; y: number },
      toPos?: { x: number; y: number },
    ) => {
      if (fromIdx === toIdx) {
        firstSelectedCardPosRef.current = null;
        return;
      }

      if (isOnlineMode) {
        firstSelectedCardPosRef.current = null;
        void submitOnlineAction({
          action: "REORDER",
          cardIndex: fromIdx,
          targetIndex: toIdx,
        });
        return;
      }

      setState((prev) => {
        if (prev.phase !== "action" || prev.turn !== 0 || prev.gameOver) {
          return prev;
        }

        playSwapAudio();

        const newPlayers = prev.players.map((p) => ({
          ...p,
          cards: p.cards.slice(),
        }));
        const card = newPlayers[0].cards[fromIdx];
        const reorderAnimId = `${card.suit}${card.rank}-reorder-${Date.now()}`;
        const startPos = fromPos ?? firstSelectedCardPosRef.current;

        if (startPos && toPos) {
          setAnimatedCards((prevCards) => [
            ...prevCards,
            {
              id: reorderAnimId,
              card,
              fromX: playerHandOriginRef.current.x + startPos.x,
              fromY: playerHandOriginRef.current.y + startPos.y,
              toX: playerHandOriginRef.current.x + toPos.x,
              toY: playerHandOriginRef.current.y + toPos.y,
            },
          ]);
        }

        setTimeout(() => {
          setAnimatedCards((prevCards) =>
            prevCards.filter((ac) => ac.id !== reorderAnimId),
          );
        }, HAND_REORDER_CLEANUP_MS);

        const temp = newPlayers[0].cards[toIdx];
        newPlayers[0].cards[toIdx] = card;
        newPlayers[0].cards[fromIdx] = temp;
        firstSelectedCardPosRef.current = null;

        return {
          ...prev,
          players: newPlayers,
          movingCardIdx: null,
        };
      });
    },
    [isOnlineMode, playSwapAudio, submitOnlineAction],
  );

  const handleSwap = useCallback(
    (forcedIdx?: number, forcedCardPos?: { x: number; y: number }) => {
      if (isOnlineMode) {
        const swapIdx = forcedIdx ?? state.selectedHandIdx;
        if (swapIdx === null || !state.drawnCard) return;
        selectedSwapCardPosRef.current = null;
        void submitOnlineAction({ action: "SWAP", cardIndex: swapIdx });
        return;
      }

      setState((prev) => {
        const swapIdx = forcedIdx ?? prev.selectedHandIdx;
        if (swapIdx === null || !prev.drawnCard) return prev;
        playSwapAudio();
        const swappedInCard = prev.drawnCard;
        const incomingFromDeck = prev.drawnFrom === "deck";
        const newPlayers = prev.players.map((p) => ({
          ...p,
          cards: p.cards.slice(),
        }));
        const discarded = newPlayers[0].cards.splice(
          swapIdx,
          1,
          prev.drawnCard,
        )[0];
        const newDiscard = [...prev.discard, discarded];

        // Trigger animation for discarded card
        const animId = `${discarded.suit}${discarded.rank}-${Date.now()}`;
        if (forcedCardPos) {
          selectedSwapCardPosRef.current = forcedCardPos;
        }
        const selectedPos = selectedSwapCardPosRef.current;
        setAnimatedCards((prevCards) => [
          ...prevCards,
          {
            id: animId,
            card: discarded,
            fromX: selectedPos
              ? playerHandOriginRef.current.x + selectedPos.x
              : 0,
            fromY: selectedPos
              ? playerHandOriginRef.current.y + selectedPos.y
              : 150,
            toX:
              topRowOriginRef.current.x +
              centerPanelOriginRef.current.x +
              discardSlotPosRef.current.x -
              ANIM_CARD_HALF_WIDTH,
            toY:
              topRowOriginRef.current.y +
              centerPanelOriginRef.current.y +
              discardSlotPosRef.current.y -
              ANIM_CARD_HALF_HEIGHT,
          },
        ]);

        setTimeout(() => {
          setAnimatedCards((prevCards) =>
            prevCards.filter((ac) => ac.id !== animId),
          );
        }, CARD_MOVE_CLEANUP_MS);

        if (incomingFromDeck) {
          const toPos = selectedSwapCardPosRef.current;
          const incomingAnimId = `${swappedInCard.suit}${swappedInCard.rank}-incoming-${Date.now()}`;
          if (toPos) {
            setAnimatedCards((prevCards) => [
              ...prevCards,
              {
                id: incomingAnimId,
                card: swappedInCard,
                fromX:
                  topRowOriginRef.current.x +
                  centerPanelOriginRef.current.x +
                  deckSlotPosRef.current.x -
                  ANIM_CARD_HALF_WIDTH,
                fromY:
                  topRowOriginRef.current.y +
                  centerPanelOriginRef.current.y +
                  deckSlotPosRef.current.y -
                  ANIM_CARD_HALF_HEIGHT,
                toX: playerHandOriginRef.current.x + toPos.x,
                toY: playerHandOriginRef.current.y + toPos.y,
              },
            ]);

            setTimeout(() => {
              setAnimatedCards((prevCards) =>
                prevCards.filter((ac) => ac.id !== incomingAnimId),
              );
            }, CARD_MOVE_CLEANUP_MS);
          }
        }

        setTimeout(() => {
          setState((current) => ({
            ...current,
            discard: newDiscard,
          }));
        }, CARD_MOVE_CLEANUP_MS);

        const nextState: GameState = {
          ...prev,
          players: newPlayers,
          discard: prev.discard,
          drawnCard: null,
          drawnFrom: null,
          phase: "action",
          selectedHandIdx: null,
          movingCardIdx: null,
          message: "Swapped! Next player…",
          turn: 0,
          aiThinking: true,
          gameOver: false,
        };

        if (nextState.deck.length === 0) {
          return {
            ...nextState,
            gameOver: true,
            message: "Deck is empty — game over!",
          };
        }

        setTimeout(() => {
          setState((current) => {
            if (current.gameOver) return current;
            return {
              ...current,
              turn: 1,
              message: "Player 2 is thinking…",
              aiThinking: true,
            };
          });
        }, CARD_MOVE_CLEANUP_MS + AI_TURN_DELAY_AFTER_ANIMATION_MS);

        aiTimerRef.current = setTimeout(
          () => runAiTurn(1),
          CARD_MOVE_CLEANUP_MS + AI_TURN_DELAY_AFTER_ANIMATION_MS * 2,
        );
        selectedSwapCardPosRef.current = null;
        return nextState;
      });
    },
    [
      isOnlineMode,
      playSwapAudio,
      runAiTurn,
      state.drawnCard,
      state.selectedHandIdx,
      submitOnlineAction,
    ],
  );

  const handleDoubleTapCard = useCallback(
    (idx: number, cardPos?: { x: number; y: number }) => {
      if (state.turn !== 0 || state.gameOver) return;

      if (state.phase === "drawn") {
        if (state.drawnCard) {
          handleSwap(idx, cardPos);
        }
        return;
      }

      if (state.phase !== "action") return;

      const selectedIdx = state.movingCardIdx;
      if (selectedIdx === null || selectedIdx === idx) {
        return;
      }

      swapHumanCards(
        selectedIdx,
        idx,
        firstSelectedCardPosRef.current ?? undefined,
        cardPos,
      );
    },
    [
      handleSwap,
      state.drawnCard,
      state.gameOver,
      state.movingCardIdx,
      state.phase,
      state.turn,
      swapHumanCards,
    ],
  );

  const handleKeep = useCallback(() => {
    if (isOnlineMode) {
      void submitOnlineAction({ action: "KEEP" });
      return;
    }

    setState((prev) => {
      if (!prev.drawnCard) return prev;
      playSwapAudio();
      const newDiscard = [...prev.discard, prev.drawnCard];
      const drawnCard = prev.drawnCard;
      selectedSwapCardPosRef.current = null;

      // Trigger animation from the actual draw source to discard slot.
      const animId = `${drawnCard.suit}${drawnCard.rank}-${Date.now()}`;
      const sourceFromDeck = prev.drawnFrom !== "discard";
      const zoneOriginX =
        topRowOriginRef.current.x + centerPanelOriginRef.current.x;
      const zoneOriginY =
        topRowOriginRef.current.y + centerPanelOriginRef.current.y;
      setAnimatedCards((prevCards) => [
        ...prevCards,
        {
          id: animId,
          card: drawnCard,
          fromX:
            zoneOriginX +
            (sourceFromDeck
              ? deckSlotPosRef.current.x - ANIM_CARD_HALF_WIDTH
              : discardSlotPosRef.current.x - ANIM_CARD_HALF_WIDTH),
          fromY:
            zoneOriginY +
            (sourceFromDeck
              ? deckSlotPosRef.current.y - ANIM_CARD_HALF_HEIGHT
              : discardSlotPosRef.current.y - ANIM_CARD_HALF_HEIGHT),
          toX: zoneOriginX + discardSlotPosRef.current.x - ANIM_CARD_HALF_WIDTH,
          toY:
            zoneOriginY + discardSlotPosRef.current.y - ANIM_CARD_HALF_HEIGHT,
        },
      ]);

      setTimeout(() => {
        setAnimatedCards((prev) => prev.filter((ac) => ac.id !== animId));
      }, CARD_MOVE_CLEANUP_MS);

      const nextState: GameState = {
        ...prev,
        discard: newDiscard,
        drawnCard: null,
        drawnFrom: null,
        phase: "action",
        selectedHandIdx: null,
        movingCardIdx: null,
        message: "Kept your hand. Next player…",
        turn: 0,
        aiThinking: true,
        gameOver: false,
      };

      if (nextState.deck.length === 0) {
        return {
          ...nextState,
          gameOver: true,
          message: "Deck is empty — game over!",
        };
      }

      setTimeout(() => {
        setState((current) => {
          if (current.gameOver) return current;
          return {
            ...current,
            turn: 1,
            message: "Player 2 is thinking…",
            aiThinking: true,
          };
        });
      }, CARD_MOVE_CLEANUP_MS + AI_TURN_DELAY_AFTER_ANIMATION_MS);

      aiTimerRef.current = setTimeout(
        () => runAiTurn(1),
        CARD_MOVE_CLEANUP_MS + AI_TURN_DELAY_AFTER_ANIMATION_MS * 2,
      );
      return nextState;
    });
  }, [isOnlineMode, playSwapAudio, runAiTurn, submitOnlineAction]);

  const handleStop = useCallback(() => {
    if (isOnlineMode) {
      void submitOnlineAction({ action: "STOP" });
      return;
    }

    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    setState((prev) => {
      if (prev.gameOver || prev.stopPending) return prev;
      return {
        ...prev,
        aiThinking: false,
        stopPending: true,
        message: "Stopping game…",
      };
    });
    setTimeout(() => {
      endGame("You stopped the game!");
    }, 300);
  }, [endGame, isOnlineMode, submitOnlineAction]);

  const resetRound = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    clearShuffleTimers();
    setState(createInitialState(getEmojiForPlayerIconId(activePlayerIconId)));
    setAnimatedCards([]);
    setIsShuffling(true);
    setRevealedHumanCount(0);
    const restartTimer = setTimeout(() => {
      runStartShuffleAnimation();
    }, 140);
    shuffleTimersRef.current.push(restartTimer);
  }, [activePlayerIconId, clearShuffleTimers, runStartShuffleAnimation]);

  const handleNewGame = useCallback(() => {
    setMatchWins([0, 0, 0]);
    setMatchWinnerIdx(null);
    roundScoredRef.current = false;
    resetRound();
  }, [resetRound]);

  const handleResultAction = useCallback(() => {
    if (isOnlineMode) {
      setResultModalVisible(false);
      void submitOnlineAction({
        action: matchWinnerIdx !== null ? "NEW_MATCH" : "NEXT_ROUND",
      });
      return;
    }

    recordCurrentGameStats();
    if (matchWinnerIdx !== null) {
      setMatchWins([0, 0, 0]);
      setMatchWinnerIdx(null);
    }
    roundScoredRef.current = false;
    resetRound();
  }, [
    isOnlineMode,
    matchWinnerIdx,
    recordCurrentGameStats,
    resetRound,
    submitOnlineAction,
  ]);

  const handleBackToLobby = useCallback(() => {
    router.replace("/lobby");
  }, [router]);

  const {
    players,
    turn,
    phase,
    drawnCard,
    drawnFrom,
    selectedHandIdx,
    message,
    gameOver,
    deck,
    discard,
  } = state;
  const hasMatchPoint = matchWins.some((count) => count === 2);
  const hasHumanFullyRevealed = revealedHumanCount >= players[0].cards.length;
  const showHumanScore = gameOver || (!isShuffling && hasHumanFullyRevealed);
  const discardTop = discard.length > 0 ? discard[discard.length - 1] : null;
  const isMyTurn = turn === 0 && !gameOver && !state.aiThinking && !isShuffling;
  const [suppressHandTooltip, setSuppressHandTooltip] = useState(false);

  useEffect(() => {
    if (phase === "drawn" && drawnCard) {
      if (handTooltipResetTimerRef.current) {
        clearTimeout(handTooltipResetTimerRef.current);
      }
      setSuppressHandTooltip(true);
      handTooltipResetTimerRef.current = setTimeout(() => {
        setSuppressHandTooltip(false);
        handTooltipResetTimerRef.current = null;
      }, 260);
      return;
    }

    if (handTooltipResetTimerRef.current) {
      clearTimeout(handTooltipResetTimerRef.current);
      handTooltipResetTimerRef.current = null;
    }
    setSuppressHandTooltip(false);
  }, [drawnCard, phase]);

  useEffect(() => {
    return () => {
      if (handTooltipResetTimerRef.current) {
        clearTimeout(handTooltipResetTimerRef.current);
        handTooltipResetTimerRef.current = null;
      }
    };
  }, []);

  const tutorialMessage = React.useMemo(() => {
    if (
      !tutorialEnabled ||
      gameOver ||
      !isMyTurn ||
      isShuffling ||
      state.movingCardIdx !== null
    ) {
      return null;
    }

    if (phase === "action") {
      if (deck.length > 0 && discard.length > 0) {
        return "Next move: Draw from Deck or take Discard.";
      }
      if (discard.length > 0) {
        return "Next move: Take Discard.";
      }
      if (deck.length > 0) {
        return "Tap deck to draw card.";
      }
      return null;
    }

    return null;
  }, [
    deck.length,
    discard.length,
    drawnCard,
    gameOver,
    isMyTurn,
    isShuffling,
    phase,
    state.movingCardIdx,
    tutorialEnabled,
  ]);

  const tutorialTooltipPosition = React.useMemo(() => {
    if (!tutorialMessage) {
      return null;
    }

    if (phase === "action") {
      const zoneOriginX =
        topRowOriginRef.current.x + centerPanelOriginRef.current.x;
      const zoneOriginY =
        topRowOriginRef.current.y + centerPanelOriginRef.current.y;
      const deckCenterX = zoneOriginX + deckSlotPosRef.current.x;
      const deckCenterY = zoneOriginY + deckSlotPosRef.current.y;
      const discardCenterX = zoneOriginX + discardSlotPosRef.current.x;
      const discardCenterY = zoneOriginY + discardSlotPosRef.current.y;

      let anchorX = deckCenterX;
      let anchorY = deckCenterY;

      if (deck.length > 0 && discard.length > 0) {
        anchorX = (deckCenterX + discardCenterX) / 2;
        anchorY = Math.min(deckCenterY, discardCenterY);
      } else if (discard.length > 0) {
        anchorX = discardCenterX;
        anchorY = discardCenterY;
      }

      return {
        left: Math.max(140, anchorX),
        top: Math.max(70, anchorY - 72),
      };
    }

    if (phase === "drawn" && drawnCard) {
      return {
        left: Math.max(140, playerHandOriginRef.current.x + 180),
        top: Math.max(90, playerHandOriginRef.current.y - 54),
      };
    }

    return {
      left: 200,
      top: 70,
    };
  }, [
    deck.length,
    discard.length,
    drawnCard,
    phase,
    tutorialMessage,
  ]);
  const actionButtonTooltipMessage = React.useMemo(() => {
    if (
      !tutorialEnabled ||
      gameOver ||
      !isMyTurn ||
      isShuffling ||
      state.movingCardIdx !== null
    ) {
      return null;
    }

    if (phase === "drawn" && drawnCard) {
      return "Tip: Press Discard to place the drawn card in discard pile and end your turn.";
    }

    if (phase === "action") {
      return "Tip: Press Stop if you want to end the round now.";
    }

    return null;
  }, [
    drawnCard,
    gameOver,
    isMyTurn,
    isShuffling,
    phase,
    state.movingCardIdx,
    tutorialEnabled,
  ]);
  const handSwapTooltipMessage = React.useMemo(() => {
    if (
      !tutorialEnabled ||
      gameOver ||
      !isMyTurn ||
      isShuffling ||
      suppressHandTooltip
    ) {
      return null;
    }

    if (phase === "drawn" && drawnCard) {
      return "Tip: Double tap a hand card to swap with the drawn card.";
    }

    if (phase === "action" && state.movingCardIdx !== null) {
      return "Tip: Double tap another hand card to swap positions.";
    }

    if (phase === "action" && state.movingCardIdx === null) {
      return "Tip: Tap a hand card to select it.";
    }

    return null;
  }, [
    drawnCard,
    gameOver,
    isMyTurn,
    isShuffling,
    phase,
    state.movingCardIdx,
    suppressHandTooltip,
    tutorialEnabled,
  ]);
  const handSwapTooltipPosition = React.useMemo(() => {
    if (!handSwapTooltipMessage) {
      return null;
    }

    return {
      left: Math.max(170, playerHandOriginRef.current.x + 210),
      top: Math.max(120, playerHandOriginRef.current.y - 58),
    };
  }, [handSwapTooltipMessage]);
  const showTopTurnBanner = isShuffling;

  useEffect(() => {
    if (isMyTurn && !wasMyTurnRef.current && turnAlertMode === "vibrate") {
      Vibration.vibrate(120);
    }
    wasMyTurnRef.current = isMyTurn;
  }, [isMyTurn, turnAlertMode]);

  let winnerIdx = 0;
  let winnerScore = calcHandScore(players[0].cards);
  for (let i = 1; i < players.length; i++) {
    const score = calcHandScore(players[i].cards);
    if (score < winnerScore) {
      winnerScore = score;
      winnerIdx = i;
    }
  }
  const winnerPlayer = players[winnerIdx];

  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={[styles.safe, { backgroundColor: activeBackground.background }]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={activeBackground.background}
      />

      <View style={styles.container}>
        <Text3D style={styles.backgroundTitle}>7 Card Rummy</Text3D>
        <View
          style={[
            styles.board,
            { backgroundColor: activeBackground.background },
          ]}
        >
          <View style={[styles.boardCorner, styles.boardCornerTopLeft]} />
          <View style={[styles.boardCorner, styles.boardCornerTopRight]} />
          <View style={[styles.boardCorner, styles.boardCornerBottomLeft]} />
          <View style={[styles.boardCorner, styles.boardCornerBottomRight]} />

          {showTopTurnBanner ? (
            <View style={[styles.shuffleBanner, styles.turnBannerShuffling]}>
              <Text3D style={styles.shuffleBannerText}>Shuffling...</Text3D>
            </View>
          ) : (
            <>
              {isShuffling && (
                <View
                  style={[styles.shuffleBanner, styles.turnBannerShuffling]}
                >
                  <Text3D style={styles.shuffleBannerText}>Shuffling...</Text3D>
                </View>
              )}
            </>
          )}

          {isOnlineMode && (
            <View style={styles.onlineGameBanner}>
              <Text3D style={styles.onlineGameBannerText}>
                {onlineError ??
                  message ??
                  (isMyTurn ? "Your turn." : `${players[turn].name}'s turn.`)}
              </Text3D>
            </View>
          )}

          {tutorialMessage ? (
            <View style={[styles.tutorialTooltip, tutorialTooltipPosition]}>
              <View style={styles.tutorialTooltipArrow} />
              <Text3D style={styles.tutorialTooltipText}>{tutorialMessage}</Text3D>
            </View>
          ) : null}

          {actionButtonTooltipMessage ? (
            <View style={styles.actionButtonTooltip}>
              <View style={styles.actionButtonTooltipArrow} />
              <Text3D style={styles.actionButtonTooltipText}>
                {actionButtonTooltipMessage}
              </Text3D>
            </View>
          ) : null}

          {handSwapTooltipMessage ? (
            <View style={[styles.handSwapTooltip, handSwapTooltipPosition]}>
              <View style={styles.handSwapTooltipArrow} />
              <Text3D style={styles.handSwapTooltipText}>
                {handSwapTooltipMessage}
              </Text3D>
            </View>
          ) : null}

          {deckToastMessage && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.deckToast,
                {
                  opacity: deckToastAnimRef.current,
                  transform: [
                    {
                      translateY: deckToastAnimRef.current.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-10, 0],
                      }),
                    },
                    {
                      scale: deckToastAnimRef.current.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.94, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text3D style={styles.deckToastText}>{deckToastMessage}</Text3D>
            </Animated.View>
          )}

          <View
            style={[
              styles.topRow,
              {
                paddingLeft: Math.max(4, insets.left),
                paddingRight: Math.max(8, insets.right + 4),
              },
            ]}
            onLayout={(event) => {
              topRowOriginRef.current = event.nativeEvent.layout;
            }}
          >
            <View
              style={styles.player2Wrapper}
              onLayout={(event) => {
                player2WrapperRef.current = event.nativeEvent.layout;
              }}
            >
              <PlayerHand
                player={players[1]}
                cardBackColor={sharedCardBackColor}
                wins={matchWins[1]}
                matchPointActive={hasMatchPoint}
                isCurrentTurn={turn === 1 && !gameOver}
                showCards={gameOver}
                showScore={gameOver}
                score={calcHandScore(players[1].cards)}
                gameOver={gameOver}
                compact
                showThinking={!isOnlineMode}
                containerStyle={styles.player2HandCurve}
              />
            </View>

            <View
              style={styles.centerPanel}
              onLayout={(event) => {
                centerPanelOriginRef.current = event.nativeEvent.layout;
              }}
            >
              <CenterZone
                deckCount={deck.length}
                discardTop={discardTop}
                drawnCard={isMyTurn && phase === "drawn" ? drawnCard : null}
                drawnFrom={drawnFrom}
                cardBackColor={sharedCardBackColor}
                canDrawDeck={
                  isMyTurn &&
                  phase === "action" &&
                  deck.length > 0 &&
                  drawnFrom === null &&
                  state.movingCardIdx === null
                }
                canTakeDiscard={
                  isMyTurn &&
                  phase === "action" &&
                  discard.length > 0 &&
                  drawnFrom === null &&
                  state.movingCardIdx === null
                }
                onDrawDeck={handleDrawDeck}
                onTakeDiscard={handleTakeDiscard}
                onDeckPositionChange={(position) => {
                  deckSlotPosRef.current = position;
                }}
                onDiscardPositionChange={(position) => {
                  discardSlotPosRef.current = position;
                }}
              />
            </View>

            <View
              style={styles.player3Wrapper}
              onLayout={(event) => {
                player3WrapperRef.current = event.nativeEvent.layout;
              }}
            >
              <PlayerHand
                player={players[2]}
                cardBackColor={sharedCardBackColor}
                wins={matchWins[2]}
                matchPointActive={hasMatchPoint}
                isCurrentTurn={turn === 2 && !gameOver}
                showCards={gameOver}
                showScore={gameOver}
                score={calcHandScore(players[2].cards)}
                gameOver={gameOver}
                compact
                showThinking={!isOnlineMode}
                containerStyle={styles.player3HandCurve}
              />
            </View>
          </View>

          <ActionBar
            gameOver={!isOnlineMode && gameOver && !/stopped/i.test(message)}
            onNewGame={handleNewGame}
          />

          <View
            style={styles.player1Wrapper}
            onLayout={(event) => {
              playerHandOriginRef.current = {
                x: event.nativeEvent.layout.x,
                y: event.nativeEvent.layout.y,
              };
            }}
          >
            <PlayerHand
              player={players[0]}
              cardBackColor={sharedCardBackColor}
              wins={matchWins[0]}
              matchPointActive={hasMatchPoint}
              isHuman
              isCurrentTurn={isMyTurn}
              showCards
              showScore={showHumanScore}
              revealCount={revealedHumanCount}
              phase={phase}
              selectedIdx={selectedHandIdx}
              movingCardIdx={state.movingCardIdx}
              onCardPress={handleSelectCard}
              onCardDoubleTap={handleDoubleTapCard}
              onCardDrop={swapHumanCards}
              score={calcHandScore(players[0].cards)}
              gameOver={gameOver}
            />
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#4ae" }]} />
              <Text3D style={styles.legendText}>Zero-value combo</Text3D>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#ffffff" }]}
              />
              <Text3D style={styles.legendText}>Selected card</Text3D>
            </View>
          </View>

          {animatedCards.map((ac) => (
            <AnimatedCard
              key={ac.id}
              card={ac.card}
              faceDown={ac.faceDown}
              cardBackColor={sharedCardBackColor}
              rotateZ={ac.rotateZ}
              fromPosition={{ x: ac.fromX, y: ac.fromY }}
              toPosition={{ x: ac.toX, y: ac.toY }}
              duration={
                ac.id.includes("shuffle-")
                  ? SHUFFLE_MOVE_DURATION_MS
                  : ac.id.includes("-reorder-")
                    ? HAND_REORDER_DURATION_MS
                    : CARD_MOVE_DURATION_MS
              }
            />
          ))}

          {isMyTurn && !gameOver && (
            <TouchableOpacity
              style={[
                styles.floatingActionButton,
                styles.primaryFloatingAction,
                phase === "drawn" && drawnCard
                  ? styles.floatingKeepButton
                  : styles.stopGameButton,
              ]}
              onPress={phase === "drawn" && drawnCard ? handleKeep : handleStop}
              activeOpacity={0.8}
            >
              <Text3D style={styles.floatingActionText}>
                {phase === "drawn" && drawnCard ? "Discard" : "🛑 Stop"}
              </Text3D>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        visible={showWinnerReveal}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        supportedOrientations={[
          "landscape",
          "landscape-left",
          "landscape-right",
        ]}
        onRequestClose={openResultModal}
      >
        <View style={styles.winnerRevealOverlay}>
          <View style={styles.winnerRevealBox}>
            <Text3D style={styles.winnerRevealTitle}>Winner Cards</Text3D>
            <Text3D style={styles.winnerRevealSubtitle}>
              {winnerPlayer.name} leads with {winnerScore} points
            </Text3D>

            <View style={styles.winnerCardsGrid}>
              {winnerPlayer.cards.map((card, idx) => (
                <View key={`${card.id}-${idx}`} style={styles.winnerCardSlot}>
                  <PlayingCard card={card} size="large" />
                </View>
              ))}
            </View>

            <Text3D style={styles.winnerRevealTimerText}>
              Showing result in {winnerRevealCountdown}s
            </Text3D>

            <TouchableOpacity
              onPress={openResultModal}
              activeOpacity={0.85}
              style={styles.winnerRevealOkButton}
            >
              <Text3D style={styles.winnerRevealOkText}>OK</Text3D>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ResultModal
        visible={resultModalVisible}
        players={players}
        stopMessage={message}
        matchWins={matchWins}
        winsToWin={MATCH_WINS_TO_WIN}
        matchWinnerIdx={matchWinnerIdx}
        onNewGame={handleResultAction}
        onBackToLobby={handleBackToLobby}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  board: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#132f25",
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
    transform: [{ perspective: 1200 }, { rotateX: "-10deg" }],
    overflow: "hidden",
  },
  boardCorner: {
    position: "absolute",
    width: 50,
    height: 28,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  boardCornerTopLeft: {
    top: 12,
    left: 12,
    transform: [{ rotate: "-12deg" }],
  },
  boardCornerTopRight: {
    top: 12,
    right: 12,
    transform: [{ rotate: "12deg" }],
  },
  boardCornerBottomLeft: {
    bottom: 12,
    left: 12,
    transform: [{ rotate: "12deg" }],
    backgroundColor: "rgba(0,0,0,0.15)",
    borderColor: "rgba(255,255,255,0.06)",
  },
  boardCornerBottomRight: {
    bottom: 12,
    right: 12,
    transform: [{ rotate: "-12deg" }],
    backgroundColor: "rgba(0,0,0,0.18)",
    borderColor: "rgba(255,255,255,0.05)",
  },

  backgroundTitle: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -80,
    marginTop: -40,
    color: "rgba(246,212,58,0.1)",
    fontSize: 48,
    fontWeight: "bold",
    fontFamily: "Georgia",
    letterSpacing: 1.5,
    zIndex: -1,
  },
  deckCounter: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deckCounterText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
  },
  deckToast: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    borderColor: "rgba(246,212,58,0.9)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 30,
  },
  deckToastText: {
    color: "#f6d43a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  shuffleBanner: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 20,
  },
  shuffleBannerText: {
    color: "#f6d43a",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 0.4,
  },
  turnBannerShuffling: {
    top: 12,
    left: 12,
  },
  turnBannerPlayer2: {
    top: 12,
    left: 16,
  },
  turnBannerPlayer3: {
    top: 12,
    right: 16,
  },
  turnBannerPlayer1: {
    bottom: 132,
    left: "50%",
    marginLeft: -44,
  },
  onlineGameBanner: {
    position: "absolute",
    top: 12,
    left: 96,
    right: 96,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderColor: "rgba(246,212,58,0.75)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 21,
    alignItems: "center",
  },
  onlineGameBannerText: {
    color: "#f6d43a",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  tutorialTooltip: {
    position: "absolute",
    width: 260,
    backgroundColor: "rgba(10,18,14,0.9)",
    borderColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 22,
    alignItems: "center",
    transform: [{ translateX: -130 }],
  },
  tutorialTooltipArrow: {
    position: "absolute",
    bottom: -6,
    left: "50%",
    marginLeft: -6,
    width: 12,
    height: 12,
    backgroundColor: "rgba(10,18,14,0.9)",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    transform: [{ rotate: "45deg" }],
  },
  tutorialTooltipText: {
    color: "#fdf0b4",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  actionButtonTooltip: {
    position: "absolute",
    right: 14,
    bottom: 206,
    width: 240,
    backgroundColor: "rgba(10,18,14,0.9)",
    borderColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    zIndex: 22,
  },
  actionButtonTooltipArrow: {
    position: "absolute",
    bottom: -6,
    right: 28,
    width: 12,
    height: 12,
    backgroundColor: "rgba(10,18,14,0.9)",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    transform: [{ rotate: "45deg" }],
  },
  actionButtonTooltipText: {
    color: "#fdf0b4",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  handSwapTooltip: {
    position: "absolute",
    width: 250,
    backgroundColor: "rgba(10,18,14,0.9)",
    borderColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    zIndex: 22,
    alignItems: "center",
    transform: [{ translateX: -125 }],
  },
  handSwapTooltipArrow: {
    position: "absolute",
    bottom: -6,
    left: "50%",
    marginLeft: -6,
    width: 12,
    height: 12,
    backgroundColor: "rgba(10,18,14,0.9)",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    transform: [{ rotate: "45deg" }],
  },
  handSwapTooltipText: {
    color: "#fdf0b4",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingBottom: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 0,
    width: "100%",
  },
  player1Wrapper: {
    // Wide enough to contain the full 7-card hand + info block inside the
    // panel on narrow landscape boards (e.g. iPhone 16 Pro ~640pt usable).
    // The floating Stop/Discard button is lifted above the hand (see
    // primaryFloatingAction) so it no longer competes for this row's width.
    width: "84%",
    maxWidth: 620,
    alignSelf: "center",
    marginTop: "auto",
  },
  player2Wrapper: {
    width: "36%",
    minWidth: 164,
    alignSelf: "flex-start",
    marginTop: 8,
    transform: [{ translateX: -8 }, { rotate: "-22deg" }],
  },
  player2HandCurve: {
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
    marginRight: 8,
  },
  player3Wrapper: {
    width: "36%",
    minWidth: 164,
    alignSelf: "flex-start",
    marginTop: 8,
    transform: [{ translateX: 8 }, { rotate: "22deg" }],
  },
  player3HandCurve: {
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderTopLeftRadius: 40,
    borderBottomLeftRadius: 40,
    marginLeft: 8,
  },
  centerPanel: {
    width: "24%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  primaryFloatingAction: {
    position: "absolute",
    right: 14,
    // Sit above the player hand (which fills the bottom of the board) so the
    // button never overlaps the cards. The empty band between the top-row
    // opponents and the human hand has room on narrow landscape boards.
    bottom: 150,
  },
  stopGameButton: {
    backgroundColor: "#c0392b",
  },
  floatingActionButton: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 96,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  floatingSwapButton: {
    backgroundColor: "#27ae60",
  },
  floatingKeepButton: {
    backgroundColor: "#e67e22",
  },
  floatingActionDisabled: {
    opacity: 0.45,
  },
  floatingActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 0.4,
  },
  winnerRevealOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  winnerRevealBox: {
    width: "100%",
    maxWidth: 680,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(246,212,58,0.85)",
    backgroundColor: "rgba(10,14,12,0.9)",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 10,
  },
  winnerRevealTitle: {
    color: "#f6d43a",
    fontSize: 26,
    fontWeight: "800",
  },
  winnerRevealSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    textAlign: "center",
  },
  winnerCardsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  winnerCardSlot: {
    transform: [{ scale: 1.02 }],
  },
  winnerRevealTimerText: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
  },
  winnerRevealOkButton: {
    backgroundColor: "#f6d43a",
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 10,
    marginTop: 4,
  },
  winnerRevealOkText: {
    color: "#1a1a2e",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
