import { Mic, Smartphone } from "lucide-react-native";
import type { ComponentType, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import type { AudioCaptureSource } from "../../../../modules/murmur-audio";
import { useUiLocale } from "../../../i18n/runtime";
import { useBloomStyles } from "./styles";

export function CaptureSourceControl({
  devicePlaybackSupported,
  disabled,
  onChange,
  source,
}: {
  devicePlaybackSupported: boolean;
  disabled: boolean;
  onChange: (source: AudioCaptureSource) => void;
  source: AudioCaptureSource;
}): ReactNode {
  const { styles } = useBloomStyles();
  const { t } = useUiLocale();
  if (!devicePlaybackSupported) {
    return null;
  }

  return (
    <View style={styles.captureSourceWrap}>
      <View accessibilityRole="radiogroup" style={styles.captureSourceGroup}>
        <SourceOption
          active={source === "microphone"}
          disabled={disabled}
          icon={Mic}
          label={t("capture.microphone")}
          onPress={() => onChange("microphone")}
        />
        <SourceOption
          active={source === "device_playback"}
          disabled={disabled}
          icon={Smartphone}
          label={t("capture.phoneAudio")}
          onPress={() => onChange("device_playback")}
        />
      </View>
      {source === "device_playback" ? (
        <Text style={styles.captureSourceHint}>{t("home.phoneAudioHint")}</Text>
      ) : null}
    </View>
  );
}

function SourceOption({
  active,
  disabled,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  disabled: boolean;
  icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  label: string;
  onPress: () => void;
}): ReactNode {
  const { colors, styles } = useBloomStyles();
  const Icon = icon;
  return (
    <Pressable
      accessibilityLabel={`Use ${label.toLowerCase()} input`}
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.captureSourceOption,
        active && styles.captureSourceOptionActive,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <View accessibilityElementsHidden style={styles.captureSourceIcon}>
        <Icon color={active ? colors.onSelected : colors.muted} size={16} strokeWidth={2} />
      </View>
      <Text style={[styles.captureSourceText, active && styles.captureSourceTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}
