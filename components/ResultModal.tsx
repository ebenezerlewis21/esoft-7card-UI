import { calcHandScore, type Player } from "@/game/logic";
import React from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import Text3D from "./Text3D";

type ResultModalProps = {
  visible: boolean;
  players: Player[];
  stopMessage: string;
  matchWins?: number[];
  winsToWin?: number;
  matchWinnerIdx?: number | null;
  onNewGame: () => void;
  onBackToLobby?: () => void;
};

export default function ResultModal({
  visible,
  players,
  stopMessage,
  matchWins,
  winsToWin,
  matchWinnerIdx,
  onNewGame,
  onBackToLobby,
}: ResultModalProps): React.ReactElement | null {
  if (!players || !visible) return null;

  const scores = players
    .map((p, i) => ({ name: p.name, score: calcHandScore(p.cards), idx: i }))
    .sort((a, b) => a.score - b.score);

  const winner = scores[0];
  const safeWins = matchWins ?? [0, 0, 0];
  const targetWins = winsToWin ?? 3;
  const isMatchOver = matchWinnerIdx !== null;
  const matchLeader =
    matchWinnerIdx !== null && matchWinnerIdx !== undefined
      ? (players[matchWinnerIdx]?.name ?? winner.name)
      : winner.name;

  return (
    <Modal
      visible={visible}
      transparent
      presentationStyle="overFullScreen"
      animationType="fade"
      supportedOrientations={["landscape", "landscape-left", "landscape-right"]}
      onRequestClose={onNewGame}
    >
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text3D style={styles.title}>🃏 Game Over!</Text3D>
          <Text3D style={styles.subtitle}>{stopMessage}</Text3D>

          <View style={styles.divider} />

          {scores.map((s, i) => (
            <View key={`${s.name}-${i}`} style={styles.row}>
              <Text3D style={[styles.playerName, i === 0 && styles.winner]}>
                {i === 0 ? "🏆  " : "     "}
                {s.name}
              </Text3D>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.scoreBadge,
                    i === 0 && styles.scoreBadgeWinner,
                  ]}
                >
                  <Text3D style={[styles.scoreVal, i === 0 && styles.winner]}>
                    {s.score} pts
                  </Text3D>
                </View>
                <View style={styles.winsBadge}>
                  <Text3D style={styles.winsVal}>
                    {safeWins[s.idx] ?? 0}/{targetWins} W
                  </Text3D>
                </View>
              </View>
            </View>
          ))}

          <View style={styles.divider} />

          <Text3D style={styles.winnerLine}>
            {isMatchOver
              ? `${matchLeader} wins the match (first to ${targetWins})!`
              : `${winner.name} wins this round with ${winner.score} points!`}
          </Text3D>

          <TouchableOpacity
            onPress={onNewGame}
            activeOpacity={0.85}
            style={styles.newGameBtn}
          >
            <Text3D style={styles.newGameText}>
              {isMatchOver ? "Start New Match" : "Next Round"}
            </Text3D>
          </TouchableOpacity>

          {isMatchOver && onBackToLobby && (
            <TouchableOpacity
              onPress={onBackToLobby}
              activeOpacity={0.85}
              style={styles.newGameBtn}
            >
              <Text3D style={styles.newGameText}>Back to Lobby</Text3D>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  box: {
    backgroundColor: "#1a5c2e",
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "#f6d43a",
    padding: 28,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#f6d43a",
    marginBottom: 6,
  },
  subtitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    width: "100%",
    marginVertical: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginVertical: 5,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  playerName: {
    color: "#fff",
    fontSize: 15,
    flex: 1,
  },
  winner: {
    color: "#f6d43a",
    fontWeight: "bold",
  },
  scoreBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreBadgeWinner: {
    backgroundColor: "rgba(246,212,58,0.15)",
    borderWidth: 1,
    borderColor: "#f6d43a",
  },
  scoreVal: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  winsBadge: {
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  winsVal: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  winnerLine: {
    color: "#f6d43a",
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 6,
  },
  newGameBtn: {
    marginTop: 10,
    backgroundColor: "#f6d43a",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 24,
  },
  newGameText: {
    color: "#1a1a2e",
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
