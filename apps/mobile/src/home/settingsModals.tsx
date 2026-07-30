import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { ModalSheet } from "./modalSheet";
import { styles } from "./styles";
import { uiVariantOptions, type UiVariant } from "./variants/types";

export function SettingsModal(props: {
  live: LiveTranslationController;
  onClose: () => void;
  onDeleteLocalData: () => void;
  onOpenDiagnostics: () => void;
  onResetIdentity: () => void;
  onSelectUiVariant: (variant: UiVariant) => void;
  open: boolean;
  settingsMessage: string | null;
  uiVariant: UiVariant;
}): ReactNode {
  const disabled = props.live.status === "live";
  return (
    <ModalSheet onClose={props.onClose} open={props.open} scroll title="Settings">
      <View accessibilityLabel="App style" accessibilityRole="radiogroup">
        <Text style={styles.setupLabel}>App style</Text>
        {uiVariantOptions.map((option) => {
          const active = props.uiVariant === option.id;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              key={option.id}
              onPress={() => props.onSelectUiVariant(option.id)}
              style={({ pressed }) => [
                styles.settingsAction,
                active && styles.languageOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              <View>
                <Text style={styles.settingsActionText}>{option.label}</Text>
                <Text style={styles.modelRouteDetail}>{option.detail}</Text>
              </View>
              <Text style={styles.languageOptionCheck}>{active ? "Selected" : ""}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.settingsList}>
        <SettingsAction label="Session diagnostics" onPress={props.onOpenDiagnostics} />
        <SettingsAction disabled={disabled} label="Reset accountless identity" onPress={props.onResetIdentity} />
        <SettingsAction disabled={disabled} label="Delete local data" onPress={props.onDeleteLocalData} />
      </View>
      {props.settingsMessage ? <Text style={styles.settingsMessage}>{props.settingsMessage}</Text> : null}
    </ModalSheet>
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
