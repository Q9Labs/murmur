import type { ReactNode } from "react";
import { Image, Pressable, Text, View, type ViewStyle } from "react-native";

import type { AudioStateEvent } from "../../modules/murmur-audio";
import { styles } from "./styles";

const brandLogo = require("../../assets/images/icon.png");

export function AppChrome({
  audioState,
  healthText,
  onOpenSettings,
  status,
}: {
  audioState: AudioStateEvent | null;
  healthText: string;
  onOpenSettings: () => void;
  status: string;
}): ReactNode {
  const playbackActive = Boolean(audioState?.playback_active);

  return (
    <View style={styles.appChrome}>
      <Pressable
        accessibilityLabel="Open settings"
        accessibilityRole="button"
        onPress={onOpenSettings}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Text style={styles.iconButtonText}>...</Text>
      </Pressable>
      <View
        accessible
        accessibilityLabel={`Murmur health ${healthText}`}
        accessibilityRole="text"
        style={styles.brandMini}
      >
        <View style={getStatusDotStyle(status)} />
        <Image accessibilityIgnoresInvertColors source={brandLogo} style={styles.brandMiniLogo} />
        <Text style={styles.brandMiniText}>Murmur</Text>
        <Text style={styles.healthText}>{healthText}</Text>
      </View>
      <View
        accessible
        accessibilityLabel={`Speech playback ${playbackActive ? "on" : "off"}`}
        accessibilityRole="text"
        style={[styles.iconButton, styles.speechIndicator]}
      >
        <Text style={styles.iconButtonText}>{playbackActive ? "On" : "Audio"}</Text>
      </View>
    </View>
  );
}

const statusDotToneStyles: Record<string, ViewStyle> = {
  live: styles.statusDotLive,
  network_degraded: styles.statusDotDegraded,
  recovering: styles.statusDotRecovering,
  transport_disconnected: styles.statusDotDisconnected,
};

function getStatusDotStyle(status: string): ViewStyle | ViewStyle[] {
  const toneStyle = statusDotToneStyles[status];
  return toneStyle ? [styles.statusDot, toneStyle] : styles.statusDot;
}
