const { expo: appJson } = require("./app.json");

module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  const envSuffixByName = {
    development: "Dev",
    production: "",
  };
  const envSuffixByApplicationId = {
    development: ".dev",
    production: "",
  };

  const nameSuffix = envSuffixByName[appEnv] ?? "Dev";
  const applicationIdSuffix = envSuffixByApplicationId[appEnv] ?? ".dev";
  const baseName = (appJson?.name || "7-Card Rummy").trim();
  const baseSlug = (appJson?.slug || "7card-rummy-dev").trim();
  const baseApplicationId = "com.esoft.sevencardrummy";
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
    // Slug is the stable EAS project identifier — it must stay constant across
    // environments and match the slug of the project at extra.eas.projectId.
    // Environments are differentiated by name and bundle ID, not the slug.
    slug: baseSlug,
    ios: {
      ...(appJson?.ios ?? {}),
      ...(config?.ios ?? {}),
      bundleIdentifier:
        config?.ios?.bundleIdentifier ??
        appJson?.ios?.bundleIdentifier ??
        `${baseApplicationId}${applicationIdSuffix}`,
    },
    android: {
      ...(appJson?.android ?? {}),
      ...(config?.android ?? {}),
      package:
        config?.android?.package ??
        appJson?.android?.package ??
        `${baseApplicationId}${applicationIdSuffix}`,
    },
    extra: {
      ...(appJson?.extra ?? {}),
      ...(config?.extra ?? {}),
      eas: {
        ...(appJson?.extra?.eas ?? {}),
        ...(config?.extra?.eas ?? {}),
        projectId: "d6ed7ed6-0eaa-41c3-8a24-c527f1bd11b2",
      },
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

  return expoConfig;
};
