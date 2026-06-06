import React, { useRef } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import type { Card as CardType } from "@/game/logic";
import Card from "./Card";
import Text3D from "./Text3D";

type CenterZoneProps = {
  deckCount: number;
  discardTop: CardType | null;
  drawnCard: CardType | null;
  drawnFrom: "deck" | "discard" | null;
  cardBackColor?: string;
  canDrawDeck: boolean;
  canTakeDiscard: boolean;
  onDrawDeck: () => void;
  onTakeDiscard: () => void;
  onDeckPositionChange?: (position: { x: number; y: number }) => void;
  onDiscardPositionChange?: (position: { x: number; y: number }) => void;
  onStop?: () => void;
  isMyTurn?: boolean;
};

export default function CenterZone({
  deckCount,
  discardTop,
  drawnCard,
  drawnFrom,
  cardBackColor = "#1a3a8f",
  canDrawDeck,
  canTakeDiscard,
  onDrawDeck,
  onTakeDiscard,
  onDeckPositionChange,
  onDiscardPositionChange,
  onStop,
  isMyTurn,
}: CenterZoneProps): React.ReactElement {
  const deckPileOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const discardPileOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  return (
    <View
      style={[
        styles.zone,
        canDrawDeck && canTakeDiscard && styles.zoneHighlighted,
      ]}
    >
      <View
        style={styles.pileArea}
        onLayout={(event) => {
          deckPileOriginRef.current = event.nativeEvent.layout;
        }}
      >
        <Text3D style={styles.label}>
          {drawnFrom === "deck" ? "DRAWN" : "DECK"}
        </Text3D>
        <View style={[styles.pileHighlightShell, canDrawDeck && styles.pileHighlightShellActive]}>
          {drawnFrom === "deck" && drawnCard ? (
            <Card card={drawnCard} selected size="large" />
          ) : (
            <TouchableOpacity
              onPress={onDrawDeck}
              disabled={!canDrawDeck}
              activeOpacity={0.8}
              onLayout={(event) => {
                const slotLayout = event.nativeEvent.layout;
                onDeckPositionChange?.({
                  // Target deck card center (large card is 60x88)
                  x: deckPileOriginRef.current.x + slotLayout.x + 30,
                  y: deckPileOriginRef.current.y + slotLayout.y + 44,
                });
              }}
            >
              <View
                style={[
                  styles.deckCard,
                  { backgroundColor: cardBackColor },
                  !canDrawDeck && styles.dimmed,
                  canDrawDeck && styles.highlighted,
                ]}
              >
                {deckCount > 0 ? (
                  <>
                    <View style={styles.deckPattern} />
                    <Text3D style={styles.deckSymbol}>🂠</Text3D>
                  </>
                ) : (
                  <Text3D style={styles.emptyText}>Empty</Text3D>
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>
        <Text3D style={styles.count}>
          {drawnFrom === "deck" && drawnCard
            ? "← select to swap"
            : `${deckCount} left`}
        </Text3D>
      </View>

      {isMyTurn && onStop && (
        <TouchableOpacity
          style={styles.stopButton}
          onPress={onStop}
          activeOpacity={0.8}
        >
          <Text3D style={styles.stopButtonText}>🛑</Text3D>
        </TouchableOpacity>
      )}

      <View
        style={styles.pileArea}
        onLayout={(event) => {
          discardPileOriginRef.current = event.nativeEvent.layout;
        }}
      >
        <Text3D style={styles.label}>
          {drawnFrom === "discard" ? "DRAWN" : "DISCARD"}
        </Text3D>
        <View
          style={[styles.pileHighlightShell, canTakeDiscard && styles.pileHighlightShellActive]}
          onLayout={(event) => {
            const slotLayout = event.nativeEvent.layout;
            onDiscardPositionChange?.({
              // Target the discard card center (large card is 60x88)
              x: discardPileOriginRef.current.x + slotLayout.x + 30,
              y: discardPileOriginRef.current.y + slotLayout.y + 44,
            });
          }}
        >
          {drawnFrom === "discard" && drawnCard ? (
            <Card card={drawnCard} selected size="large" />
          ) : discardTop ? (
            <Card
              card={discardTop}
              highlighted={canTakeDiscard}
              disabled={!canTakeDiscard}
              onPress={canTakeDiscard ? onTakeDiscard : undefined}
              size="large"
              rotateZ="0deg"
              liftAmount={-12}
            />
          ) : (
            <View style={styles.emptyPile}>
              <Text3D style={styles.emptyText}>—</Text3D>
            </View>
          )}
        </View>
        <Text3D style={styles.count}>
          {drawnFrom === "discard" && drawnCard
            ? "← select to swap"
            : "tap to take"}
        </Text3D>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginVertical: 3,
  },
  zoneHighlighted: {
    borderColor: "#ffffff",
    borderWidth: 0.1,
    shadowColor: "#ffffff",
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  pileArea: {
    alignItems: "center",
    gap: 4,
  },
  pileHighlightShell: {
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  pileHighlightShellActive: {
    borderColor: "rgba(246,212,58,0.95)",
    backgroundColor: "rgba(246,212,58,0.08)",
    shadowColor: "#f6d43a",
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: "600",
  },
  count: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
  },
  deckCard: {
    width: 56,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#1a3a8f",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
    overflow: "hidden",
  },
  deckPattern: {
    position: "absolute",
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  deckSymbol: {
    fontSize: 24,
    color: "rgba(255,255,255,0.7)",
  },
  dimmed: {
    opacity: 0.55,
  },
  highlighted: {
    borderColor: "rgba(255,255,255,0.1)",
    borderWidth: 2.5,
    shadowColor: "#ffffff",
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  emptyPile: {
    width: 56,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
  },
  stopButton: {
    backgroundColor: "#c0392b",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  stopButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
