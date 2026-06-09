import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserProfile = {
  name: string;
  wins: number;
  gamesPlayed: number;
  rank: string;
  coins: number;
};

type UserProfileMap = Record<string, UserProfile>;

const CURRENT_USER_KEY = "@auth/currentUser";
const CURRENT_EMAIL_KEY = "@auth/currentEmail";
const USER_PROFILES_KEY = "@auth/userProfiles";
const TEST_PROFILE_NAME = "test";

const DEFAULT_SIGNUP_PROFILE: Omit<UserProfile, "name"> = {
  wins: 0,
  gamesPlayed: 0,
  rank: "Unranked",
  coins: 0,
};

const DEFAULT_TEST_PROFILE: Omit<UserProfile, "name"> = {
  wins: 0,
  gamesPlayed: 0,
  rank: "Diamond",
  coins: 100,
};

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

export const getCurrentEmail = async (): Promise<string | null> => {
  const email = await AsyncStorage.getItem(CURRENT_EMAIL_KEY);
  const trimmedEmail = email?.trim().toLowerCase() ?? "";
  return trimmedEmail || null;
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
    coins: Number.isFinite(payload.balance)
      ? Math.max(0, Math.floor(payload.balance as number))
      : currentProfile.coins,
  };

  await writeProfileMap({
    ...profiles,
    [trimmedName]: nextProfile,
  });

  return nextProfile;
};

const resolveApiUrl = (path: string): string | null => {
  const base = process.env.EXPO_PUBLIC_API_URL ?? "";
  if (!base.trim()) return null;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
};

export const syncCurrentUserGamesPlayedFromBackend = async (): Promise<number | null> => {
  const profile = await syncCurrentUserProfileFromBackend();
  return profile?.gamesPlayed ?? null;
};

export const syncCurrentUserProfileFromBackend = async (): Promise<UserProfile | null> => {
  const apiUrl = resolveApiUrl("api/users/stats");
  const email = await getCurrentEmail();
  if (!apiUrl || !email) return null;

  try {
    const response = await fetch(`${apiUrl}?email=${encodeURIComponent(email)}`);
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
  if (!apiUrl || !email) return null;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        won,
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      name?: string;
      rank?: string;
      gamesPlayed?: number;
      gamesWon?: number;
      balance?: number;
    };
    const nextProfile = await writeCurrentUserProfileFromBackend(payload);
    return nextProfile?.gamesPlayed ?? null;
  } catch {
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
      const response = await fetch(apiUrl, {
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
