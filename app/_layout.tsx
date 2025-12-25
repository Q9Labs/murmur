import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { type ReactNode, useEffect, useState } from "react";
import "react-native-reanimated";
import "../global.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { onboardingStorage } from "@/lib/onboarding";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

function RootLayoutContent(): ReactNode {
  const router = useRouter();
  const [isReady, setIsReady] = useState<boolean>(false);
  const [shouldShowOnboarding, setShouldShowOnboarding] =
    useState<boolean>(false);

  useEffect(() => {
    const checkOnboarding = async (): Promise<void> => {
      try {
        const completed = await onboardingStorage.isCompleted();
        setShouldShowOnboarding(!completed);
      } catch (error) {
        console.error("[RootLayout] Error checking onboarding status:", error);
        // If there's an error checking storage, show onboarding to be safe
        setShouldShowOnboarding(true);
      } finally {
        try {
          setIsReady(true);
          await SplashScreen.hideAsync();
        } catch (error) {
          console.error("[RootLayout] Error hiding splash screen:", error);
          setIsReady(true);
        }
      }
    };

    checkOnboarding();
  }, []);

  useEffect(() => {
    if (isReady && router) {
      try {
        if (shouldShowOnboarding) {
          router.replace("/onboarding");
        } else {
          router.replace("/language-selection");
        }
      } catch (error) {
        console.error("[RootLayout] Navigation error:", error);
      }
    }
  }, [isReady, shouldShowOnboarding, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="index" />
      <Stack.Screen name="language-selection" />
      <Stack.Screen name="translate" />
    </Stack>
  );
}

export default function RootLayout(): ReactNode {
  return (
    <ErrorBoundary
      allowNavigateHome={true}
      onError={(error, errorInfo) => {
        const timestamp = new Date().toISOString();
        console.error("[RootLayout] ErrorBoundary caught error at", timestamp);
        console.error("[RootLayout] Error details:", {
          name: error.name,
          message: error.message,
        });
        if (errorInfo.componentStack) {
          console.error(
            "[RootLayout] Component stack:",
            errorInfo.componentStack,
          );
        }
      }}
    >
      <RootLayoutContent />
    </ErrorBoundary>
  );
}
