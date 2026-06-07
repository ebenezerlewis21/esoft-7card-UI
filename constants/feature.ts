type FeatureGate = {
  enabled: () => boolean;
};

const readBooleanEnv = (
  value: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "off") {
    return false;
  }
  return defaultValue;
};

const getPublicEnv = (name: string): string | undefined => {
  const env =
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {};
  return env[name];
};

export const Feature: {
  authenticate: FeatureGate;
  thirdPartyAuth: FeatureGate;
  skeleton: FeatureGate;
  lobbyScreen: FeatureGate;
  gameScreenAd: FeatureGate;
} = {
  authenticate: {
    enabled: () =>
      readBooleanEnv(getPublicEnv("EXPO_PUBLIC_FEATURE_AUTHENTICATE"), true),
  },
  thirdPartyAuth: {
    enabled: () =>
      readBooleanEnv(
        getPublicEnv("EXPO_PUBLIC_FEATURE_THIRD_PARTY_AUTH"),
        true,
      ),
  },
  skeleton: {
    enabled: () =>
      readBooleanEnv(getPublicEnv("EXPO_PUBLIC_FEATURE_SKELETON"), true),
  },
  lobbyScreen: {
    enabled: () =>
      readBooleanEnv(getPublicEnv("EXPO_PUBLIC_FEATURE_LOBBY_SCREEN"), true),
  },
  gameScreenAd: {
    enabled: () =>
      readBooleanEnv(getPublicEnv("EXPO_PUBLIC_FEATURE_GAME_SCREEN_AD"), true),
  },
};
