const { expo: appJson } = require("./app.json");

module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "local";
  const envSuffixByName = {
    local: "Local",
    development: "Dev",
    test: "Test",
    production: "",
  };
  const envSuffixBySlug = {
    local: "-local",
    development: "-dev",
    test: "-test",
    production: "",
  };

  const nameSuffix = envSuffixByName[appEnv] ?? "Dev";
  const slugSuffix = envSuffixBySlug[appEnv] ?? "-dev";
  const baseName = (appJson?.name || "7-Card Rummy").trim();
  const baseSlug = (appJson?.slug || "7card-rummy").trim();
  const googleMobileAdsAndroidAppId =
    process.env.EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_APP_ID ||
    process.env.GOOGLE_ADMOB_ANDROID_APP_ID ||
    "ca-app-pub-3940256099942544~3347511713";
  const googleMobileAdsIosAppId =
    process.env.EXPO_PUBLIC_GOOGLE_ADMOB_IOS_APP_ID ||
    process.env.GOOGLE_ADMOB_IOS_APP_ID ||
    "ca-app-pub-3940256099942544~1458002511";
  const basePlugins = config?.plugins ?? appJson?.plugins ?? [];
  const pluginsWithoutGoogleMobileAds = basePlugins.filter((plugin) => {
    if (Array.isArray(plugin)) {
      return plugin[0] !== "react-native-google-mobile-ads";
    }

    return plugin !== "react-native-google-mobile-ads";
  });

  const expoConfig = {
    ...(appJson ?? {}),
    ...(config ?? {}),
    name: nameSuffix ? `${baseName} ${nameSuffix}` : baseName,
    slug: `${baseSlug}${slugSuffix}`,
    extra: {
      ...(appJson?.extra ?? {}),
      ...(config?.extra ?? {}),
      appEnv,
    },
    plugins: [
      ...pluginsWithoutGoogleMobileAds,
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: googleMobileAdsAndroidAppId,
          iosAppId: googleMobileAdsIosAppId,
        },
      ],
    ],
  };

  if (!expoConfig.scheme) {
    expoConfig.scheme = appJson?.scheme ?? "myapp";
  }

  return {
    expo: expoConfig,
  };
};
