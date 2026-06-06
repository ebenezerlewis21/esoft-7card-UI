import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    BACKGROUNDS,
    DEFAULT_BACKGROUND_ID,
    type BackgroundId,
} from "./backgrounds";
import { CARD_BACKS, DEFAULT_CARD_BACK_ID, type CardBackId } from "./cardbacks";

const SOUND_ENABLED_KEY = "@settings/soundEnabled";
const PLAYER_COINS_KEY = "@profile/playerCoins";
const OWNED_BACKGROUND_IDS_KEY = "@profile/ownedBackgroundIds";
const ACTIVE_BACKGROUND_ID_KEY = "@profile/activeBackgroundId";
const OWNED_CARD_BACK_IDS_KEY = "@profile/ownedCardBackIds";
const ACTIVE_CARD_BACK_ID_KEY = "@profile/activeCardBackId";

const INITIAL_PLAYER_COINS = 25000;

let soundEnabled = true;
const soundListeners = new Set<(enabled: boolean) => void>();
let hydratePromise: Promise<void> | null = null;

let playerCoins = INITIAL_PLAYER_COINS;
const coinsListeners = new Set<(coins: number) => void>();

let ownedBackgroundIds = new Set<BackgroundId>([DEFAULT_BACKGROUND_ID]);
const backgroundListeners = new Set<() => void>();
let activeBackgroundId: BackgroundId = DEFAULT_BACKGROUND_ID;

let ownedCardBackIds = new Set<CardBackId>([DEFAULT_CARD_BACK_ID]);
const cardBackListeners = new Set<() => void>();
let activeCardBackId: CardBackId = DEFAULT_CARD_BACK_ID;

let profileHydratePromise: Promise<void> | null = null;

export function isSoundEnabled(): boolean {
  return soundEnabled;
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

export function unlockBackground(backgroundId: BackgroundId): void {
  if (ownedBackgroundIds.has(backgroundId)) return;

  ownedBackgroundIds = new Set([...ownedBackgroundIds, backgroundId]);
  backgroundListeners.forEach((listener) => listener());

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

export function unlockCardBack(cardBackId: CardBackId): void {
  if (ownedCardBackIds.has(cardBackId)) return;

  ownedCardBackIds = new Set([...ownedCardBackIds, cardBackId]);
  cardBackListeners.forEach((listener) => listener());

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

function normalizeBackgroundId(value: string | null): BackgroundId | null {
  if (!value) return null;

  const matched = BACKGROUNDS.find((item) => item.id === value);
  return matched ? matched.id : null;
}

async function loadProfileSettings(): Promise<void> {
  let storedCoins: string | null = null;
  let storedOwned: string | null = null;
  let storedActive: string | null = null;
  let storedOwnedCardBacks: string | null = null;
  let storedActiveCardBack: string | null = null;

  try {
    storedCoins = await AsyncStorage.getItem(PLAYER_COINS_KEY);
    storedOwned = await AsyncStorage.getItem(OWNED_BACKGROUND_IDS_KEY);
    storedActive = await AsyncStorage.getItem(ACTIVE_BACKGROUND_ID_KEY);
    storedOwnedCardBacks = await AsyncStorage.getItem(OWNED_CARD_BACK_IDS_KEY);
    storedActiveCardBack = await AsyncStorage.getItem(ACTIVE_CARD_BACK_ID_KEY);
  } catch {
    storedCoins = readStorageValue(PLAYER_COINS_KEY);
    storedOwned = readStorageValue(OWNED_BACKGROUND_IDS_KEY);
    storedActive = readStorageValue(ACTIVE_BACKGROUND_ID_KEY);
    storedOwnedCardBacks = readStorageValue(OWNED_CARD_BACK_IDS_KEY);
    storedActiveCardBack = readStorageValue(ACTIVE_CARD_BACK_ID_KEY);
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

        if (nextOwned.length > 0) {
          ownedBackgroundIds = new Set(nextOwned);
        }
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
            typeof value === "string"
              ? (CARD_BACKS.find((item) => item.id === value)?.id ?? null)
              : null,
          )
          .filter((value): value is CardBackId => value !== null);

        if (nextOwned.length > 0) {
          ownedCardBackIds = new Set(nextOwned);
        }
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

  coinsListeners.forEach((listener) => listener(playerCoins));
  backgroundListeners.forEach((listener) => listener());
  cardBackListeners.forEach((listener) => listener());
}

export function initializeProfileSettings(): Promise<void> {
  if (!profileHydratePromise) {
    profileHydratePromise = loadProfileSettings();
  }

  return profileHydratePromise;
}

export function initializeSoundSettings(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = loadSoundEnabled();
  }

  return hydratePromise;
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
