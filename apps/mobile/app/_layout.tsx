import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { useMurmurTheme } from "../src/home/theme";
import { initializeSentry } from "../src/lib/observability/sentry";

initializeSentry();

function RootLayout(): ReactNode {
  const colors = useMurmurTheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}
    />
  );
}

export default Sentry.wrap(RootLayout);
