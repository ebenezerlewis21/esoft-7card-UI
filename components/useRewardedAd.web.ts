export function useRewardedAd(): {
  rewardedReady: boolean;
  showRewardedAd: (callbacks: {
    onEarned: () => void;
    onUnavailable?: () => void;
  }) => void;
} {
  return {
    rewardedReady: false,
    showRewardedAd: ({ onUnavailable }) => {
      onUnavailable?.();
    },
  };
}
