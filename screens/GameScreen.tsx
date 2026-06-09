import ActionBar from "@/components/ActionBar";
import AnimatedCard from "@/components/AnimatedCard";
import PlayingCard from "@/components/Card";
import CenterZone from "@/components/CenterZone";
import PlayerHand from "@/components/PlayerHand";
import ResultModal from "@/components/ResultModal";
import Text3D from "@/components/Text3D";
import { BACKGROUNDS } from "@/constants/backgrounds";
import { CARD_BACKS } from "@/constants/cardbacks";
import { Feature } from "@/constants/feature";
import {
  getActiveBackgroundId,
  getActiveCardBackId,
  getAiDifficulty,
  getTurnAlertMode,
  initializeProfileSettings,
  initializeSoundSettings,
  isSoundEnabled,
  subscribeAiDifficulty,
  subscribeBackgroundSettings,
  subscribeCardBackSettings,
  subscribeSoundEnabled,
  subscribeTurnAlertMode,
  type AiDifficulty,
  type TurnAlertMode,
} from "@/constants/settings";
import { incrementCurrentUserGamesPlayedFromBackend } from "@/constants/auth";
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
import { useRouter } from "expo-router";
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

function createInitialState(): GameState {
  const deck = shuffle(makeDeck());
  const players: Player[] = [
    { name: "You", cards: deck.splice(0, 7), isHuman: true, icon: "robot" },
    {
      name: "Player 2",
      cards: deck.splice(0, 7),
      isHuman: false,
      icon: "robot",
    },
    {
      name: "Player 3",
      cards: deck.splice(0, 7),
      isHuman: false,
      icon: "robot",
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

export default function GameScreen(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const skeletonEnabled = Feature.skeleton.enabled();
  const lobbyEnabled = Feature.lobbyScreen.enabled();
  const gameScreenAdEnabled = Feature.gameScreenAd.enabled();
  const [activeBackgroundId, setActiveBackgroundId] = useState(
    getActiveBackgroundId(),
  );
  const [activeCardBackId, setActiveCardBackId] = useState(
    getActiveCardBackId(),
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
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(isSoundEnabled());
  const [turnAlertMode, setTurnAlertMode] =
    useState<TurnAlertMode>(getTurnAlertMode());
  const [aiDifficulty, setAiDifficulty] =
    useState<AiDifficulty>(getAiDifficulty());
  const [matchWins, setMatchWins] = useState<number[]>([0, 0, 0]);
  const [matchWinnerIdx, setMatchWinnerIdx] = useState<number | null>(null);
  const [isShuffling, setIsShuffling] = useState<boolean>(true);
  const [revealedHumanCount, setRevealedHumanCount] = useState<number>(0);
  const [showGameScreenAd, setShowGameScreenAd] = useState<boolean>(false);
  const [showWinnerReveal, setShowWinnerReveal] = useState<boolean>(false);
  const [resultModalVisible, setResultModalVisible] = useState<boolean>(false);
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
  const centerZoneRef = useRef<View>(null);
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
  const gameRecordedForRoundRef = useRef<boolean>(false);
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

    return () => {
      unsubscribeSound();
      unsubscribeTurnAlertMode();
      unsubscribeAiDifficulty();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeBackgroundSettings(() => {
      setActiveBackgroundId(getActiveBackgroundId());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeCardBackSettings(() => {
      setActiveCardBackId(getActiveCardBackId());
    });

    return unsubscribe;
  }, []);

  const activeBackground =
    BACKGROUNDS.find((item) => item.id === activeBackgroundId) ??
    BACKGROUNDS[0];
  const activeCardBack =
    CARD_BACKS.find((item) => item.id === activeCardBackId) ?? CARD_BACKS[0];
  const sharedCardBackColor = activeCardBack.color;

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

  const openResultModal = useCallback(() => {
    clearWinnerRevealTimers();
    setShowWinnerReveal(false);
    setResultModalVisible(true);
    setWinnerRevealCountdown(WINNER_REVEAL_DURATION_SECONDS);
  }, [WINNER_REVEAL_DURATION_SECONDS, clearWinnerRevealTimers]);

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
    const startTimer = setTimeout(() => {
      runStartShuffleAnimation();
    }, 120);
    shuffleTimersRef.current.push(startTimer);

    return () => {
      clearShuffleTimers();
    };
  }, [clearShuffleTimers, runStartShuffleAnimation]);

  useEffect(() => {
    if (!skeletonEnabled) return;
    if (!state.gameOver) {
      roundScoredRef.current = false;
      return;
    }

    if (roundScoredRef.current) return;
    roundScoredRef.current = true;

    let winnerIdx = 0;
    let bestScore = calcHandScore(state.players[0].cards);
    for (let i = 1; i < state.players.length; i++) {
      const score = calcHandScore(state.players[i].cards);
      if (score < bestScore) {
        bestScore = score;
        winnerIdx = i;
      }
    }

    setMatchWins((prev) => {
      const next = prev.slice();
      next[winnerIdx] += 1;
      if (next[winnerIdx] >= MATCH_WINS_TO_WIN) {
        setMatchWinnerIdx(winnerIdx);
      }
      return next;
    });
  }, [MATCH_WINS_TO_WIN, skeletonEnabled, state.gameOver, state.players]);

  useEffect(() => {
    if (!gameScreenAdEnabled || !state.gameOver || !resultModalVisible) {
      setShowGameScreenAd(false);
      return;
    }

    setShowGameScreenAd(true);
    const adTimer = setTimeout(() => {
      setShowGameScreenAd(false);
    }, 4200);

    return () => {
      clearTimeout(adTimer);
    };
  }, [gameScreenAdEnabled, resultModalVisible, state.gameOver]);

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
    openResultModal,
    state.gameOver,
  ]);

  useEffect(() => {
    if (!state.gameOver) {
      return;
    }

    if (gameRecordedForRoundRef.current) {
      return;
    }

    let winnerIdx = 0;
    let bestScore = calcHandScore(state.players[0].cards);
    for (let i = 1; i < state.players.length; i++) {
      const score = calcHandScore(state.players[i].cards);
      if (score < bestScore) {
        bestScore = score;
        winnerIdx = i;
      }
    }

    gameRecordedForRoundRef.current = true;
    void incrementCurrentUserGamesPlayedFromBackend(winnerIdx === 0);
  }, [state.gameOver, state.players]);

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
  }, []);

  const handleTakeDiscard = useCallback(() => {
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
  }, []);

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
    [playSwapAudio],
  );

  const handleSwap = useCallback(
    (forcedIdx?: number, forcedCardPos?: { x: number; y: number }) => {
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
    [playSwapAudio, runAiTurn],
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
  }, [playSwapAudio, runAiTurn]);

  const handleStop = useCallback(() => {
    console.log("[STOP] Stop button pressed");
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    setState((prev) => {
      console.log("[STOP] Pre-end snapshot", {
        gameOver: prev.gameOver,
        stopPending: prev.stopPending,
        turn: prev.turn,
        phase: prev.phase,
        aiThinking: prev.aiThinking,
        message: prev.message,
      });
      if (prev.gameOver || prev.stopPending) return prev;
      return {
        ...prev,
        aiThinking: false,
        stopPending: true,
        message: "Debug: Stop pressed, finalizing game…",
      };
    });
    setTimeout(() => {
      console.log("[STOP] Triggering endGame");
      endGame("You stopped the game!");
    }, 300);
  }, [endGame]);

  const resetRound = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    clearShuffleTimers();
    setShowGameScreenAd(false);
    setState(createInitialState());
    setAnimatedCards([]);
    setIsShuffling(true);
    setRevealedHumanCount(0);
    const restartTimer = setTimeout(() => {
      runStartShuffleAnimation();
    }, 140);
    shuffleTimersRef.current.push(restartTimer);
  }, [clearShuffleTimers, runStartShuffleAnimation]);

  const handleNewGame = useCallback(() => {
    setShowGameScreenAd(false);
    if (!skeletonEnabled) {
      roundScoredRef.current = false;
      resetRound();
      return;
    }
    setMatchWins([0, 0, 0]);
    setMatchWinnerIdx(null);
    roundScoredRef.current = false;
    resetRound();
  }, [resetRound, skeletonEnabled]);

  const handleResultAction = useCallback(() => {
    setShowGameScreenAd(false);
    if (matchWinnerIdx !== null) {
      setMatchWins([0, 0, 0]);
      setMatchWinnerIdx(null);
    }
    roundScoredRef.current = false;
    resetRound();
  }, [matchWinnerIdx, resetRound]);

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
    stopPending = false,
  } = state;
  const hasMatchPoint =
    skeletonEnabled && matchWins.some((count) => count === 2);
  const hasHumanFullyRevealed = revealedHumanCount >= players[0].cards.length;
  const showHumanScore = skeletonEnabled
    ? gameOver || (!isShuffling && hasHumanFullyRevealed)
    : true;
  const discardTop = discard.length > 0 ? discard[discard.length - 1] : null;
  const isMyTurn = turn === 0 && !gameOver && !state.aiThinking && !isShuffling;
  const showTopTurnBanner = skeletonEnabled && isShuffling;

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
        <Text3D style={styles.backgroundTitle}>7-Card Lowball</Text3D>
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

          {stopPending && !gameOver && (
            <View style={styles.stopDebugBanner}>
              <Text3D style={styles.stopDebugBannerText}>
                Debug: stop pressed, setting gameOver...
              </Text3D>
            </View>
          )}

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
                wins={skeletonEnabled ? matchWins[1] : undefined}
                matchPointActive={skeletonEnabled ? hasMatchPoint : undefined}
                isCurrentTurn={turn === 1 && !gameOver}
                showCards={gameOver}
                showScore={gameOver}
                score={calcHandScore(players[1].cards)}
                gameOver={gameOver}
                compact
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
                wins={skeletonEnabled ? matchWins[2] : undefined}
                matchPointActive={skeletonEnabled ? hasMatchPoint : undefined}
                isCurrentTurn={turn === 2 && !gameOver}
                showCards={gameOver}
                showScore={gameOver}
                score={calcHandScore(players[2].cards)}
                gameOver={gameOver}
                compact
                containerStyle={styles.player3HandCurve}
              />
            </View>
          </View>

          <ActionBar
            gameOver={gameOver && !/stopped/i.test(message)}
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
              wins={skeletonEnabled ? matchWins[0] : undefined}
              matchPointActive={skeletonEnabled ? hasMatchPoint : undefined}
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
        matchWins={skeletonEnabled ? matchWins : undefined}
        winsToWin={skeletonEnabled ? MATCH_WINS_TO_WIN : undefined}
        matchWinnerIdx={skeletonEnabled ? matchWinnerIdx : undefined}
        onNewGame={skeletonEnabled ? handleResultAction : handleNewGame}
        onBackToLobby={lobbyEnabled ? handleBackToLobby : undefined}
      />

      <Modal
        visible={gameScreenAdEnabled && showGameScreenAd}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        supportedOrientations={[
          "landscape",
          "landscape-left",
          "landscape-right",
        ]}
        onRequestClose={() => setShowGameScreenAd(false)}
      >
        <View style={styles.adOverlay}>
          <View style={styles.adCard}>
            <Text3D style={styles.adLabel}>Sponsored</Text3D>
            <Text3D style={styles.adTitle}>Level up between rounds</Text3D>
            <Text3D style={styles.adBody}>
              This ad slot appears after every round while the feature flag is
              enabled, so you can swap in a real ad network later.
            </Text3D>

            <View style={styles.adBanner}>
              <View style={styles.adBannerGlow} />
              <Text3D style={styles.adBannerText}>Ad revenue slot</Text3D>
            </View>

            <TouchableOpacity
              style={styles.adCtaButton}
              activeOpacity={0.85}
              onPress={() => setShowGameScreenAd(false)}
            >
              <Text3D style={styles.adCtaText}>Continue</Text3D>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  stopDebugBanner: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 84,
    backgroundColor: "rgba(192,57,43,0.9)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 20,
  },
  stopDebugBannerText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
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
  adOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  adCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 22,
    backgroundColor: "#163d2e",
    borderWidth: 2,
    borderColor: "rgba(246,212,58,0.9)",
    padding: 22,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  adLabel: {
    color: "#f6d43a",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  adTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 28,
  },
  adBody: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 18,
  },
  adBanner: {
    height: 88,
    borderRadius: 18,
    backgroundColor: "#f6d43a",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 4,
  },
  adBannerGlow: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.22)",
    top: -40,
    right: -20,
  },
  adBannerText: {
    color: "#1a1a2e",
    fontSize: 16,
    fontWeight: "800",
  },
  adCtaButton: {
    alignSelf: "flex-end",
    backgroundColor: "#f6d43a",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 6,
  },
  adCtaText: {
    color: "#1a1a2e",
    fontSize: 14,
    fontWeight: "800",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 0,
    width: "100%",
  },
  player1Wrapper: {
    width: "74%",
    maxWidth: 600,
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
    bottom: 14,
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
