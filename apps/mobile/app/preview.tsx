import { Redirect, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";

import { BloomPreview, type PreviewScreen } from "../src/home/preview";
import { isUiLocale, type UiLocale } from "../src/i18n/types";
import { getUiPreviewLocale, getUiPreviewScreen, toUiPreviewScreen } from "../src/lib/config";

type PreviewParams = {
  locale?: string | string[];
  screen?: string | string[];
};

export default function PreviewRoute(): ReactNode {
  const { locale, screen } = useLocalSearchParams<PreviewParams>();

  if (!__DEV__ && getUiPreviewScreen() === null) {
    return <Redirect href="/" />;
  }

  return <BloomPreview locale={normalizePreviewLocale(locale)} screen={normalizePreviewScreen(screen)} />;
}

export function normalizePreviewLocale(locale: PreviewParams["locale"]): UiLocale | null {
  const requestedLocale = Array.isArray(locale) ? locale[0] : locale;
  return isUiLocale(requestedLocale) ? requestedLocale : getUiPreviewLocale();
}

export function normalizePreviewScreen(screen: PreviewParams["screen"]): PreviewScreen {
  const requestedScreen = Array.isArray(screen) ? screen[0] : screen;
  return toUiPreviewScreen(requestedScreen) ?? "welcome";
}
