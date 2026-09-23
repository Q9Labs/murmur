import { useEffect, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus, Text, View } from "react-native";

import { useBloomStyles } from "./styles";

export function isAppInBackground(state: AppStateStatus): boolean {
  return state !== "active";
}

export function useAppInBackground(): boolean {
  const [background, setBackground] = useState(() => isAppInBackground(AppState.currentState));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setBackground(isAppInBackground(state)));
    return () => subscription.remove();
  }, []);
  return background;
}

// Shown while a live session keeps running with the app in the background or the screen
// locked, so the app switcher and the moment of return both say what is happening.
export function BackgroundListeningPill(): ReactNode {
  const { styles } = useBloomStyles();
  return (
    <View
      accessibilityLabel="Listening in background"
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      accessible
      style={styles.backgroundPill}
    >
      <View style={styles.backgroundDot} />
      <Text style={styles.backgroundText}>Listening in background</Text>
    </View>
  );
}
