import React from "react";
import Constants from "expo-constants";
import { AppState, Platform, StyleSheet, View } from "react-native";

type GoogleMobileAdsModule = {
  default: () => {
    initialize: () => Promise<unknown>;
    setRequestConfiguration: (config: {
      testDeviceIdentifiers: string[];
    }) => Promise<unknown>;
  };
  BannerAd: React.ComponentType<{
    ref?: React.Ref<{ load?: () => void }>;
    unitId: string;
    size: string;
    requestOptions?: {
      keywords?: string[];
    };
    onAdFailedToLoad?: (error: unknown) => void;
  }>;
  BannerAdSize: {
    LARGE_ANCHORED_ADAPTIVE_BANNER: string;
  };
  TestIds: {
    ADAPTIVE_BANNER: string;
  };
};

const getProductionUnitId = (): string => {
  if (Platform.OS === "android") {
    return (
      process.env.EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_BANNER_UNIT_ID?.trim() ?? ""
    );
  }

  if (Platform.OS === "ios") {
    return (
      process.env.EXPO_PUBLIC_GOOGLE_ADMOB_IOS_BANNER_UNIT_ID?.trim() ?? ""
    );
  }

  return "";
};

const getAdUnitId = (adsModule: GoogleMobileAdsModule): string => {
  if (__DEV__) {
    return adsModule.TestIds.ADAPTIVE_BANNER;
  }

  return getProductionUnitId();
};

export default function GoogleAdMobBanner(): React.ReactElement | null {
  const bannerRef = React.useRef<{ load?: () => void } | null>(null);
  const [adsModule, setAdsModule] =
    React.useState<GoogleMobileAdsModule | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const adUnitId = adsModule ? getAdUnitId(adsModule) : "";

  React.useEffect(() => {
    let cancelled = false;

    if (Platform.OS === "web" || Constants.appOwnership === "expo") {
      return () => {
        cancelled = true;
      };
    }

    const initializeAds = async (): Promise<void> => {
      try {
        const loadedAdsModule = (await import(
          "react-native-google-mobile-ads"
        )) as GoogleMobileAdsModule;

        await loadedAdsModule.default().setRequestConfiguration({
          testDeviceIdentifiers: ["EMULATOR"],
        });
        await loadedAdsModule.default().initialize();

        if (!cancelled) {
          setAdsModule(loadedAdsModule);
          setIsReady(true);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("[admob] failed to initialize Google Mobile Ads", error);
        }
      }
    };

    void initializeAds();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== "ios" || !isReady) {
      return undefined;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        bannerRef.current?.load?.();
      }
    });

    return () => subscription.remove();
  }, [isReady]);

  if (Platform.OS === "web" || !adsModule || !adUnitId || !isReady) {
    return null;
  }

  const { BannerAd, BannerAdSize } = adsModule;

  return (
    <View style={styles.container}>
      <BannerAd
        ref={bannerRef}
        unitId={adUnitId}
        size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          keywords: ["cards", "poker", "game"],
        }}
        onAdFailedToLoad={(error) => {
          if (__DEV__) {
            console.warn("[admob] banner failed to load", error);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 90,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
