import type { ReactNode } from "react";

import HomeScreen from "../src/home/homeScreen";
import { BloomPreview } from "../src/home/preview";
import { getUiPreviewScreen } from "../src/lib/config";

const previewScreen = getUiPreviewScreen();

export default function IndexRoute(): ReactNode {
  if (__DEV__ && previewScreen !== null) {
    return <BloomPreview screen={previewScreen} />;
  }

  return <HomeScreen />;
}
