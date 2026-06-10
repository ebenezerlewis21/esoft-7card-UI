import { Redirect } from "expo-router";
import React from "react";

export default function Index(): React.ReactElement {
  return <Redirect href="/login" />;
}
