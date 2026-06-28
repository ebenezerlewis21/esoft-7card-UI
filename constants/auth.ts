import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

export type UserProfile = {
  name: string;
  wins: number;
  gamesPlayed: number;
  rank: string;
  coins: number;
};

export type AuthCredential = {
  token: string;
  type?: "Bearer";
  expiresAt?: string | null;
  refreshToken?: string | null;
  refreshTokenExpiresAt?: string | null;
};

export type ShopItemType =
  | "BACKGROUND"
  | "CARD_BACK"
  | "PLAYER_ICON"
  | "GAME_THEME";

export type ShopCatalogItem = {
  id: number;
  sku: string;
  name: string;
  type: ShopItemType;
  price: number;
  properties?: Record<string, unknown>;
};

export type UserShopItem = {
  id: number;
  sku: string;
  name: string;
  type: ShopItemType;
  equipped: boolean;
  properties?: Record<string, unknown>;
};

export type CreditPack = {
  id: number;
  sku: string;
  name: string;
  credits: number;
  priceUsd: number;
  storeProductId: string;
};

type UserProfileMap = Record<string, UserProfile>;

const CURRENT_USER_KEY = "@auth/currentUser";
const CURRENT_EMAIL_KEY = "@auth/currentEmail";
const CURRENT_AUTH_CREDENTIAL_KEY = "@auth/currentAuthCredential";
const GUEST_SESSION_KEY = "@auth/guestSession";
const GUEST_CREDITS_KEY = "@auth/guestCredits";
const GUEST_INITIAL_CREDITS = 2;
const SAVED_LOGIN_KEY = "@auth/savedLogin";
const USER_PROFILES_KEY = "@auth/userProfiles";
const TEST_PROFILE_NAME = "test";

const DEFAULT_SIGNUP_PROFILE: Omit<UserProfile, "name"> = {
  wins: 0,
  gamesPlayed: 0,
  rank: "Unranked",
  // New accounts start with 5 credits on successful sign up.
  coins: 5,
};

const DEFAULT_TEST_PROFILE: Omit<UserProfile, "name"> = {
  wins: 0,
  gamesPlayed: 0,
  rank: "Diamond",
  coins: 100,
};

let guestSessionActive = false;

const isTestEnvironment = (): boolean =>
  process.env.EXPO_PUBLIC_APP_ENV === "test";

const getDefaultProfileForName = (name: string): Omit<UserProfile, "name"> => {
  if (isTestEnvironment() && name === TEST_PROFILE_NAME) {
    return DEFAULT_TEST_PROFILE;
  }

  return DEFAULT_SIGNUP_PROFILE;
};

const readProfileMap = async (): Promise<UserProfileMap> => {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILES_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<
      string,
      UserProfile & { username?: string }
    > | null;
    if (!parsed) return {};

    const normalized: UserProfileMap = {};
    for (const [key, profile] of Object.entries(parsed)) {
      normalized[key] = {
        ...profile,
        name: profile.name ?? profile.username ?? key,
      };
    }

    return normalized;
  } catch {
    return {};
  }
};

const writeProfileMap = async (profiles: UserProfileMap): Promise<void> => {
  await AsyncStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles));
};

export const ensureUserProfile = async (name: string): Promise<UserProfile> => {
  const trimmedName = name.trim();
  const profiles = await readProfileMap();
  const existing = profiles[trimmedName];
  const defaults = getDefaultProfileForName(trimmedName);

  if (existing) {
    if (isTestEnvironment() && trimmedName === TEST_PROFILE_NAME) {
      const nextProfile: UserProfile = {
        ...existing,
        rank: defaults.rank,
        coins: defaults.coins,
      };

      if (
        nextProfile.rank !== existing.rank ||
        nextProfile.coins !== existing.coins
      ) {
        await writeProfileMap({
          ...profiles,
          [trimmedName]: nextProfile,
        });
        return nextProfile;
      }
    }

    return existing;
  }

  const created: UserProfile = {
    name: trimmedName,
    ...defaults,
  };

  await writeProfileMap({
    ...profiles,
    [trimmedName]: created,
  });

  return created;
};

export const setCurrentName = async (name: string): Promise<void> => {
  await AsyncStorage.setItem(CURRENT_USER_KEY, name.trim());
};

export const clearCurrentName = async (): Promise<void> => {
  await AsyncStorage.removeItem(CURRENT_USER_KEY);
};

export const setCurrentEmail = async (email: string): Promise<void> => {
  await AsyncStorage.setItem(CURRENT_EMAIL_KEY, email.trim().toLowerCase());
};

export const clearCurrentEmail = async (): Promise<void> => {
  await AsyncStorage.removeItem(CURRENT_EMAIL_KEY);
};

export const setAuthCredential = async (
  credential: AuthCredential,
): Promise<void> => {
  const normalizedToken = credential.token.trim();
  if (!normalizedToken) {
    await AsyncStorage.removeItem(CURRENT_AUTH_CREDENTIAL_KEY);
    return;
  }

  await AsyncStorage.setItem(
    CURRENT_AUTH_CREDENTIAL_KEY,
    JSON.stringify({
      token: normalizedToken,
      type: "Bearer",
      expiresAt: credential.expiresAt ?? null,
      refreshToken: credential.refreshToken ?? null,
      refreshTokenExpiresAt: credential.refreshTokenExpiresAt ?? null,
    }),
  );
  guestSessionActive = false;
  await AsyncStorage.removeItem(GUEST_SESSION_KEY);
};

export const clearAuthCredential = async (): Promise<void> => {
  await AsyncStorage.removeItem(CURRENT_AUTH_CREDENTIAL_KEY);
};

export const setGuestSession = async (): Promise<void> => {
  await AsyncStorage.setItem(GUEST_SESSION_KEY, "true");
  guestSessionActive = true;

  // Grant guest starter pack only once, then persist locally until app data
  // is removed (e.g. app uninstall/clear storage).
  const rawGuestCredits = await AsyncStorage.getItem(GUEST_CREDITS_KEY);
  const parsedGuestCredits = rawGuestCredits
    ? Number.parseFloat(rawGuestCredits)
    : Number.NaN;

  if (rawGuestCredits === null || !Number.isFinite(parsedGuestCredits)) {
    await AsyncStorage.setItem(
      GUEST_CREDITS_KEY,
      String(GUEST_INITIAL_CREDITS),
    );
  }
};

export const clearGuestSession = async (): Promise<void> => {
  guestSessionActive = false;
  await AsyncStorage.removeItem(GUEST_SESSION_KEY);
};

export const isGuestSession = async (): Promise<boolean> => {
  if (guestSessionActive) return true;

  guestSessionActive =
    (await AsyncStorage.getItem(GUEST_SESSION_KEY)) === "true";
  return guestSessionActive;
};

export const isAuthenticatedSession = async (): Promise<boolean> => {
  const credential = await getAuthCredential();
  if (credential?.token) return true;

  return isGuestSession();
};

export const getAuthCredential = async (): Promise<AuthCredential | null> => {
  try {
    const raw = await AsyncStorage.getItem(CURRENT_AUTH_CREDENTIAL_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthCredential> | null;
    const token = parsed?.token?.trim() ?? "";
    if (!token) return null;

    return {
      token,
      type: "Bearer",
      expiresAt:
        typeof parsed?.expiresAt === "string" ? parsed.expiresAt : null,
      refreshToken:
        typeof parsed?.refreshToken === "string" ? parsed.refreshToken : null,
      refreshTokenExpiresAt:
        typeof parsed?.refreshTokenExpiresAt === "string"
          ? parsed.refreshTokenExpiresAt
          : null,
    };
  } catch {
    return null;
  }
};

export const getCurrentEmail = async (): Promise<string | null> => {
  const email = await AsyncStorage.getItem(CURRENT_EMAIL_KEY);
  const trimmedEmail = email?.trim().toLowerCase() ?? "";
  if (trimmedEmail) return trimmedEmail;

  try {
    const rawSavedLogin = await AsyncStorage.getItem(SAVED_LOGIN_KEY);
    if (!rawSavedLogin) return null;

    const parsed = JSON.parse(rawSavedLogin) as { email?: string };
    const fallbackEmail = parsed.email?.trim().toLowerCase() ?? "";
    if (!fallbackEmail) return null;

    await AsyncStorage.setItem(CURRENT_EMAIL_KEY, fallbackEmail);
    return fallbackEmail;
  } catch {
    return null;
  }
};

const writeCurrentUserProfileFromBackend = async (payload: {
  name?: string;
  rank?: string;
  gamesPlayed?: number;
  gamesWon?: number;
  balance?: number;
}): Promise<UserProfile | null> => {
  const name = await AsyncStorage.getItem(CURRENT_USER_KEY);
  if (!name) return null;

  const trimmedName = name.trim();
  if (!trimmedName) return null;

  const profiles = await readProfileMap();
  const currentProfile =
    profiles[trimmedName] ??
    ({
      name: trimmedName,
      ...getDefaultProfileForName(trimmedName),
    } as UserProfile);

  const backendBalance = Number.isFinite(payload.balance)
    ? Math.max(0, Math.floor(payload.balance as number))
    : null;
  const starterCoins = DEFAULT_SIGNUP_PROFILE.coins;
  const shouldPreserveStarterCoins =
    currentProfile.gamesPlayed === DEFAULT_SIGNUP_PROFILE.gamesPlayed &&
    currentProfile.wins === DEFAULT_SIGNUP_PROFILE.wins &&
    currentProfile.rank === DEFAULT_SIGNUP_PROFILE.rank &&
    currentProfile.coins === starterCoins &&
    (backendBalance === null || backendBalance <= 0);

  const nextProfile: UserProfile = {
    ...currentProfile,
    name:
      typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim()
        : currentProfile.name,
    wins: Number.isFinite(payload.gamesWon)
      ? Math.max(0, Math.floor(payload.gamesWon as number))
      : currentProfile.wins,
    rank:
      typeof payload.rank === "string" && payload.rank.trim()
        ? payload.rank.trim()
        : currentProfile.rank,
    gamesPlayed: Number.isFinite(payload.gamesPlayed)
      ? Math.max(0, Math.floor(payload.gamesPlayed as number))
      : currentProfile.gamesPlayed,
    coins: shouldPreserveStarterCoins
      ? starterCoins
      : (backendBalance ?? currentProfile.coins),
  };

  await writeProfileMap({
    ...profiles,
    [trimmedName]: nextProfile,
  });

  return nextProfile;
};

export const resolveApiUrl = (path: string): string | null => {
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

  if (!rawHostUri) {
    return null;
  }

  const hostCandidate = rawHostUri.split(":")[0]?.trim();
  if (!hostCandidate) {
    return null;
  }

  return hostCandidate;
};

const normalizeHeaders = (
  headers: HeadersInit | undefined,
): Record<string, string> => {
  if (!headers) return {};
  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  return {
    ...headers,
  };
};

let refreshInFlight: Promise<boolean> | null = null;

const refreshAccessTokenFromBackend = async (): Promise<boolean> => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refreshUrl = resolveApiUrl("api/auth/refresh");
    const credential = await getAuthCredential();
    const refreshToken = credential?.refreshToken?.trim() ?? "";
    if (!refreshUrl || !refreshToken) {
      return false;
    }

    try {
      const response = await fetch(refreshUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refreshToken,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await clearAuthCredential();
        }
        return false;
      }

      const payload = (await response.json()) as {
        token?: string;
        accessToken?: string;
        credentialType?: "Bearer";
        expiresAt?: string;
        refreshToken?: string;
        refreshTokenExpiresAt?: string;
      };

      const nextToken =
        payload.token?.trim() ?? payload.accessToken?.trim() ?? "";
      if (!nextToken) {
        return false;
      }

      await setAuthCredential({
        token: nextToken,
        type: "Bearer",
        expiresAt: payload.expiresAt ?? null,
        refreshToken: payload.refreshToken ?? credential?.refreshToken ?? null,
        refreshTokenExpiresAt:
          payload.refreshTokenExpiresAt ??
          credential?.refreshTokenExpiresAt ??
          null,
      });

      return true;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
};

export const fetchWithAuth = async (
  url: string,
  init?: RequestInit,
): Promise<Response> => {
  const credential = await getAuthCredential();
  const headers = normalizeHeaders(init?.headers);

  if (credential?.token) {
    headers.Authorization = `Bearer ${credential.token}`;
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status !== 401 || !credential?.token) {
    return response;
  }

  const refreshed = await refreshAccessTokenFromBackend();
  if (!refreshed) {
    return response;
  }

  const nextCredential = await getAuthCredential();
  if (!nextCredential?.token) {
    return response;
  }

  const retryHeaders = normalizeHeaders(init?.headers);
  retryHeaders.Authorization = `Bearer ${nextCredential.token}`;

  return fetch(url, {
    ...init,
    headers: retryHeaders,
  });
};

export const syncCurrentUserGamesPlayedFromBackend = async (): Promise<
  number | null
> => {
  const profile = await syncCurrentUserProfileFromBackend();
  return profile?.gamesPlayed ?? null;
};

export const syncCurrentUserProfileFromBackend =
  async (): Promise<UserProfile | null> => {
    const apiUrl = resolveApiUrl("api/users/stats");
    const email = await getCurrentEmail();
    if (!apiUrl || !email) return null;

    try {
      const response = await fetchWithAuth(
        `${apiUrl}?email=${encodeURIComponent(email)}`,
      );
      if (!response.ok) return null;

      const payload = (await response.json()) as {
        name?: string;
        rank?: string;
        gamesPlayed?: number;
        gamesWon?: number;
        balance?: number;
      };

      return await writeCurrentUserProfileFromBackend(payload);
    } catch {
      return null;
    }
  };

export const incrementCurrentUserGamesPlayedFromBackend = async (
  won = false,
): Promise<number | null> => {
  const apiUrl = resolveApiUrl("api/users/stats/game-played");
  const email = await getCurrentEmail();
  if (!apiUrl || !email) {
    if (__DEV__) {
      console.log("[stats] record game skipped", {
        hasApiUrl: Boolean(apiUrl),
        hasEmail: Boolean(email),
        won,
      });
    }
    return null;
  }

  try {
    if (__DEV__) {
      console.log("[stats] record game start", { apiUrl, email, won });
    }

    const response = await fetchWithAuth(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        won,
      }),
    });

    if (!response.ok) {
      if (__DEV__) {
        console.log("[stats] record game failed", {
          status: response.status,
          email,
          won,
        });
      }
      return null;
    }

    const payload = (await response.json()) as {
      name?: string;
      rank?: string;
      gamesPlayed?: number;
      gamesWon?: number;
      balance?: number;
    };

    if (__DEV__) {
      console.log("[stats] record game success", {
        email,
        won,
        gamesPlayed: payload.gamesPlayed,
        gamesWon: payload.gamesWon,
      });
    }

    const nextProfile = await writeCurrentUserProfileFromBackend(payload);
    return nextProfile?.gamesPlayed ?? null;
  } catch {
    if (__DEV__) {
      console.log("[stats] record game request error", { email, won });
    }
    return null;
  }
};

export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const name = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!name) return null;

    const trimmedName = name.trim();
    if (!trimmedName) return null;

    const profiles = await readProfileMap();
    const existing = profiles[trimmedName];
    if (existing) return existing;

    return await ensureUserProfile(trimmedName);
  } catch {
    return null;
  }
};

export const spendCurrentUserCoins = async (
  amount: number,
): Promise<number | null> => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const apiUrl = resolveApiUrl("api/users/stats/balance/spend");
  const email = await getCurrentEmail();
  if (apiUrl && email) {
    try {
      const response = await fetchWithAuth(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.floor(amount),
        }),
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          name?: string;
          rank?: string;
          gamesPlayed?: number;
          gamesWon?: number;
          balance?: number;
        };
        const nextProfile = await writeCurrentUserProfileFromBackend(payload);
        return nextProfile?.coins ?? null;
      }

      if (response.status === 409) {
        return null;
      }
    } catch {
      // Fallback to local profile spending logic when backend is unavailable.
    }
  }

  try {
    const name = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!name) return null;

    const trimmedName = name.trim();
    if (!trimmedName) return null;

    const profiles = await readProfileMap();
    const currentProfile =
      profiles[trimmedName] ??
      ({
        name: trimmedName,
        ...getDefaultProfileForName(trimmedName),
      } as UserProfile);

    if (currentProfile.coins < amount) {
      return null;
    }

    const nextCoins = Math.max(0, currentProfile.coins - Math.floor(amount));
    const nextProfile: UserProfile = {
      ...currentProfile,
      coins: nextCoins,
    };

    await writeProfileMap({
      ...profiles,
      [trimmedName]: nextProfile,
    });

    return nextCoins;
  } catch {
    return null;
  }
};

// Award fractional credits to the current user (e.g. a 0.25 reward for
// watching a rewarded ad). Credits are stored as a floating-point balance so
// sub-1 rewards accumulate rather than being lost to integer truncation.
// Updates the local profile and returns the new balance, or null on failure.
export const awardCurrentUserCredits = async (
  amount: number,
): Promise<number | null> => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  try {
    const name = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!name) return null;

    const trimmedName = name.trim();
    if (!trimmedName) return null;

    const profiles = await readProfileMap();
    const currentProfile =
      profiles[trimmedName] ??
      ({
        name: trimmedName,
        ...getDefaultProfileForName(trimmedName),
      } as UserProfile);

    const nextCoins = Math.max(0, currentProfile.coins + amount);
    const nextProfile: UserProfile = {
      ...currentProfile,
      coins: nextCoins,
    };

    await writeProfileMap({
      ...profiles,
      [trimmedName]: nextProfile,
    });

    return nextCoins;
  } catch {
    return null;
  }
};

// Award ad credits to the current user. Fractional rewards are applied locally,
// and whenever the updated balance crosses a whole-credit boundary, that whole
// amount is also sent to backend balance storage.
export const awardCurrentUserAdCredits = async (
  amount: number,
): Promise<number | null> => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  try {
    const name = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!name) return null;

    const trimmedName = name.trim();
    if (!trimmedName) return null;

    const profiles = await readProfileMap();
    const currentProfile =
      profiles[trimmedName] ??
      ({
        name: trimmedName,
        ...getDefaultProfileForName(trimmedName),
      } as UserProfile);

    const currentCoins = Math.max(0, currentProfile.coins);
    const nextCoins = Math.max(0, currentCoins + amount);
    const wholeCreditsEarned = Math.max(
      0,
      Math.floor(nextCoins) - Math.floor(currentCoins),
    );

    const nextProfile: UserProfile = {
      ...currentProfile,
      coins: nextCoins,
    };

    await writeProfileMap({
      ...profiles,
      [trimmedName]: nextProfile,
    });

    if (wholeCreditsEarned < 1) {
      return nextCoins;
    }

    const apiUrl = resolveApiUrl("api/users/stats/balance/add");
    const email = await getCurrentEmail();
    if (!apiUrl || !email) {
      return nextCoins;
    }

    try {
      const response = await fetchWithAuth(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: wholeCreditsEarned,
        }),
      });

      if (!response.ok) {
        return nextCoins;
      }

      const payload = (await response.json()) as {
        name?: string;
        rank?: string;
        gamesPlayed?: number;
        gamesWon?: number;
        balance?: number;
      };

      const syncedProfile = await writeCurrentUserProfileFromBackend(payload);
      return syncedProfile?.coins ?? nextCoins;
    } catch {
      return nextCoins;
    }
  } catch {
    return null;
  }
};

// Guest users have no backend/profile, so their credits are kept in local
// storage (including one-time starter pack on first guest session).
export const getGuestCredits = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(GUEST_CREDITS_KEY);
    const value = raw ? Number.parseFloat(raw) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

// Add fractional credits to the guest's local balance and return the new total.
export const awardGuestCredits = async (
  amount: number,
): Promise<number | null> => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  try {
    const current = await getGuestCredits();
    const next = Math.max(0, current + amount);
    await AsyncStorage.setItem(GUEST_CREDITS_KEY, String(next));
    return next;
  } catch {
    return null;
  }
};

// Deduct credits from the guest's local balance and return the new total.
export const spendGuestCredits = async (
  amount: number,
): Promise<number | null> => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  try {
    const current = await getGuestCredits();
    if (current < amount) {
      return null;
    }

    const next = Math.max(0, current - amount);
    await AsyncStorage.setItem(GUEST_CREDITS_KEY, String(next));
    return next;
  } catch {
    return null;
  }
};

export const getShopCatalogFromBackend = async (): Promise<
  ShopCatalogItem[] | null
> => {
  const apiUrl = resolveApiUrl("api/shop/items");
  if (!apiUrl) return null;

  try {
    const response = await fetchWithAuth(apiUrl);
    if (!response.ok) return null;

    const payload = (await response.json()) as ShopCatalogItem[];
    return Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
};

export const getCreditPacksFromBackend = async (): Promise<
  CreditPack[] | null
> => {
  const apiUrl = resolveApiUrl("api/shop/credit-packs");
  if (!apiUrl) return null;

  try {
    const response = await fetchWithAuth(apiUrl);
    if (!response.ok) return null;

    const payload = (await response.json()) as CreditPack[];
    return Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
};

export const getCurrentUserShopInventoryFromBackend = async (): Promise<
  UserShopItem[] | null
> => {
  const apiUrl = resolveApiUrl("api/shop/inventory");
  const email = await getCurrentEmail();
  if (!apiUrl || !email) return null;

  try {
    const response = await fetchWithAuth(
      `${apiUrl}?email=${encodeURIComponent(email)}`,
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as UserShopItem[];
    return Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
};

export const purchaseCurrentUserShopItemFromBackend = async (
  sku: string,
): Promise<number | null> => {
  const apiUrl = resolveApiUrl("api/shop/purchase");
  const email = await getCurrentEmail();
  const normalizedSku = sku.trim();
  if (!apiUrl || !email || !normalizedSku) return null;

  try {
    const response = await fetchWithAuth(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        sku: normalizedSku,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      balance?: number;
    };
    const nextProfile = await writeCurrentUserProfileFromBackend({
      balance: payload.balance,
    });
    return nextProfile?.coins ?? null;
  } catch {
    return null;
  }
};

export const startCreditPackPurchaseFromBackend = async (
  sku: string,
): Promise<{ ok: boolean; message: string }> => {
  const apiUrl = resolveApiUrl("api/shop/credit-packs/purchase");
  const email = await getCurrentEmail();
  const normalizedSku = sku.trim();
  if (!apiUrl || !email || !normalizedSku) {
    return {
      ok: false,
      message: "Unable to start credit purchase right now.",
    };
  }

  try {
    const response = await fetchWithAuth(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        sku: normalizedSku,
        platform: Platform.OS,
      }),
    });

    if (response.ok) {
      return {
        ok: true,
        message: "Credit purchase started.",
      };
    }

    if (response.status === 501) {
      return {
        ok: false,
        message:
          "Credit purchases require in-app purchase setup before real money can be accepted.",
      };
    }

    return {
      ok: false,
      message: "Unable to start credit purchase right now.",
    };
  } catch {
    return {
      ok: false,
      message: "Unable to reach the credit purchase server.",
    };
  }
};

export const equipCurrentUserShopItemFromBackend = async (
  sku: string,
): Promise<boolean> => {
  const apiUrl = resolveApiUrl("api/shop/equip");
  const email = await getCurrentEmail();
  const normalizedSku = sku.trim();
  if (!apiUrl || !email || !normalizedSku) return false;

  try {
    const response = await fetchWithAuth(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        sku: normalizedSku,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
};
