import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

type BannerRef = { load?: () => void };

type AdsModule = {
  default?: () => { initialize: () => Promise<unknown> };
  MobileAds?: () => { initialize: () => Promise<unknown> };
  BannerAd: React.ComponentType<{
    ref?: React.Ref<BannerRef>;
    unitId: string;
    size: string;
    onAdLoaded?: () => void;
    onAdFailedToLoad?: (error: unknown) => void;
  }>;
  BannerAdSize: {
    LARGE_ANCHORED_ADAPTIVE_BANNER: string;
    ANCHORED_ADAPTIVE_BANNER: string;
    ADAPTIVE_BANNER: string;
    [key: string]: string;
  };
  TestIds: {
    ADAPTIVE_BANNER: string;
    BANNER: string;
    [key: string]: string;
  };
};

// react-native-google-mobile-ads is a native module and is unavailable in
// environments without the native build (e.g. Expo Go), so load it lazily and
// render nothing when it cannot be resolved.
let adsModule: AdsModule | null = null;
try {
  adsModule = require("react-native-google-mobile-ads") as AdsModule;
} catch {
  adsModule = null;
}

function resolveBannerUnitId(module: AdsModule): string {
  if (Platform.OS === "android") {
    const androidUnitId =
      process.env.EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_BANNER_UNIT_ID?.trim() ?? "";
    if (androidUnitId) {
      return androidUnitId;
    }
  }

  if (Platform.OS === "ios") {
    const iosUnitId =
      process.env.EXPO_PUBLIC_GOOGLE_ADMOB_IOS_BANNER_UNIT_ID?.trim() ?? "";
    if (iosUnitId) {
      return iosUnitId;
    }
  }

  // Fall back to Google's official test unit id so the banner still renders
  // during development without serving live (and un-monetizable) ads.
  return module.TestIds.ADAPTIVE_BANNER;
}

export default function GoogleAdMobBanner(): React.ReactElement | null {
  const bannerRef = React.useRef<BannerRef | null>(null);
  const [status, setStatus] = React.useState<string>("initializing");

  React.useEffect(() => {
    if (!adsModule) {
      setStatus("native ads module unavailable (Expo Go / no native build)");
      return;
    }

    const mobileAds = adsModule.default ?? adsModule.MobileAds;
    if (!mobileAds) {
      setStatus("MobileAds entry point missing from module");
      return;
    }

    let cancelled = false;
    mobileAds()
      .initialize()
      .then(() => {
        if (!cancelled) {
          setStatus("initialized, loading ad");
          bannerRef.current?.load?.();
        }
      })
      .catch((error) => {
        console.warn("[admob] failed to initialize Google Mobile Ads", error);
        if (!cancelled) {
          setStatus(`init failed: ${String(error)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!adsModule) {
    return __DEV__ ? (
      <View style={styles.debugBox}>
        <Text style={styles.debugText}>[AdMob] {status}</Text>
      </View>
    ) : null;
  }

  const { BannerAd, BannerAdSize } = adsModule;
  const unitId = resolveBannerUnitId(adsModule);

  return (
    <View>
      <BannerAd
        ref={bannerRef}
        unitId={unitId}
        size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => {
          setStatus("loaded");
        }}
        onAdFailedToLoad={(error) => {
          console.warn("[admob] banner failed to load", error);
          setStatus(`failed to load: ${String(error)}`);
        }}
      />
      {__DEV__ && status !== "loaded" ? (
        <View style={styles.debugBox}>
          <Text style={styles.debugText}>[AdMob] {status}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  debugBox: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255, 80, 80, 0.12)",
    borderRadius: 8,
  },
  debugText: {
    color: "#ff9f9f",
    fontSize: 11,
    textAlign: "center",
  },
});
