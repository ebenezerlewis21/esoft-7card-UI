// Parse a boolean feature flag from its raw env string. Anything other than a
// truthy token ("true"/"1"/"yes"/"on", case-insensitive) resolves to false, so
// unset or malformed values default to disabled.
const flagEnabled = (raw: string | undefined): boolean => {
  const value = raw?.trim().toLowerCase() ?? "";
  return value === "true" || value === "1" || value === "yes" || value === "on";
};

// NOTE: Expo only inlines statically-referenced `process.env.EXPO_PUBLIC_*`
// values into the bundle, so each flag must be read by its literal name.
export const Feature = {
  multiMode: {
    // When enabled, multiplayer modes (Quick Match, friend matches) are
    // available. When disabled, those routes show the under-construction
    // screen (AI-only experience). Defaults to false.
    enabled: flagEnabled(process.env.EXPO_PUBLIC_FEATURE_MULTI_MODE),
  },
  enableAuth: {
    // When enabled, the login page shows full email/password auth (Sign In /
    // Sign Up). When disabled, it only offers "Continue as Guest". Defaults to
    // false.
    enabled: flagEnabled(process.env.EXPO_PUBLIC_FEATURE_ENABLE_AUTH),
  },
  thirdPartyAuth: {
    // When enabled, the login page shows third-party (social) auth options.
    // Defaults to false.
    enabled: flagEnabled(process.env.EXPO_PUBLIC_FEATURE_THIRD_PARTY_AUTH),
  },
} as const;
