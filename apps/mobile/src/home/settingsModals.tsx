import type { ReactNode } from "react";
import { Pressable, Switch, Text, View } from "react-native";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { ModalSheet } from "./modalSheet";
import { styles } from "./styles";

export function SettingsModal(props: {
  audioPlaybackEnabled: boolean;
  developerToolsEnabled: boolean;
  live: LiveTranslationController;
  onClose: () => void;
  onAudioPlaybackEnabledChange: (enabled: boolean) => void;
  onDeleteLocalData: () => void;
  onOpenDiagnostics: () => void;
  onResetIdentity: () => void;
  onShare: () => void;
  open: boolean;
  settingsMessage: string | null;
}): ReactNode {
  const disabled = props.live.status === "live";
  return (
    <ModalSheet onClose={props.onClose} open={props.open} scroll title="Settings">
      <View style={styles.settingsList}>
        <SettingsToggle
          enabled={props.audioPlaybackEnabled}
          label="Play translated audio"
          onChange={props.onAudioPlaybackEnabledChange}
        />
        <SettingsAction disabled={disabled} label="Share Murmur" onPress={props.onShare} />
        <SettingsAction disabled={disabled} label="Delete local data" onPress={props.onDeleteLocalData} />
        {props.developerToolsEnabled ? (
          <>
            <SettingsAction label="Session diagnostics" onPress={props.onOpenDiagnostics} />
            <SettingsAction
              disabled={disabled}
              label="Reset accountless identity"
              onPress={props.onResetIdentity}
            />
          </>
        ) : null}
      </View>
      {props.settingsMessage ? <Text style={styles.settingsMessage}>{props.settingsMessage}</Text> : null}
    </ModalSheet>
  );
}

function SettingsToggle(props: {
  enabled: boolean;
  label: string;
  onChange: (enabled: boolean) => void;
}): ReactNode {
  return (
    <View style={styles.settingsAction}>
      <Text style={styles.settingsActionText}>{props.label}</Text>
      <Switch
        accessibilityLabel={props.label}
        accessibilityRole="switch"
        accessibilityState={{ checked: props.enabled }}
        onValueChange={props.onChange}
        thumbColor="#FFFDF9"
        trackColor={{ false: "#C9C1CC", true: "#2FB9A5" }}
        value={props.enabled}
      />
    </View>
  );
}

function SettingsAction(props: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.settingsAction,
        (pressed || props.disabled) && styles.pressed,
      ]}
    >
      <Text style={styles.settingsActionText}>{props.label}</Text>
      <Text style={styles.settingsChevron}>{">"}</Text>
    </Pressable>
  );
}
