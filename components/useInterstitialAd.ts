import React from "react";
import { Platform } from "react-native";

type InterstitialAdInstance = {
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
  InterstitialAd: {
    createForAdRequest: (
      unitId: string,
      requestOptions?: unknown,
    ) => InterstitialAdInstance;
  };
  AdEventType: {
    LOADED: string;
    CLOSED: string;
    ERROR: string;
    [key: string]: string;
  };
  TestIds: {
    INTERSTITIAL: string;
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

// If an ad is requested before one has finished loading, wait this long for it
// to load before giving up and continuing without an ad.
const MAX_WAIT_FOR_LOAD_MS = 3000;

// Retry a failed load with exponential backoff, then stop so we don't hammer
// the network / flood logs when there's no connectivity. The budget resets on a
// successful load and whenever an ad is actually requested (game over).
const MAX_LOAD_RETRIES = 4;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;

function resolveInterstitialUnitId(module: AdsModule): string {
  if (Platform.OS === "android") {
    const androidUnitId =
      process.env.EXPO_PUBLIC_GOOGLE_ADMOB_ANDROID_INTERSTITIAL_UNIT_ID?.trim() ??
      "";
    if (androidUnitId) {
      return androidUnitId;
    }
  }

  if (Platform.OS === "ios") {
    const iosUnitId =
      process.env.EXPO_PUBLIC_GOOGLE_ADMOB_IOS_INTERSTITIAL_UNIT_ID?.trim() ??
      "";
    if (iosUnitId) {
      return iosUnitId;
    }
  }

  // Fall back to Google's official test unit id so an ad still plays during
  // development without serving live (and un-monetizable) ads.
  return module.TestIds.INTERSTITIAL;
}

type UseInterstitialAd = {
  // Show the interstitial, then run onDone when it closes. If one is not loaded
  // yet, waits briefly for it; if ads are unavailable or it never loads, onDone
  // runs so game flow is never blocked.
  showAd: (onDone: () => void) => void;
  // Human-readable lifecycle status, useful for an on-screen debug indicator.
  status: string;
};

export function useInterstitialAd(): UseInterstitialAd {
  // The effect installs the real implementation here; showAd just delegates to
  // it so the returned callback stays stable across renders.
  const showImplRef = React.useRef<((onDone: () => void) => void) | null>(null);
  const [status, setStatus] = React.useState<string>("starting");

  React.useEffect(() => {
    if (!adsModule) {
      console.warn("[admob] interstitial: native module unavailable");
      setStatus("native module unavailable (Expo Go / no native build)");
      return;
    }

    const { InterstitialAd, AdEventType } = adsModule;
    const mobileAds = adsModule.default ?? adsModule.MobileAds;
    const unitId = resolveInterstitialUnitId(adsModule);
    const ad = InterstitialAd.createForAdRequest(unitId);

    let loaded = false;
    let loading = false;
    let wantShow = false;
    let onDone: (() => void) | null = null;
    let waitTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    let disposed = false;

    const clearWaitTimer = (): void => {
      if (waitTimer) {
        clearTimeout(waitTimer);
        waitTimer = null;
      }
    };

    const clearRetryTimer = (): void => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    // Schedule a backoff retry, or stop once the budget is exhausted.
    const scheduleRetry = (): void => {
      if (disposed) {
        return;
      }
      if (retryCount >= MAX_LOAD_RETRIES) {
        console.warn(
          `[admob] interstitial: giving up after ${MAX_LOAD_RETRIES} failed loads`,
        );
        setStatus(
          `unavailable — stopped after ${MAX_LOAD_RETRIES} failed attempts`,
        );
        return;
      }
      const delay = Math.min(RETRY_BASE_MS * 2 ** retryCount, RETRY_MAX_MS);
      retryCount += 1;
      clearRetryTimer();
      retryTimer = setTimeout(requestLoad, delay);
    };

    const runPendingDone = (): void => {
      const callback = onDone;
      onDone = null;
      callback?.();
    };

    const requestLoad = (): void => {
      if (disposed || loading || loaded) {
        return;
      }
      loading = true;
      setStatus("loading…");
      try {
        ad.load();
      } catch (error) {
        loading = false;
        console.warn("[admob] interstitial failed to load", error);
        setStatus(`load threw: ${String(error)}`);
        scheduleRetry();
      }
    };

    const doShow = (): void => {
      try {
        const result = ad.show();
        if (result && typeof (result as Promise<void>).catch === "function") {
          (result as Promise<void>).catch((error) => {
            console.warn("[admob] interstitial show failed", error);
            runPendingDone();
          });
        }
      } catch (error) {
        console.warn("[admob] interstitial show threw", error);
        runPendingDone();
      }
    };

    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      loaded = true;
      loading = false;
      retryCount = 0;
      clearRetryTimer();
      console.log("[admob] interstitial loaded");
      setStatus("loaded (ready)");
      if (wantShow) {
        wantShow = false;
        clearWaitTimer();
        setStatus("showing");
        doShow();
      }
    });

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      loaded = false;
      retryCount = 0; // fresh budget for preloading the next ad
      console.log("[admob] interstitial closed");
      setStatus("closed — preloading next");
      runPendingDone();
      requestLoad(); // preload the next one
    });

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      loaded = false;
      loading = false;
      console.warn("[admob] interstitial error", error);
      setStatus(`error: ${String(error)}`);
      // A waiting show() is released by its own timeout. Retry with backoff so a
      // transient failure recovers, but stop after a few so we don't hammer the
      // network / flood logs when there's no connectivity.
      scheduleRetry();
    });

    showImplRef.current = (nextOnDone: () => void) => {
      onDone = nextOnDone;

      if (loaded) {
        setStatus("showing");
        doShow();
        return;
      }

      // Not ready yet: kick off a load (if needed) and wait briefly for it.
      // A game-over is a fresh trigger, so reset the retry budget in case
      // background retries were already exhausted.
      console.log("[admob] interstitial not ready; waiting for load");
      setStatus("requested but not ready; waiting…");
      wantShow = true;
      retryCount = 0;
      clearRetryTimer();
      requestLoad();
      clearWaitTimer();
      waitTimer = setTimeout(() => {
        waitTimer = null;
        if (wantShow) {
          wantShow = false;
          console.warn(
            "[admob] interstitial not ready in time; continuing without ad",
          );
          setStatus("not ready in time — shown modal without ad");
          runPendingDone();
        }
      }, MAX_WAIT_FOR_LOAD_MS);
    };

    const startLoad = (): void => {
      console.log("[admob] interstitial: initializing + loading", { unitId });
      requestLoad();
    };

    if (mobileAds) {
      mobileAds()
        .initialize()
        .then(startLoad)
        .catch((error) => {
          console.warn("[admob] failed to initialize Google Mobile Ads", error);
          setStatus(`init failed: ${String(error)}`);
          // Try loading anyway; the SDK may already be initialized.
          startLoad();
        });
    } else {
      startLoad();
    }

    return () => {
      disposed = true;
      clearWaitTimer();
      clearRetryTimer();
      unsubLoaded();
      unsubClosed();
      unsubError();
      onDone = null;
      showImplRef.current = null;
    };
  }, []);

  const showAd = React.useCallback((onDone: () => void) => {
    if (!adsModule || !showImplRef.current) {
      onDone();
      return;
    }
    showImplRef.current(onDone);
  }, []);

  return { showAd, status };
}
