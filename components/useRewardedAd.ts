import React from "react";
import { Platform } from "react-native";

type RewardedAdInstance = {
  addAdEventListener: (
    type: string,
    handler: (payload?: unknown) => void,
  ) => () => void;
  load: () => void;
  show: () => Promise<void> | void;
};

type AdsModule = {
  default?: () => { initialize: () => Promise<unknown> };
  MobileAds?: () => { initialize: () => Promise<unknown> };
  RewardedAd: {
    createForAdRequest: (
      unitId: string,
      requestOptions?: unknown,
    ) => RewardedAdInstance;
  };
  RewardedAdEventType: {
    LOADED: string;
    EARNED_REWARD: string;
    [key: string]: string;
  };
  AdEventType: {
    CLOSED: string;
    ERROR: string;
    [key: string]: string;
  };
  TestIds: {
    REWARDED: string;
    [key: string]: string;
  };
};

// react-native-google-mobile-ads is a native module and is unavailable in
// environments without the native build (e.g. Expo Go), so load it lazily and
// degrade to a no-op when it cannot be resolved.
let adsModule: AdsModule | null = null;
try {
  adsModule = require("react-native-google-mobile-ads") as AdsModule;
} catch {
  adsModule = null;
}

function resolveRewardedUnitId(module: AdsModule): string {
  if (Platform.OS === "android") {
    const androidUnitId =
      process.env.EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_REWARDED_UNIT_ID?.trim() ??
      "";
    if (androidUnitId) {
      return androidUnitId;
    }
  }

  if (Platform.OS === "ios") {
    const iosUnitId =
      process.env.EXPO_PUBLIC_GOOGLE_ADMOB_IOS_REWARDED_UNIT_ID?.trim() ?? "";
    if (iosUnitId) {
      return iosUnitId;
    }
  }

  // Fall back to Google's official test unit id so a rewarded ad still plays
  // during development without serving live (and un-monetizable) ads.
  return module.TestIds.REWARDED;
}

type ShowRewardedAd = (callbacks: {
  // Fired once when the user has watched enough of the ad to earn the reward.
  onEarned: () => void;
  // Fired when no ad could be shown (ads unavailable or none loaded yet).
  onUnavailable?: () => void;
}) => void;

type UseRewardedAd = {
  // True when an ad is loaded and ready to show.
  rewardedReady: boolean;
  showRewardedAd: ShowRewardedAd;
};

export function useRewardedAd(): UseRewardedAd {
  const adRef = React.useRef<RewardedAdInstance | null>(null);
  const [rewardedReady, setRewardedReady] = React.useState(false);
  const earnedRef = React.useRef(false);
  const onEarnedRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!adsModule) {
      return;
    }

    const { RewardedAd, RewardedAdEventType, AdEventType } = adsModule;
    const mobileAds = adsModule.default ?? adsModule.MobileAds;
    const unitId = resolveRewardedUnitId(adsModule);
    const ad = RewardedAd.createForAdRequest(unitId);
    adRef.current = ad;

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setRewardedReady(true);
    });

    const unsubEarned = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        earnedRef.current = true;
      },
    );

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setRewardedReady(false);
      // Grant the reward only if the user actually earned it.
      if (earnedRef.current) {
        onEarnedRef.current?.();
      }
      earnedRef.current = false;
      onEarnedRef.current = null;
      // Preload the next rewarded ad.
      ad.load();
    });

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      setRewardedReady(false);
      earnedRef.current = false;
      onEarnedRef.current = null;
      console.warn("[admob] rewarded error", error);
    });

    const startLoad = (): void => {
      try {
        ad.load();
      } catch (error) {
        console.warn("[admob] rewarded failed to load", error);
      }
    };

    if (mobileAds) {
      mobileAds()
        .initialize()
        .then(startLoad)
        .catch((error) => {
          console.warn("[admob] failed to initialize Google Mobile Ads", error);
        });
    } else {
      startLoad();
    }

    return () => {
      unsubLoaded();
      unsubEarned();
      unsubClosed();
      unsubError();
      adRef.current = null;
      earnedRef.current = false;
      onEarnedRef.current = null;
    };
  }, []);

  const showRewardedAd = React.useCallback<ShowRewardedAd>(
    ({ onEarned, onUnavailable }) => {
      const ad = adRef.current;
      if (!adsModule || !ad || !rewardedReady) {
        onUnavailable?.();
        return;
      }

      earnedRef.current = false;
      onEarnedRef.current = onEarned;
      try {
        const result = ad.show();
        if (result && typeof (result as Promise<void>).catch === "function") {
          (result as Promise<void>).catch((error) => {
            console.warn("[admob] rewarded show failed", error);
            onEarnedRef.current = null;
            onUnavailable?.();
          });
        }
      } catch (error) {
        console.warn("[admob] rewarded show threw", error);
        onEarnedRef.current = null;
        onUnavailable?.();
      }
    },
    [rewardedReady],
  );

  return { rewardedReady, showRewardedAd };
}
