import { findZeroCards, type Player } from "@/game/logic";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Card from "./Card";
import Text3D from "./Text3D";

type PlayerHandProps = {
  player: Player;
  wins?: number;
  matchPointActive?: boolean;
  isHuman?: boolean;
  isCurrentTurn?: boolean;
  showCards?: boolean;
  showScore?: boolean;
  revealCount?: number;
  phase?: "action" | "drawn";
  selectedIdx?: number | null;
  movingCardIdx?: number | null;
  onCardPress?: (idx: number, position?: { x: number; y: number }) => void;
  onCardDoubleTap?: (idx: number, position?: { x: number; y: number }) => void;
  onCardDrop?: (
    fromIdx: number,
    toIdx: number,
    fromPosition?: { x: number; y: number },
    toPosition?: { x: number; y: number },
  ) => void;
  score: number;
  gameOver?: boolean;
  compact?: boolean;
  tightCompact?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  cardBackColor?: string;
  showThinking?: boolean;
};

export default function PlayerHand({
  player,
  wins = 0,
  matchPointActive = false,
  isHuman = false,
  isCurrentTurn = false,
  showCards = false,
  showScore,
  revealCount = Number.MAX_SAFE_INTEGER,
  phase = "action",
  selectedIdx = null,
  movingCardIdx = null,
  onCardPress,
  onCardDoubleTap,
  onCardDrop,
  score,
  gameOver = false,
  compact = false,
  tightCompact = false,
  containerStyle,
  cardBackColor = "#1a3a8f",
  showThinking = true,
}: PlayerHandProps): React.ReactElement {
  const dragOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragStateRef = useRef<{
    idx: number | null;
    started: boolean;
    startPosition: { x: number; y: number } | null;
  }>({
    idx: null,
    started: false,
    startPosition: null,
  });
  const cardLayoutsRef = useRef<
    Record<number, { x: number; y: number; width: number; height: number }>
  >({});
  const cardsAreaOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cardsScrollX, setCardsScrollX] = useState(0);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const zeros =
    showCards || isHuman ? findZeroCards(player.cards) : new Set<number>();
  const shouldShowScore = showScore ?? (isHuman || gameOver);
  const canSelect = isHuman && phase === "drawn" && !gameOver;
  const canReorder =
    isHuman && phase === "action" && !gameOver && isCurrentTurn;
  const isTightCompact = compact && tightCompact;
  const cardSize: "normal" | "small" = compact ? "small" : "normal";
  const stackedCardOverlap = isTightCompact ? -25 : compact ? -22 : -28;
  const isMatchPointDanger = matchPointActive && wins === 0;
  const lastTapRef = useRef<{ idx: number | null; time: number }>({
    idx: null,
    time: 0,
  });
  const doubleTapWindowMs = 460;

  const getCardPosition = useCallback(
    (idx: number) => {
      const layout = cardLayoutsRef.current[idx];
      if (!layout) return undefined;

      return {
        x: cardsAreaOriginRef.current.x + layout.x - cardsScrollX,
        y: cardsAreaOriginRef.current.y + layout.y,
      };
    },
    [cardsScrollX],
  );

  const getNearestCardIdx = useCallback(
    (moveX: number) => {
      let nearestIdx: number | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      const contentX = moveX - cardsAreaOriginRef.current.x + cardsScrollX;

      Object.entries(cardLayoutsRef.current).forEach(([idxString, layout]) => {
        const centerX = layout.x + layout.width / 2;
        const distance = Math.abs(centerX - contentX);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIdx = Number(idxString);
        }
      });

      return nearestIdx;
    },
    [cardsScrollX],
  );

  const resetDragState = useCallback(() => {
    dragStateRef.current = {
      idx: null,
      started: false,
      startPosition: null,
    };
    setDraggingIdx(null);
    dragOffset.stopAnimation();
    dragOffset.setValue({ x: 0, y: 0 });
  }, [dragOffset]);

  const createDragResponder = useCallback(
    (idx: number) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          canReorder &&
          (Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6),
        onPanResponderGrant: (event, gestureState) => {
          const position = getCardPosition(idx);
          dragStateRef.current = {
            idx,
            started: true,
            startPosition: position ?? null,
          };
          setDraggingIdx(idx);
          dragOffset.setValue({ x: 0, y: 0 });
          dragOffset.setValue({ x: gestureState.dx, y: gestureState.dy });
        },
        onPanResponderMove: (_, gestureState) => {
          if (!dragStateRef.current.started) return;
          dragOffset.setValue({ x: gestureState.dx, y: gestureState.dy });
        },
        onPanResponderRelease: (_, gestureState) => {
          const dragState = dragStateRef.current;
          if (!dragState.started) {
            resetDragState();
            return;
          }

          const targetIdx = getNearestCardIdx(gestureState.moveX);
          const startIdx = dragState.idx;
          const startPosition = dragState.startPosition;
          const targetPosition =
            targetIdx != null ? getCardPosition(targetIdx) : undefined;

          if (startIdx != null && targetIdx != null && targetIdx !== startIdx) {
            onCardDrop?.(
              startIdx,
              targetIdx,
              startPosition ?? undefined,
              targetPosition,
            );
          }

          Animated.spring(dragOffset, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            tension: 120,
            friction: 10,
          }).start(() => {
            resetDragState();
          });
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragOffset, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            tension: 120,
            friction: 10,
          }).start(() => {
            resetDragState();
          });
        },
      }),
    [
      canReorder,
      dragOffset,
      getCardPosition,
      getNearestCardIdx,
      onCardDrop,
      resetDragState,
    ],
  );

  return (
    <View
      style={[
        styles.container,
        isCurrentTurn && styles.activeBorder,
        containerStyle,
      ]}
    >
      {isHuman ? (
        <View style={styles.humanRow}>
          <View style={[styles.humanInfo, styles.humanInfoShifted]}>
            <View style={[styles.nameRow, styles.humanNameRow]}>
              <View style={styles.humanIconBadge}>
                <Text3D style={styles.humanIconText}>
                  {player.icon ?? "🧑"}
                </Text3D>
              </View>
              {isCurrentTurn && !gameOver && <View style={styles.turnDot} />}
              <Text3D
                style={[
                  styles.name,
                  player.name === "Player 2" && styles.player2Name3d,
                ]}
              >
                {player.name}
              </Text3D>
              <View
                style={[
                  styles.winsPill,
                  wins === 2 && styles.winsPillHot,
                  isMatchPointDanger && styles.winsPillDanger,
                ]}
              >
                <Text3D
                  style={[
                    styles.winsText,
                    wins === 2 && styles.winsTextHot,
                    isMatchPointDanger && styles.winsTextDanger,
                  ]}
                >
                  W {wins}
                </Text3D>
              </View>
              {showThinking && isCurrentTurn && !gameOver && !isHuman && (
                <Text3D style={styles.thinking}> thinking…</Text3D>
              )}
            </View>
            {shouldShowScore && (
              <View style={styles.scorePill}>
                <Text3D style={styles.scoreText}>Score: {score}</Text3D>
                {zeros.size > 0 && (
                  <View style={styles.comboBadge}>
                    <Text3D style={styles.comboText}>COMBO</Text3D>
                  </View>
                )}
              </View>
            )}
            {isHuman && (
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.comboLegendDot]} />
                  <Text3D style={styles.legendText}>Zero-value combo</Text3D>
                </View>
              </View>
            )}
          </View>
          <ScrollView
            style={styles.humanCardsScroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.cardsRow, styles.humanCardsRow]}
            onLayout={(event) => {
              cardsAreaOriginRef.current = {
                x: event.nativeEvent.layout.x,
                y: event.nativeEvent.layout.y,
              };
            }}
            onScroll={(event) => {
              setCardsScrollX(event.nativeEvent.contentOffset.x);
            }}
            scrollEventThrottle={16}
          >
            {player.cards.map((card, i) => {
              const faceDown = isHuman
                ? i >= revealCount
                : !isHuman && !showCards;
              const zeroed = zeros.has(i);
              const selected = isHuman && selectedIdx === i;
              const isMoving = movingCardIdx === i;
              const canPress = canSelect || canReorder;
              const canDrag = isHuman && canReorder && !faceDown;
              const isDragging = draggingIdx === i;
              const disabled = faceDown
                ? isHuman
                  ? !canPress
                  : false
                : !canPress;
              const cardElement = (
                <Card
                  card={card}
                  faceDown={faceDown}
                  cardBackColor={cardBackColor}
                  selected={selected || isMoving}
                  zeroed={zeroed}
                  highlighted={zeroed || isMoving}
                  disabled={disabled}
                  onPress={
                    canPress
                      ? () => {
                          const layout = cardLayoutsRef.current[i];
                          const position = layout
                            ? {
                                x:
                                  cardsAreaOriginRef.current.x +
                                  layout.x -
                                  cardsScrollX,
                                y: cardsAreaOriginRef.current.y + layout.y,
                              }
                            : undefined;
                          if ((canReorder || canSelect) && onCardDoubleTap) {
                            const now = Date.now();
                            const lastTap = lastTapRef.current;
                            const isSameCard = lastTap.idx === i;
                            const withinWindow =
                              now - lastTap.time <= doubleTapWindowMs;

                            if (isSameCard && withinWindow) {
                              lastTapRef.current = { idx: null, time: 0 };
                              onCardDoubleTap?.(i, position);
                              return;
                            }

                            // Reset stale tap when crossing the threshold to avoid
                            // needing extra taps after a near-miss.
                            if (!withinWindow) {
                              lastTapRef.current = { idx: null, time: 0 };
                            }

                            lastTapRef.current = { idx: i, time: now };
                          }

                          onCardPress?.(i, position);
                        }
                      : undefined
                  }
                  size={cardSize}
                  cardWidth={cardSize === "small" ? 43 : 53}
                  cardHeight={cardSize === "small" ? 66 : 80}
                />
              );

              return (
                <View
                  key={`${card.id}-${i}`}
                  onLayout={(event) => {
                    cardLayoutsRef.current[i] = event.nativeEvent.layout;
                  }}
                >
                  {canDrag ? (
                    <Animated.View
                      {...createDragResponder(i).panHandlers}
                      style={[
                        isDragging && styles.draggingCard,
                        isDragging && {
                          transform: dragOffset.getTranslateTransform(),
                        },
                      ]}
                    >
                      {cardElement}
                    </Animated.View>
                  ) : (
                    cardElement
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View style={compact && styles.compactOpponentContent}>
          <View
            style={[
              styles.header,
              compact && styles.compactOpponentHeader,
              !gameOver && styles.headerCentered,
            ]}
          >
            <View style={styles.nameRow}>
              <View style={styles.botIconBadge}>
                <Text3D style={styles.botIconText}>
                  {player.icon ?? "🤖"}
                </Text3D>
              </View>
              {isCurrentTurn && !gameOver && <View style={styles.turnDot} />}
              <Text3D style={styles.name}>{player.name}</Text3D>
              <View
                style={[
                  styles.winsPill,
                  wins === 2 && styles.winsPillHot,
                  isMatchPointDanger && styles.winsPillDanger,
                ]}
              >
                <Text3D
                  style={[
                    styles.winsText,
                    wins === 2 && styles.winsTextHot,
                    isMatchPointDanger && styles.winsTextDanger,
                  ]}
                >
                  W {wins}
                </Text3D>
              </View>
              {showThinking && isCurrentTurn && !gameOver && !isHuman && (
                <Text3D style={styles.thinking}> thinking…</Text3D>
              )}
            </View>
            {shouldShowScore && (
              <View style={styles.scorePill}>
                <Text3D style={styles.scoreText}>Score: {score}</Text3D>
                {zeros.size > 0 && (
                  <View style={styles.comboBadge}>
                    <Text3D style={styles.comboText}>COMBO</Text3D>
                  </View>
                )}
              </View>
            )}
          </View>
          <View
            style={[
              styles.cardStackContainer,
              compact && styles.compactCardStackContainer,
              isTightCompact && styles.tightCompactCardStackContainer,
            ]}
          >
            <View
              style={[
                styles.cardStack,
                compact && styles.cardStackCompact,
                { gap: stackedCardOverlap },
              ]}
            >
              {Array.from({ length: 7 }).map((_, i) => {
                const centerIndex = 3;
                const distanceFromCenter = Math.abs(i - centerIndex);
                const arcTranslateY = isTightCompact
                  ? distanceFromCenter * -3
                  : compact
                  ? distanceFromCenter * -4
                  : distanceFromCenter * -6;
                const arcRotate = (centerIndex - i) * (isTightCompact ? 5 : compact ? 7 : 9);
                const arcScale = Math.max(
                  isTightCompact ? 0.84 : compact ? 0.88 : 0.9,
                  1 - distanceFromCenter * (isTightCompact ? 0.04 : compact ? 0.035 : 0.03),
                );

                return (
                  <View
                    key={i}
                    style={{
                      zIndex: 20 - distanceFromCenter,
                      transform: [
                        { translateY: arcTranslateY },
                        { rotate: `${arcRotate}deg` },
                        { scale: arcScale },
                      ],
                    }}
                  >
                    <Card
                      card={player.cards[i] ?? player.cards[0]}
                      faceDown
                      cardBackColor={cardBackColor}
                      size={cardSize}
                      cardWidth={isTightCompact ? 24 : compact ? 28 : 40}
                      cardHeight={isTightCompact ? 34 : compact ? 40 : 56}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginVertical: 3,
  },
  activeBorder: {
    borderColor: "#ffffff",
    borderWidth: 0.13,
    shadowColor: "#ffffff",
    shadowOpacity: 0.65,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  activeBorderLegacy: {
    borderColor: "#ffffff",
    borderWidth: 0.1,
    shadowColor: "#ffffff",
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  compactOpponentHeader: {
    position: "relative",
    zIndex: 10,
    elevation: 10,
    marginBottom: 2,
  },
  headerCentered: {
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  turnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOpacity: 0.7,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  name: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  player2Name3d: {
    textShadowColor: "rgba(255,255,255,0.55)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    transform: [{ perspective: 500 }, { rotateX: "8deg" }],
  },
  thinking: {
    color: "#ffffff",
    fontSize: 11,
    fontStyle: "italic",
  },
  winsPill: {
    backgroundColor: "rgba(246,212,58,0.2)",
    borderWidth: 1,
    borderColor: "rgba(246,212,58,0.85)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  winsPillHot: {
    backgroundColor: "rgba(50,205,50,0.2)",
    borderColor: "#32cd32",
  },
  winsPillDanger: {
    backgroundColor: "rgba(220,20,60,0.2)",
    borderColor: "#dc143c",
  },
  winsText: {
    color: "#f6d43a",
    fontSize: 10,
    fontWeight: "700",
  },
  winsTextHot: {
    color: "#32cd32",
  },
  winsTextDanger: {
    color: "#ff5a5a",
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 6,
  },
  scoreText: {
    color: "#fff",
    fontSize: 12,
  },
  comboBadge: {
    backgroundColor: "rgba(246,212,58,0.2)",
    borderWidth: 1,
    borderColor: "#f6d43a",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  comboText: {
    color: "#f6d43a",
    fontSize: 9,
    fontWeight: "bold",
  },
  botIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  botIconText: {
    fontSize: 13,
    lineHeight: 14,
  },
  humanIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(246,212,58,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  humanIconText: {
    fontSize: 13,
    lineHeight: 14,
  },
  humanRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  humanInfo: {
    minWidth: 120,
    maxWidth: 140,
    justifyContent: "flex-start",
  },
  legend: {
    marginTop: 4,
    gap: 3,
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
  comboLegendDot: {
    backgroundColor: "#4ae",
  },
  legendText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
  },
  humanInfoShifted: {
    marginTop: 20,
  },
  humanNameRow: {
    flexWrap: "wrap",
  },
  humanCardsRow: {
    flexGrow: 1,
    alignItems: "center",
    overflow: "visible",
  },
  humanCardsScroll: {
    flex: 1,
    overflow: "visible",
  },
  compactOpponentContent: {
    overflow: "visible",
  },
  cardsRow: {
    flexDirection: "row",
    paddingTop: 0,
    paddingBottom: 10,
    gap: -5,
    overflow: "visible",
  },
  cardStackContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  compactCardStackContainer: {
    marginTop: 2,
    zIndex: 0,
    elevation: 0,
  },
  tightCompactCardStackContainer: {
    marginTop: 0,
  },
  cardStack: {
    flexDirection: "row",
    gap: -20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardStackCompact: {
    gap: -16,
  },
  draggingCard: {
    zIndex: 20,
    elevation: 20,
  },
  stackedCard: {
    width: 40,
    height: 56,
    backgroundColor: "#1a3a8f",
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  stackedCardCompact: {
    borderRadius: 5,
    borderWidth: 1,
  },
  stackedCardTop: {
    position: "absolute",
    width: 56,
    height: 80,
    backgroundColor: "#1a3a8f",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  cardCount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f6d43a",
  },
});
