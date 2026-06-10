import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  getCurrentEmail,
  getCurrentUserProfile,
  type UserProfile,
} from "./auth";
import type { Card, DiscardSource, GamePhase, Rank, Suit } from "@/game/logic";

export type QuickMatchPlayer = {
  playerId: string;
  playerName: string;
  joinedAt: string | undefined;
};

export type QuickMatchStatus = "WAITING" | "READY" | "IN_PROGRESS";

export type QuickMatchGamePlayer = {
  playerId: string;
  playerName: string;
  cards: Card[];
};

export type QuickMatchGame = {
  players: QuickMatchGamePlayer[];
  deck: Card[];
  discard: Card[];
  currentTurnPlayerId: string;
  phase: GamePhase;
  drawnCard: Card | null;
  drawnFrom: DiscardSource;
  message: string;
  gameOver: boolean;
  matchWins: number[];
  winsToWin: number;
  roundWinnerPlayerId: string | null;
  matchWinnerPlayerId: string | null;
};

export type QuickMatchSession = {
  matchId: string;
  status: QuickMatchStatus;
  maxPlayers: number;
  players: QuickMatchPlayer[];
  game?: QuickMatchGame | null;
};

export type QuickMatchIdentity = {
  playerId: string;
  playerName: string;
};

export type QuickMatchAction =
  | { action: "DRAW_DECK" }
  | { action: "TAKE_DISCARD" }
  | { action: "SWAP"; cardIndex: number }
  | { action: "KEEP" }
  | { action: "STOP" }
  | { action: "REORDER"; cardIndex: number; targetIndex: number }
  | { action: "NEXT_ROUND" }
  | { action: "NEW_MATCH" };

const QUICK_MATCH_PLAYER_ID_KEY = "@multiplayer/quickMatchPlayerId";

const resolveApiUrl = (path: string): string | null => {
  const configuredBase = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
  if (!configuredBase) return null;

  const mobileOverride = process.env.EXPO_PUBLIC_API_URL_DEVICE?.trim() ?? "";
  const base =
    Platform.OS !== "web" && mobileOverride
      ? mobileOverride
      : rewriteLocalhostForDevice(configuredBase);

  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
};

const rewriteLocalhostForDevice = (baseUrl: string): string => {
  if (Platform.OS === "web") {
    return baseUrl;
  }

  if (!/(localhost|127\.0\.0\.1|\[::1\])/i.test(baseUrl)) {
    return baseUrl;
  }

  const host = getExpoHostIp();
  if (!host) {
    return baseUrl;
  }

  return baseUrl.replace(/localhost|127\.0\.0\.1|\[::1\]/gi, host);
};

const getExpoHostIp = (): string | null => {
  const constantsLike = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    expoGoConfig?: { debuggerHost?: string };
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
  };

  const rawHostUri =
    constantsLike.expoConfig?.hostUri ??
    constantsLike.expoGoConfig?.debuggerHost ??
    constantsLike.manifest2?.extra?.expoClient?.hostUri ??
    "";

  const hostCandidate = rawHostUri.split(":")[0]?.trim();
  return hostCandidate || null;
};

const createLocalPlayerId = (): string =>
  `player-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const getStablePlayerId = async (): Promise<string> => {
  const email = await getCurrentEmail();
  if (email) {
    return email;
  }

  const savedPlayerId = await AsyncStorage.getItem(QUICK_MATCH_PLAYER_ID_KEY);
  if (savedPlayerId?.trim()) {
    return savedPlayerId.trim();
  }

  const nextPlayerId = createLocalPlayerId();
  await AsyncStorage.setItem(QUICK_MATCH_PLAYER_ID_KEY, nextPlayerId);
  return nextPlayerId;
};

const getPlayerName = (profile: UserProfile | null): string => {
  const profileName = profile?.name?.trim() ?? "";
  return profileName || "Player";
};

export const getQuickMatchIdentity =
  async (): Promise<QuickMatchIdentity> => {
    const [playerId, profile] = await Promise.all([
      getStablePlayerId(),
      getCurrentUserProfile(),
    ]);

    return {
      playerId,
      playerName: getPlayerName(profile),
    };
  };

const parseQuickMatchSession = (payload: unknown): QuickMatchSession | null => {
  const value = payload as Partial<QuickMatchSession> | null;
  if (!value || typeof value.matchId !== "string") {
    return null;
  }

  const status =
    value.status === "READY" || value.status === "IN_PROGRESS"
      ? value.status
      : "WAITING";
  const maxPlayers =
    typeof value.maxPlayers === "number" && Number.isFinite(value.maxPlayers)
      ? Math.max(1, Math.floor(value.maxPlayers))
      : 3;

  const players = Array.isArray(value.players)
    ? value.players
        .map((player) => {
          const candidate = player as Partial<QuickMatchPlayer>;
          const playerId = candidate.playerId?.trim() ?? "";
          const playerName = candidate.playerName?.trim() ?? "";
          if (!playerId || !playerName) {
            return null;
          }

          return {
            playerId,
            playerName,
            joinedAt: candidate.joinedAt,
          };
        })
        .filter((player): player is QuickMatchPlayer => player !== null)
    : [];

  return {
    matchId: value.matchId,
    status,
    maxPlayers,
    players,
    game: parseQuickMatchGame(value.game),
  };
};

const parseCard = (payload: unknown): Card | null => {
  const value = payload as Partial<Card> | null;
  if (
    !value ||
    typeof value.id !== "string" ||
    typeof value.rank !== "string" ||
    typeof value.suit !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    rank: value.rank as Rank,
    suit: value.suit as Suit,
  };
};

const parseCards = (payload: unknown): Card[] =>
  Array.isArray(payload)
    ? payload
        .map(parseCard)
        .filter((card): card is Card => card !== null)
    : [];

const parseQuickMatchGame = (payload: unknown): QuickMatchGame | null => {
  const value = payload as Partial<QuickMatchGame> | null;
  if (!value || !Array.isArray(value.players)) {
    return null;
  }

  const players = value.players
    .map((player) => {
      const candidate = player as Partial<QuickMatchGamePlayer>;
      const playerId = candidate.playerId?.trim() ?? "";
      const playerName = candidate.playerName?.trim() ?? "";
      if (!playerId || !playerName) {
        return null;
      }

      return {
        playerId,
        playerName,
        cards: parseCards(candidate.cards),
      };
    })
    .filter((player): player is QuickMatchGamePlayer => player !== null);

  const phase = value.phase === "drawn" ? "drawn" : "action";
  const drawnFrom =
    value.drawnFrom === "deck" || value.drawnFrom === "discard"
      ? value.drawnFrom
      : null;

  return {
    players,
    deck: parseCards(value.deck),
    discard: parseCards(value.discard),
    currentTurnPlayerId: value.currentTurnPlayerId?.trim() ?? "",
    phase,
    drawnCard: parseCard(value.drawnCard),
    drawnFrom,
    message: value.message?.trim() ?? "",
    gameOver: Boolean(value.gameOver),
    matchWins: Array.isArray(value.matchWins)
      ? value.matchWins.map((wins) =>
          typeof wins === "number" && Number.isFinite(wins)
            ? Math.max(0, Math.floor(wins))
            : 0,
        )
      : [0, 0, 0],
    winsToWin:
      typeof value.winsToWin === "number" && Number.isFinite(value.winsToWin)
        ? Math.max(1, Math.floor(value.winsToWin))
        : 3,
    roundWinnerPlayerId: value.roundWinnerPlayerId?.trim() || null,
    matchWinnerPlayerId: value.matchWinnerPlayerId?.trim() || null,
  };
};

export const joinQuickMatch = async (
  identity?: QuickMatchIdentity,
): Promise<QuickMatchSession | null> => {
    const apiUrl = resolveApiUrl("api/matchmaking/quick");
    if (!apiUrl) return null;

    const resolvedIdentity = identity ?? (await getQuickMatchIdentity());
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resolvedIdentity),
    });

    if (!response.ok) {
      return null;
    }

    return parseQuickMatchSession(await response.json());
  };

export const getQuickMatch =
  async (matchId: string): Promise<QuickMatchSession | null> => {
    const apiUrl = resolveApiUrl(
      `api/matchmaking/quick/${encodeURIComponent(matchId)}`,
    );
    if (!apiUrl) return null;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      return null;
    }

    return parseQuickMatchSession(await response.json());
  };

export const startQuickMatchGame = async (
  matchId: string,
  playerId: string,
): Promise<QuickMatchSession | null> => {
  const apiUrl = resolveApiUrl(
    `api/matchmaking/quick/${encodeURIComponent(matchId)}/start`,
  );
  if (!apiUrl) return null;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ playerId }),
  });
  if (!response.ok) {
    return null;
  }

  return parseQuickMatchSession(await response.json());
};

export const sendQuickMatchAction = async (
  matchId: string,
  playerId: string,
  action: QuickMatchAction,
): Promise<QuickMatchSession | null> => {
  const apiUrl = resolveApiUrl(
    `api/matchmaking/quick/${encodeURIComponent(matchId)}/action`,
  );
  if (!apiUrl) return null;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerId,
      ...action,
    }),
  });
  if (!response.ok) {
    return null;
  }

  return parseQuickMatchSession(await response.json());
};

export const leaveQuickMatch = async (
  matchId: string,
  playerId: string,
): Promise<void> => {
  const apiUrl = resolveApiUrl(
    `api/matchmaking/quick/${encodeURIComponent(
      matchId,
    )}/players/${encodeURIComponent(playerId)}`,
  );
  if (!apiUrl) return;

  await fetch(apiUrl, {
    method: "DELETE",
  });
};
