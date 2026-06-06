import * as ScreenOrientation from "expo-screen-orientation";
import React from "react";

import GameScreen from "../view/GameScreen";

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

export class GameRouter {
  getView(): React.ReactElement {
    return <GameScreen />;
  }
}

export default function GameRoute(): React.ReactElement {
  useGameLandscapeLifecycle();

  return new GameRouter().getView();
}
