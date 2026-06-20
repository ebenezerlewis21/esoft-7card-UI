export function useInterstitialAd(): {
  showAd: (onDone: () => void) => void;
  status: string;
} {
  return {
    showAd: (onDone) => {
      onDone();
    },
    status: "web-disabled",
  };
}
