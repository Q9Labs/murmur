import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import {
  devTranslationModelRouteOptions,
  getTranslationModelRouteLabel,
  isUltravoxReplacementRoute,
} from "@murmur/protocol/translationModelRoutes";
import type { TranslationModelRoute } from "@murmur/protocol/transport/types";
import { ModalSheet } from "./modalSheet";
import { styles } from "./styles";

export function SettingsModal({
  devModelPickerEnabled,
  devModelRoute,
  live,
  onClose,
  onDeleteLocalData,
  onOpenDevModelRoute,
  onOpenDiagnostics,
  onResetIdentity,
  onToggleUltravoxVad,
  open,
  settingsMessage,
  ultravoxVadEnabled,
}: {
  devModelPickerEnabled: boolean;
  devModelRoute: TranslationModelRoute;
  live: LiveTranslationController;
  onClose: () => void;
  onDeleteLocalData: () => void;
  onOpenDevModelRoute: () => void;
  onOpenDiagnostics: () => void;
  onResetIdentity: () => void;
  onToggleUltravoxVad: () => void;
  open: boolean;
  settingsMessage: string | null;
  ultravoxVadEnabled: boolean;
}): ReactNode {
  const disabled = live.status === "live";
  const ultravoxSelected = isUltravoxReplacementRoute(devModelRoute);
  return (
    <ModalSheet onClose={onClose} open={open} title="Settings">
      <View style={styles.settingsList}>
        <SettingsAction label="Session diagnostics" onPress={onOpenDiagnostics} />
        <DevSettingsActions
          devModelPickerEnabled={devModelPickerEnabled}
          devModelRoute={devModelRoute}
          disabled={disabled}
          onOpenDevModelRoute={onOpenDevModelRoute}
          onToggleUltravoxVad={onToggleUltravoxVad}
          ultravoxSelected={ultravoxSelected}
          ultravoxVadEnabled={ultravoxVadEnabled}
        />
        <SettingsAction disabled={disabled} label="Reset accountless identity" onPress={onResetIdentity} />
        <SettingsAction disabled={disabled} label="Delete local data" onPress={onDeleteLocalData} />
      </View>
      {settingsMessage ? <Text style={styles.settingsMessage}>{settingsMessage}</Text> : null}
    </ModalSheet>
  );
}

function DevSettingsActions({
  devModelPickerEnabled,
  devModelRoute,
  disabled,
  onOpenDevModelRoute,
  onToggleUltravoxVad,
  ultravoxSelected,
  ultravoxVadEnabled,
}: {
  devModelPickerEnabled: boolean;
  devModelRoute: TranslationModelRoute;
  disabled: boolean;
  onOpenDevModelRoute: () => void;
  onToggleUltravoxVad: () => void;
  ultravoxSelected: boolean;
  ultravoxVadEnabled: boolean;
}): ReactNode {
  if (!devModelPickerEnabled) {
    return null;
  }
  return (
    <>
      <SettingsAction
        disabled={disabled}
        label={`Dev model: ${getTranslationModelRouteLabel(devModelRoute)}`}
        onPress={onOpenDevModelRoute}
      />
      <SettingsAction
        disabled={disabled || !ultravoxSelected}
        label={`Ultravox VAD: ${ultravoxVadEnabled ? "On" : "Off"}`}
        onPress={onToggleUltravoxVad}
      />
    </>
  );
}

export function DevModelRouteModal({
  onClose,
  onSelect,
  open,
  selected,
}: {
  onClose: () => void;
  onSelect: (route: TranslationModelRoute) => void;
  open: boolean;
  selected: TranslationModelRoute;
}): ReactNode {
  return (
    <ModalSheet onClose={onClose} open={open} title="Dev model">
      <View style={styles.settingsList}>
        {devTranslationModelRouteOptions.map((option) => {
          const active = selected === option.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={({ pressed }) => [
                styles.languageOption,
                active && styles.languageOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              <View>
                <Text style={styles.languageOptionName}>{option.label}</Text>
                <Text style={styles.modelRouteDetail}>{option.detail}</Text>
              </View>
              <Text style={styles.languageOptionCheck}>{active ? "Selected" : ""}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.modelRouteMeta}>{selected}</Text>
    </ModalSheet>
  );
}

function SettingsAction({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.settingsAction, (pressed || disabled) && styles.pressed]}
    >
      <Text style={styles.settingsActionText}>{label}</Text>
      <Text style={styles.settingsChevron}>{">"}</Text>
    </Pressable>
  );
}
