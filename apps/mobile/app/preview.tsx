import { Redirect, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";

import { BloomPreview, type PreviewScreen } from "../src/home/preview";

type PreviewParams = {
  screen?: string | string[];
};

export default function PreviewRoute(): ReactNode {
  const { screen } = useLocalSearchParams<PreviewParams>();

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <BloomPreview screen={normalizePreviewScreen(screen)} />;
}

export function normalizePreviewScreen(screen: PreviewParams["screen"]): PreviewScreen {
  const requestedScreen = Array.isArray(screen) ? screen[0] : screen;
  return requestedScreen === "languages" ||
    requestedScreen === "picker" ||
    requestedScreen === "privacy" ||
    requestedScreen === "settings" ||
    requestedScreen === "source-picker" ||
    requestedScreen === "translation" ||
    requestedScreen === "translation-muted"
    ? requestedScreen
    : "welcome";
}
