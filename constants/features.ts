import Constants from "expo-constants";

// Resolve the active environment from the app manifest (baked in by
// app.config.js for every build), falling back to the public env var. Relying
// on Constants is more reliable than EXPO_PUBLIC_APP_ENV alone, which is only
// inlined when the bundler runs in the matching mode.
const constantsLike = Constants as unknown as {
  expoConfig?: { extra?: { appEnv?: string } };
};

const appEnv =
  constantsLike.expoConfig?.extra?.appEnv ??
  process.env.EXPO_PUBLIC_APP_ENV ??
  "";

const isProduction = appEnv === "production";

export const Feature = {
  aiModeOnly: {
    // AI-only mode is enabled in production; other environments keep full access.
    enabled: isProduction,
  },
  disableAuth: {
    // In production the login page hides Sign In / Sign Up and only offers
    // "Continue as Guest". Other environments keep full email/password auth.
    enabled: isProduction,
  },
} as const;
