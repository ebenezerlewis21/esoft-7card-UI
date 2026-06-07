import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserProfile = {
  username: string;
  wins: number;
  gamesPlayed: number;
  rank: string;
  coins: number;
};

type UserProfileMap = Record<string, UserProfile>;

const CURRENT_USER_KEY = "@auth/currentUser";
const USER_PROFILES_KEY = "@auth/userProfiles";
const TEST_PROFILE_USERNAME = "test";

const DEFAULT_SIGNUP_PROFILE: Omit<UserProfile, "username"> = {
  wins: 0,
  gamesPlayed: 0,
  rank: "Unranked",
  coins: 0,
};

const DEFAULT_TEST_PROFILE: Omit<UserProfile, "username"> = {
  wins: 0,
  gamesPlayed: 0,
  rank: "Diamond",
  coins: 100,
};

const isTestEnvironment = (): boolean =>
  process.env.EXPO_PUBLIC_APP_ENV === "test";

const getDefaultProfileForUsername = (
  username: string,
): Omit<UserProfile, "username"> => {
  if (isTestEnvironment() && username === TEST_PROFILE_USERNAME) {
    return DEFAULT_TEST_PROFILE;
  }

  return DEFAULT_SIGNUP_PROFILE;
};

const readProfileMap = async (): Promise<UserProfileMap> => {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILES_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as UserProfileMap;
    return parsed ?? {};
  } catch {
    return {};
  }
};

const writeProfileMap = async (profiles: UserProfileMap): Promise<void> => {
  await AsyncStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles));
};

export const ensureUserProfile = async (
  username: string,
): Promise<UserProfile> => {
  const trimmedUsername = username.trim();
  const profiles = await readProfileMap();
  const existing = profiles[trimmedUsername];
  const defaults = getDefaultProfileForUsername(trimmedUsername);

  if (existing) {
    if (isTestEnvironment() && trimmedUsername === TEST_PROFILE_USERNAME) {
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
          [trimmedUsername]: nextProfile,
        });
        return nextProfile;
      }
    }

    return existing;
  }

  const created: UserProfile = {
    username: trimmedUsername,
    ...defaults,
  };

  await writeProfileMap({
    ...profiles,
    [trimmedUsername]: created,
  });

  return created;
};

export const setCurrentUsername = async (username: string): Promise<void> => {
  await AsyncStorage.setItem(CURRENT_USER_KEY, username.trim());
};

export const clearCurrentUsername = async (): Promise<void> => {
  await AsyncStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const username = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!username) return null;

    const trimmedUsername = username.trim();
    if (!trimmedUsername) return null;

    const profiles = await readProfileMap();
    const existing = profiles[trimmedUsername];
    if (existing) return existing;

    return await ensureUserProfile(trimmedUsername);
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

  try {
    const username = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!username) return null;

    const trimmedUsername = username.trim();
    if (!trimmedUsername) return null;

    const profiles = await readProfileMap();
    const currentProfile =
      profiles[trimmedUsername] ??
      ({
        username: trimmedUsername,
        ...getDefaultProfileForUsername(trimmedUsername),
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
      [trimmedUsername]: nextProfile,
    });

    return nextCoins;
  } catch {
    return null;
  }
};
