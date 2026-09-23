import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { useMurmurTheme } from "../src/home/theme";
import { UiLocaleProvider } from "../src/i18n/provider";
import { MurmurBillingProvider } from "../src/lib/billing/context";
import { initializeSentry } from "../src/lib/observability/sentry";
import { ReplayProvider } from "../src/lib/replayProvider";
import { ScreenServicesProvider } from "../src/screens/screenServices";
import { SettingsControlsProvider } from "../src/screens/settings/settingsControls";

initializeSentry();

function RootLayout(): ReactNode {
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
    <ReplayProvider>
    <MurmurBillingProvider>
      <ScreenServicesProvider>
        <SettingsControlsProvider>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: colors.background },
              headerShown: false,
            }}
          />
        </SettingsControlsProvider>
      </ScreenServicesProvider>
    </MurmurBillingProvider>
    </ReplayProvider>
  );
}

export default Sentry.wrap(RootLayout);
