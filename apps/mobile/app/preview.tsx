import { Redirect, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";

import { BloomPreview, type PreviewScreen } from "../src/home/preview";
import { getUiPreviewScreen, toUiPreviewScreen } from "../src/lib/config";

type PreviewParams = {
  screen?: string | string[];
};

export default function PreviewRoute(): ReactNode {
  const { screen } = useLocalSearchParams<PreviewParams>();

  if (!__DEV__ && getUiPreviewScreen() === null) {
    return <Redirect href="/" />;
  }

  return <BloomPreview screen={normalizePreviewScreen(screen)} />;
}

export function normalizePreviewScreen(screen: PreviewParams["screen"]): PreviewScreen {
  const requestedScreen = Array.isArray(screen) ? screen[0] : screen;
  return toUiPreviewScreen(requestedScreen) ?? "welcome";
}
