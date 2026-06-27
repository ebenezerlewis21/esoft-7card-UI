import Constants from "expo-constants";

// Centralized snapshot of the public runtime environment. Each value is read
// via a literal `process.env.EXPO_PUBLIC_*` reference because Expo only inlines
// statically-referenced public env vars into the bundle (dynamic access such as
// `process.env[name]` is NOT replaced and would always be undefined).
export const publicEnv: Record<string, string | undefined> = {
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_API_URL_DEVICE: process.env.EXPO_PUBLIC_API_URL_DEVICE,
  EXPO_PUBLIC_DEV_LOGIN_PATH: process.env.EXPO_PUBLIC_DEV_LOGIN_PATH,
  EXPO_PUBLIC_DEV_SIGNUP_PATH: process.env.EXPO_PUBLIC_DEV_SIGNUP_PATH,
  EXPO_PUBLIC_DEV_FORGOT_PASSWORD_PATH:
    process.env.EXPO_PUBLIC_DEV_FORGOT_PASSWORD_PATH,
  EXPO_PUBLIC_FEATURE_THIRD_PARTY_AUTH:
    process.env.EXPO_PUBLIC_FEATURE_THIRD_PARTY_AUTH,
  EXPO_PUBLIC_FEATURE_MULTI_MODE: process.env.EXPO_PUBLIC_FEATURE_MULTI_MODE,
  EXPO_PUBLIC_FEATURE_ENABLE_AUTH: process.env.EXPO_PUBLIC_FEATURE_ENABLE_AUTH,
  EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_APP_ID:
    process.env.EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_APP_ID,
  EXPO_PUBLIC_GOOGLE_ADMOB_IOS_APP_ID:
    process.env.EXPO_PUBLIC_GOOGLE_ADMOB_IOS_APP_ID,
  EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_BANNER_UNIT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_BANNER_UNIT_ID,
  EXPO_PUBLIC_GOOGLE_ADMOB_IOS_BANNER_UNIT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_ADMOB_IOS_BANNER_UNIT_ID,
  EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_INTERSTITIAL_UNIT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_INTERSTITIAL_UNIT_ID,
  EXPO_PUBLIC_GOOGLE_ADMOB_IOS_INTERSTITIAL_UNIT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_ADMOB_IOS_INTERSTITIAL_UNIT_ID,
  EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_REWARDED_UNIT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_REWARDED_UNIT_ID,
  EXPO_PUBLIC_GOOGLE_ADMOB_IOS_REWARDED_UNIT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_ADMOB_IOS_REWARDED_UNIT_ID,
};

export const logPublicEnv = (): void => {
  const appEnvFromExpoConfig =
    (Constants.expoConfig?.extra as { appEnv?: string } | undefined)?.appEnv ??
    undefined;
  const publicAppEnv = publicEnv.EXPO_PUBLIC_APP_ENV;
  const resolvedAppEnv = appEnvFromExpoConfig ?? publicAppEnv ?? "(unset)";

  console.log(`[env] appEnv=${resolvedAppEnv}`);
  console.log(`[env] expoConfig.extra.appEnv=${appEnvFromExpoConfig ?? "(unset)"}`);
  console.log(`[env] EXPO_PUBLIC_APP_ENV=${publicAppEnv ?? "(unset)"}`);
  console.log("[env] Public environment variables at launch:");
  for (const [key, value] of Object.entries(publicEnv)) {
    console.log(`[env] ${key}=${value ?? "(unset)"}`);
  }
};
