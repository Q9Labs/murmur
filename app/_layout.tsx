import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import '../global.css';
import { onboardingStorage } from '@/lib/onboarding';

export {
  ErrorBoundary,
} from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await onboardingStorage.isCompleted();
        setShouldShowOnboarding(!completed);
      } catch {
        // If there's an error checking storage, show onboarding to be safe
        setShouldShowOnboarding(true);
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    };

    checkOnboarding();
  }, []);

  useEffect(() => {
    if (isReady) {
      if (shouldShowOnboarding) {
        router.replace('/onboarding');
      } else {
        router.replace('/language-selection');
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
