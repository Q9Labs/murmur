import { Volume2, VolumeX } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useUiLocale } from "../../../i18n/runtime";
import { useBloomStyles } from "./styles";

export function TranslatedAudioControl({
  disabled = false,
  enabled,
  onChange,
}: {
  disabled?: boolean;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}): ReactNode {
  const { styles } = useBloomStyles();
  const { t } = useUiLocale();
  return (
    <Pressable
      accessibilityLabel={
        disabled
          ? t("audio.offDuringPhoneAudio")
          : enabled
            ? t("audio.turnTranslatedOff")
            : t("audio.turnTranslatedOn")
      }
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      onPress={() => onChange(!enabled)}
      style={({ pressed }) => [
        styles.chromeButton,
        enabled && styles.chromeButtonActive,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <SpeakerIcon enabled={enabled} />
    </Pressable>
  );
}

function SpeakerIcon({ enabled }: { enabled: boolean }): ReactNode {
  const { colors } = useBloomStyles();
  const Icon = enabled ? Volume2 : VolumeX;
  return (
    <View accessibilityElementsHidden>
      <Icon color={colors.primary} size={20} strokeWidth={2} />
    </View>
  );
}
