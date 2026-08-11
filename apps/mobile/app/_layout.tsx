import { Stack } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { useMurmurTheme } from "../src/home/theme";
import { UiLocaleProvider } from "../src/i18n/provider";

export default function RootLayout(): ReactNode {
  return (
    <UiLocaleProvider>
      <ThemedStack />
    </UiLocaleProvider>
  );
}

function ThemedStack(): ReactNode {
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
