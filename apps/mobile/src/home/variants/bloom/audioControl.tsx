import { Volume2, VolumeX } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { styles } from "./styles";

export function TranslatedAudioControl({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}): ReactNode {
  return (
    <Pressable
      accessibilityLabel={enabled ? "Turn translated audio off" : "Turn translated audio on"}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={() => onChange(!enabled)}
      style={({ pressed }) => [
        styles.chromeButton,
        enabled && styles.chromeButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <SpeakerIcon enabled={enabled} />
    </Pressable>
  );
}

function SpeakerIcon({ enabled }: { enabled: boolean }): ReactNode {
  const Icon = enabled ? Volume2 : VolumeX;
  return (
    <View accessibilityElementsHidden>
      <Icon color="#3A2E3F" size={20} strokeWidth={2} />
    </View>
  );
}
