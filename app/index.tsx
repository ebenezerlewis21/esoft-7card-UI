import { Redirect } from "expo-router";
import React from "react";
import { Feature } from "../constants/feature";

export default function Index(): React.ReactElement {
  if (Feature.lobbyScreen.enabled()) {
    return <Redirect href="/lobby" />;
  }

  return <Redirect href="/game" />;
}
