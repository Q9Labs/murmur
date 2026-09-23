import type { ReactNode } from "react";

import HomeScreen from "../src/home/homeScreen";
import { BloomPreview } from "../src/home/preview";
import { getMurmurEnvironment, getUiPreviewLocale, getUiPreviewScreen } from "../src/lib/config";

const previewScreen = __DEV__ || getMurmurEnvironment() === "preview"
  ? getUiPreviewScreen()
  : null;

export default function IndexRoute(): ReactNode {
  if (previewScreen !== null) {
    return <BloomPreview locale={getUiPreviewLocale()} screen={previewScreen} />;
  }

  return <HomeScreen />;
}
