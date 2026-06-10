import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BACKGROUNDS,
  DEFAULT_BACKGROUND_ID,
  type BackgroundId,
} from "./backgrounds";
import { CARD_BACKS, DEFAULT_CARD_BACK_ID, type CardBackId } from "./cardbacks";
import {
  DEFAULT_PLAYER_ICON_ID,
  PLAYER_ICONS,
  type PlayerIconId,
} from "./playerIcons";

const SOUND_ENABLED_KEY = "@settings/soundEnabled";
const TURN_ALERT_MODE_KEY = "@settings/turnAlertMode";
const AI_DIFFICULTY_KEY = "@settings/aiDifficulty";
const PLAYER_COINS_KEY = "@profile/playerCoins";
const OWNED_BACKGROUND_IDS_KEY = "@profile/ownedBackgroundIds";
const ACTIVE_BACKGROUND_ID_KEY = "@profile/activeBackgroundId";
const OWNED_CARD_BACK_IDS_KEY = "@profile/ownedCardBackIds";
const ACTIVE_CARD_BACK_ID_KEY = "@profile/activeCardBackId";
const OWNED_PLAYER_ICON_IDS_KEY = "@profile/ownedPlayerIconIds";
const ACTIVE_PLAYER_ICON_ID_KEY = "@profile/activePlayerIconId";

const INITIAL_PLAYER_COINS = 25000;

let soundEnabled = true;
const soundListeners = new Set<(enabled: boolean) => void>();
export type TurnAlertMode = "vibrate" | "none";
let turnAlertMode: TurnAlertMode = "vibrate";
const turnAlertModeListeners = new Set<(mode: TurnAlertMode) => void>();
export type AiDifficulty = "beginner" | "pro" | "advance" | "expert";
let aiDifficulty: AiDifficulty = "pro";
const aiDifficultyListeners = new Set<(mode: AiDifficulty) => void>();
let hydratePromise: Promise<void> | null = null;

let playerCoins = INITIAL_PLAYER_COINS;
const coinsListeners = new Set<(coins: number) => void>();

let ownedBackgroundIds = new Set<BackgroundId>([DEFAULT_BACKGROUND_ID]);
const backgroundListeners = new Set<() => void>();
let activeBackgroundId: BackgroundId = DEFAULT_BACKGROUND_ID;

let ownedCardBackIds = new Set<CardBackId>([DEFAULT_CARD_BACK_ID]);
const cardBackListeners = new Set<() => void>();
let activeCardBackId: CardBackId = DEFAULT_CARD_BACK_ID;

let ownedPlayerIconIds = new Set<PlayerIconId>([DEFAULT_PLAYER_ICON_ID]);
const playerIconListeners = new Set<() => void>();
let activePlayerIconId: PlayerIconId = DEFAULT_PLAYER_ICON_ID;

let profileHydratePromise: Promise<void> | null = null;

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function getTurnAlertMode(): TurnAlertMode {
  return turnAlertMode;
}

export function getAiDifficulty(): AiDifficulty {
  return aiDifficulty;
}

export function getPlayerCoins(): number {
  return playerCoins;
}

export function subscribePlayerCoins(
  listener: (coins: number) => void,
): () => void {
  coinsListeners.add(listener);
  return () => {
    coinsListeners.delete(listener);
  };
}

export function setPlayerCoins(nextCoins: number): void {
  playerCoins = Math.max(0, Math.floor(nextCoins));
  coinsListeners.forEach((listener) => listener(playerCoins));

  void AsyncStorage.setItem(PLAYER_COINS_KEY, String(playerCoins)).catch(() => {
    writeToWebStorage(PLAYER_COINS_KEY, String(playerCoins));
  });
}

export function spendPlayerCoins(amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0 || playerCoins < amount) {
    return false;
  }

  setPlayerCoins(playerCoins - amount);
  return true;
}

export function getOwnedBackgroundIds(): BackgroundId[] {
  return Array.from(ownedBackgroundIds);
}

export function isBackgroundOwned(backgroundId: BackgroundId): boolean {
  return ownedBackgroundIds.has(backgroundId);
}

export function getActiveBackgroundId(): BackgroundId {
  return activeBackgroundId;
}

export function getOwnedCardBackIds(): CardBackId[] {
  return Array.from(ownedCardBackIds);
}

export function getActiveCardBackId(): CardBackId {
  return activeCardBackId;
}

export function getOwnedPlayerIconIds(): PlayerIconId[] {
  return Array.from(ownedPlayerIconIds);
}

export function getActivePlayerIconId(): PlayerIconId {
  return activePlayerIconId;
}

export function subscribeBackgroundSettings(listener: () => void): () => void {
  backgroundListeners.add(listener);
  return () => {
    backgroundListeners.delete(listener);
  };
}

export function subscribeCardBackSettings(listener: () => void): () => void {
  cardBackListeners.add(listener);
  return () => {
    cardBackListeners.delete(listener);
  };
}

export function subscribePlayerIconSettings(listener: () => void): () => void {
  playerIconListeners.add(listener);
  return () => {
    playerIconListeners.delete(listener);
  };
}

export function setActiveBackgroundId(backgroundId: BackgroundId): void {
  if (!ownedBackgroundIds.has(backgroundId)) return;

  activeBackgroundId = backgroundId;
  backgroundListeners.forEach((listener) => listener());

  void AsyncStorage.setItem(ACTIVE_BACKGROUND_ID_KEY, activeBackgroundId).catch(
    () => {
      writeToWebStorage(ACTIVE_BACKGROUND_ID_KEY, activeBackgroundId);
    },
  );
}

function persistOwnedBackgroundIds(): void {
  void AsyncStorage.setItem(
    OWNED_BACKGROUND_IDS_KEY,
    JSON.stringify(Array.from(ownedBackgroundIds)),
  ).catch(() => {
    writeToWebStorage(
      OWNED_BACKGROUND_IDS_KEY,
      JSON.stringify(Array.from(ownedBackgroundIds)),
    );
  });
}

function persistOwnedCardBackIds(): void {
  void AsyncStorage.setItem(
    OWNED_CARD_BACK_IDS_KEY,
    JSON.stringify(Array.from(ownedCardBackIds)),
  ).catch(() => {
    writeToWebStorage(
      OWNED_CARD_BACK_IDS_KEY,
      JSON.stringify(Array.from(ownedCardBackIds)),
    );
  });
}

function persistActiveBackgroundId(): void {
  void AsyncStorage.setItem(ACTIVE_BACKGROUND_ID_KEY, activeBackgroundId).catch(
    () => {
      writeToWebStorage(ACTIVE_BACKGROUND_ID_KEY, activeBackgroundId);
    },
  );
}

function persistActiveCardBackId(): void {
  void AsyncStorage.setItem(ACTIVE_CARD_BACK_ID_KEY, activeCardBackId).catch(
    () => {
      writeToWebStorage(ACTIVE_CARD_BACK_ID_KEY, activeCardBackId);
    },
  );
}

function persistOwnedPlayerIconIds(): void {
  void AsyncStorage.setItem(
    OWNED_PLAYER_ICON_IDS_KEY,
    JSON.stringify(Array.from(ownedPlayerIconIds)),
  ).catch(() => {
    writeToWebStorage(
      OWNED_PLAYER_ICON_IDS_KEY,
      JSON.stringify(Array.from(ownedPlayerIconIds)),
    );
  });
}

function persistActivePlayerIconId(): void {
  void AsyncStorage.setItem(
    ACTIVE_PLAYER_ICON_ID_KEY,
    activePlayerIconId,
  ).catch(() => {
    writeToWebStorage(ACTIVE_PLAYER_ICON_ID_KEY, activePlayerIconId);
  });
}

export function unlockBackground(backgroundId: BackgroundId): boolean {
  if (ownedBackgroundIds.has(backgroundId)) return true;

  ownedBackgroundIds = new Set([...ownedBackgroundIds, backgroundId]);
  backgroundListeners.forEach((listener) => listener());
  persistOwnedBackgroundIds();

  return true;
}

export function removeOwnedBackground(backgroundId: BackgroundId): boolean {
  if (!ownedBackgroundIds.has(backgroundId)) return false;
  if (ownedBackgroundIds.size <= 1) return false;

  const nextOwned = Array.from(ownedBackgroundIds).filter(
    (id) => id !== backgroundId,
  );

  if (nextOwned.length === 0) return false;

  ownedBackgroundIds = new Set(nextOwned);

  if (!ownedBackgroundIds.has(activeBackgroundId)) {
    activeBackgroundId = nextOwned[0] ?? DEFAULT_BACKGROUND_ID;
    persistActiveBackgroundId();
  }

  backgroundListeners.forEach((listener) => listener());
  persistOwnedBackgroundIds();

  return true;
}

export function replaceOwnedBackground(
  backgroundToRemove: BackgroundId,
  backgroundToAdd: BackgroundId,
): boolean {
  if (backgroundToRemove === backgroundToAdd) return false;
  if (!ownedBackgroundIds.has(backgroundToRemove)) return false;
  if (ownedBackgroundIds.has(backgroundToAdd)) return true;

  const nextOwned = Array.from(ownedBackgroundIds)
    .filter((id) => id !== backgroundToRemove)
    .concat(backgroundToAdd);

  if (nextOwned.length === 0) {
    return false;
  }

  ownedBackgroundIds = new Set(nextOwned);

  if (!ownedBackgroundIds.has(activeBackgroundId)) {
    activeBackgroundId = backgroundToAdd;
    persistActiveBackgroundId();
  }

  backgroundListeners.forEach((listener) => listener());
  persistOwnedBackgroundIds();

  return true;
}

export function setActiveCardBackId(cardBackId: CardBackId): void {
  if (!ownedCardBackIds.has(cardBackId)) return;

  activeCardBackId = cardBackId;
  cardBackListeners.forEach((listener) => listener());

  void AsyncStorage.setItem(ACTIVE_CARD_BACK_ID_KEY, activeCardBackId).catch(
    () => {
      writeToWebStorage(ACTIVE_CARD_BACK_ID_KEY, activeCardBackId);
    },
  );
}

export function unlockCardBack(cardBackId: CardBackId): boolean {
  if (ownedCardBackIds.has(cardBackId)) return true;

  ownedCardBackIds = new Set([...ownedCardBackIds, cardBackId]);
  cardBackListeners.forEach((listener) => listener());
  persistOwnedCardBackIds();

  return true;
}

export function removeOwnedCardBack(cardBackId: CardBackId): boolean {
  if (!ownedCardBackIds.has(cardBackId)) return false;
  if (ownedCardBackIds.size <= 1) return false;

  const nextOwned = Array.from(ownedCardBackIds).filter(
    (id) => id !== cardBackId,
  );

  if (nextOwned.length === 0) return false;

  ownedCardBackIds = new Set(nextOwned);

  if (!ownedCardBackIds.has(activeCardBackId)) {
    activeCardBackId = nextOwned[0] ?? DEFAULT_CARD_BACK_ID;
    persistActiveCardBackId();
  }

  cardBackListeners.forEach((listener) => listener());
  persistOwnedCardBackIds();

  return true;
}

export function replaceOwnedCardBack(
  cardBackToRemove: CardBackId,
  cardBackToAdd: CardBackId,
): boolean {
  if (cardBackToRemove === cardBackToAdd) return false;
  if (!ownedCardBackIds.has(cardBackToRemove)) return false;
  if (ownedCardBackIds.has(cardBackToAdd)) return true;

  const nextOwned = Array.from(ownedCardBackIds)
    .filter((id) => id !== cardBackToRemove)
    .concat(cardBackToAdd);

  if (nextOwned.length === 0) {
    return false;
  }

  ownedCardBackIds = new Set(nextOwned);

  if (!ownedCardBackIds.has(activeCardBackId)) {
    activeCardBackId = cardBackToAdd;
    persistActiveCardBackId();
  }

  cardBackListeners.forEach((listener) => listener());
  persistOwnedCardBackIds();

  return true;
}

export function setActivePlayerIconId(playerIconId: PlayerIconId): void {
  if (!ownedPlayerIconIds.has(playerIconId)) return;

  activePlayerIconId = playerIconId;
  playerIconListeners.forEach((listener) => listener());

  void AsyncStorage.setItem(
    ACTIVE_PLAYER_ICON_ID_KEY,
    activePlayerIconId,
  ).catch(() => {
    writeToWebStorage(ACTIVE_PLAYER_ICON_ID_KEY, activePlayerIconId);
  });
}

export function unlockPlayerIcon(playerIconId: PlayerIconId): boolean {
  if (ownedPlayerIconIds.has(playerIconId)) return true;

  ownedPlayerIconIds = new Set([...ownedPlayerIconIds, playerIconId]);
  playerIconListeners.forEach((listener) => listener());
  persistOwnedPlayerIconIds();

  return true;
}

function normalizePlayerIconId(value: string | null): PlayerIconId | null {
  if (!value) return null;

  const matched = PLAYER_ICONS.find((item) => item.id === value);
  return matched ? matched.id : null;
}

function readSoundEnabledFromWebStorage(): string | null {
  try {
    return globalThis.localStorage?.getItem(SOUND_ENABLED_KEY) ?? null;
  } catch {
    return null;
  }
}

function readFromWebStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeToWebStorage(key: string, value: string): void {
  try {
    if (typeof globalThis.localStorage === "undefined") return;
    globalThis.localStorage.setItem(key, value);
  } catch {
    // Ignore web storage failures.
  }
}

function readStorageValue(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

async function loadSoundEnabled(): Promise<void> {
  let storedValue: string | null = null;

  try {
    storedValue = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
  } catch {
    // If native storage is unavailable, fall back to web storage when possible.
    storedValue = readSoundEnabledFromWebStorage();
  }

  if (storedValue === null) return;

  const normalized = storedValue.trim().toLowerCase();
  const nextValue =
    normalized === "1" || normalized === "true" || normalized === "on";

  if (nextValue !== soundEnabled) {
    soundEnabled = nextValue;
    soundListeners.forEach((listener) => listener(soundEnabled));
  }
}

async function loadTurnAlertMode(): Promise<void> {
  let storedValue: string | null = null;

  try {
    storedValue = await AsyncStorage.getItem(TURN_ALERT_MODE_KEY);
  } catch {
    storedValue = readFromWebStorage(TURN_ALERT_MODE_KEY);
  }

  const normalized = storedValue?.trim().toLowerCase();
  const nextMode: TurnAlertMode = normalized === "none" ? "none" : "vibrate";

  if (nextMode !== turnAlertMode) {
    turnAlertMode = nextMode;
    turnAlertModeListeners.forEach((listener) => listener(turnAlertMode));
  }

  void AsyncStorage.setItem(TURN_ALERT_MODE_KEY, nextMode).catch(() => {
    writeToWebStorage(TURN_ALERT_MODE_KEY, nextMode);
  });
}

async function loadAiDifficulty(): Promise<void> {
  let storedValue: string | null = null;

  try {
    storedValue = await AsyncStorage.getItem(AI_DIFFICULTY_KEY);
  } catch {
    storedValue = readFromWebStorage(AI_DIFFICULTY_KEY);
  }

  const normalized = storedValue?.trim().toLowerCase();
  const nextMode: AiDifficulty =
    normalized === "beginner" ||
    normalized === "advance" ||
    normalized === "expert"
      ? normalized
      : "pro";

  if (nextMode !== aiDifficulty) {
    aiDifficulty = nextMode;
    aiDifficultyListeners.forEach((listener) => listener(aiDifficulty));
  }

  void AsyncStorage.setItem(AI_DIFFICULTY_KEY, nextMode).catch(() => {
    writeToWebStorage(AI_DIFFICULTY_KEY, nextMode);
  });
}

function normalizeBackgroundId(value: string | null): BackgroundId | null {
  if (!value) return null;

  const matched = BACKGROUNDS.find((item) => item.id === value);
  return matched ? matched.id : null;
}

function normalizeCardBackId(value: string | null): CardBackId | null {
  if (!value) return null;

  const matched = CARD_BACKS.find((item) => item.id === value);
  return matched ? matched.id : null;
}

function normalizeOwnedIds<T extends string>(ids: T[], fallbackId: T): Set<T> {
  const unique: T[] = [];

  for (const id of ids) {
    if (!unique.includes(id)) {
      unique.push(id);
    }
  }

  if (unique.length === 0) {
    unique.push(fallbackId);
  }

  return new Set(unique);
}

async function loadProfileSettings(): Promise<void> {
  let storedCoins: string | null = null;
  let storedOwned: string | null = null;
  let storedActive: string | null = null;
  let storedOwnedCardBacks: string | null = null;
  let storedActiveCardBack: string | null = null;
  let storedOwnedPlayerIcons: string | null = null;
  let storedActivePlayerIcon: string | null = null;

  try {
    storedCoins = await AsyncStorage.getItem(PLAYER_COINS_KEY);
    storedOwned = await AsyncStorage.getItem(OWNED_BACKGROUND_IDS_KEY);
    storedActive = await AsyncStorage.getItem(ACTIVE_BACKGROUND_ID_KEY);
    storedOwnedCardBacks = await AsyncStorage.getItem(OWNED_CARD_BACK_IDS_KEY);
    storedActiveCardBack = await AsyncStorage.getItem(ACTIVE_CARD_BACK_ID_KEY);
    storedOwnedPlayerIcons = await AsyncStorage.getItem(
      OWNED_PLAYER_ICON_IDS_KEY,
    );
    storedActivePlayerIcon = await AsyncStorage.getItem(
      ACTIVE_PLAYER_ICON_ID_KEY,
    );
  } catch {
    storedCoins = readStorageValue(PLAYER_COINS_KEY);
    storedOwned = readStorageValue(OWNED_BACKGROUND_IDS_KEY);
    storedActive = readStorageValue(ACTIVE_BACKGROUND_ID_KEY);
    storedOwnedCardBacks = readStorageValue(OWNED_CARD_BACK_IDS_KEY);
    storedActiveCardBack = readStorageValue(ACTIVE_CARD_BACK_ID_KEY);
    storedOwnedPlayerIcons = readStorageValue(OWNED_PLAYER_ICON_IDS_KEY);
    storedActivePlayerIcon = readStorageValue(ACTIVE_PLAYER_ICON_ID_KEY);
  }

  if (storedCoins !== null) {
    const parsedCoins = Number.parseInt(storedCoins, 10);
    if (Number.isFinite(parsedCoins) && parsedCoins >= 0) {
      playerCoins = Math.max(parsedCoins, INITIAL_PLAYER_COINS);
    }
  }

  if (storedOwned !== null) {
    try {
      const parsedOwned = JSON.parse(storedOwned) as unknown;
      if (Array.isArray(parsedOwned)) {
        const nextOwned = parsedOwned
          .map((value) =>
            normalizeBackgroundId(typeof value === "string" ? value : null),
          )
          .filter((value): value is BackgroundId => value !== null);

        ownedBackgroundIds = normalizeOwnedIds(
          nextOwned,
          DEFAULT_BACKGROUND_ID,
        );
      }
    } catch {
      // Keep defaults if parsing fails.
    }
  }

  if (storedOwnedCardBacks !== null) {
    try {
      const parsedOwned = JSON.parse(storedOwnedCardBacks) as unknown;
      if (Array.isArray(parsedOwned)) {
        const nextOwned = parsedOwned
          .map((value) =>
            normalizeCardBackId(typeof value === "string" ? value : null),
          )
          .filter((value): value is CardBackId => value !== null);

        ownedCardBackIds = normalizeOwnedIds(nextOwned, DEFAULT_CARD_BACK_ID);
      }
    } catch {
      // Keep defaults if parsing fails.
    }
  }

  if (storedOwnedPlayerIcons !== null) {
    try {
      const parsedOwned = JSON.parse(storedOwnedPlayerIcons) as unknown;
      if (Array.isArray(parsedOwned)) {
        const nextOwned = parsedOwned
          .map((value) =>
            normalizePlayerIconId(typeof value === "string" ? value : null),
          )
          .filter((value): value is PlayerIconId => value !== null);

        ownedPlayerIconIds = normalizeOwnedIds(
          nextOwned,
          DEFAULT_PLAYER_ICON_ID,
        );
      }
    } catch {
      // Keep defaults if parsing fails.
    }
  }

  const normalizedActiveCardBack =
    typeof storedActiveCardBack === "string"
      ? (CARD_BACKS.find((item) => item.id === storedActiveCardBack)?.id ??
        null)
      : null;
  if (
    normalizedActiveCardBack &&
    ownedCardBackIds.has(normalizedActiveCardBack)
  ) {
    activeCardBackId = normalizedActiveCardBack;
  } else if (!ownedCardBackIds.has(activeCardBackId)) {
    const firstOwnedCardBack = ownedCardBackIds.values().next().value;
    activeCardBackId = firstOwnedCardBack ?? DEFAULT_CARD_BACK_ID;
  }

  const normalizedActive = normalizeBackgroundId(storedActive);
  if (normalizedActive && ownedBackgroundIds.has(normalizedActive)) {
    activeBackgroundId = normalizedActive;
  } else if (!ownedBackgroundIds.has(activeBackgroundId)) {
    const firstOwned = ownedBackgroundIds.values().next().value;
    activeBackgroundId = firstOwned ?? DEFAULT_BACKGROUND_ID;
  }

  const normalizedActivePlayerIcon = normalizePlayerIconId(
    storedActivePlayerIcon,
  );
  if (
    normalizedActivePlayerIcon &&
    ownedPlayerIconIds.has(normalizedActivePlayerIcon)
  ) {
    activePlayerIconId = normalizedActivePlayerIcon;
  } else if (!ownedPlayerIconIds.has(activePlayerIconId)) {
    const firstOwnedPlayerIcon = ownedPlayerIconIds.values().next().value;
    activePlayerIconId = firstOwnedPlayerIcon ?? DEFAULT_PLAYER_ICON_ID;
  }

  coinsListeners.forEach((listener) => listener(playerCoins));
  backgroundListeners.forEach((listener) => listener());
  cardBackListeners.forEach((listener) => listener());
  playerIconListeners.forEach((listener) => listener());
}

export function initializeProfileSettings(): Promise<void> {
  if (!profileHydratePromise) {
    profileHydratePromise = loadProfileSettings();
  }

  return profileHydratePromise;
}

export function initializeSoundSettings(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = Promise.all([
      loadSoundEnabled(),
      loadTurnAlertMode(),
      loadAiDifficulty(),
    ]).then(() => undefined);
  }

  return hydratePromise;
}

export function setTurnAlertMode(mode: TurnAlertMode): void {
  turnAlertMode = mode;
  turnAlertModeListeners.forEach((listener) => listener(turnAlertMode));

  void AsyncStorage.setItem(TURN_ALERT_MODE_KEY, turnAlertMode).catch(() => {
    writeToWebStorage(TURN_ALERT_MODE_KEY, turnAlertMode);
  });
}

export function setAiDifficulty(mode: AiDifficulty): void {
  aiDifficulty = mode;
  aiDifficultyListeners.forEach((listener) => listener(aiDifficulty));

  void AsyncStorage.setItem(AI_DIFFICULTY_KEY, aiDifficulty).catch(() => {
    writeToWebStorage(AI_DIFFICULTY_KEY, aiDifficulty);
  });
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  soundListeners.forEach((listener) => listener(soundEnabled));

  const nextValue = soundEnabled ? "true" : "false";

  void AsyncStorage.setItem(SOUND_ENABLED_KEY, nextValue).catch(() => {
    // Keep app stable if native storage is unavailable (Expo Go / mismatch).
    writeToWebStorage(SOUND_ENABLED_KEY, nextValue);
  });
}

export function subscribeSoundEnabled(
  listener: (enabled: boolean) => void,
): () => void {
  soundListeners.add(listener);
  return () => {
    soundListeners.delete(listener);
  };
}

export function subscribeTurnAlertMode(
  listener: (mode: TurnAlertMode) => void,
): () => void {
  turnAlertModeListeners.add(listener);
  return () => {
    turnAlertModeListeners.delete(listener);
  };
}

export function subscribeAiDifficulty(
  listener: (mode: AiDifficulty) => void,
): () => void {
  aiDifficultyListeners.add(listener);
  return () => {
    aiDifficultyListeners.delete(listener);
  };
}
