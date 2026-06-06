import React from "react";
import * as ScreenOrientation from "expo-screen-orientation";
import GameScreen from "@/screens/GameScreen";

function useGameLandscapeLifecycle(): void {
  React.useEffect(() => {
    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    );

    return () => {
      void ScreenOrientation.unlockAsync();
    };
  }, []);
}

export default function GameRoute(): React.ReactElement {
  useGameLandscapeLifecycle();

  return <GameScreen />;
}
