import type { ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import type { TranslationMode } from "../../lib/transport/types";
import { styles } from "./styles";
import type { PickerMode } from "./types";

export function LanguageStrip({
  canChangeLanguages,
  canSwapLanguages,
  onOpenPicker,
  onSwapLanguages,
  sourceLanguageDisplayName,
  targetLanguageDisplayName,
}: {
  canChangeLanguages: boolean;
  canSwapLanguages: boolean;
  onOpenPicker: (mode: PickerMode) => void;
  onSwapLanguages: () => void;
  sourceLanguageDisplayName: string;
  targetLanguageDisplayName: string;
}): ReactNode {
  return (
    <View style={styles.languageStrip}>
      <View style={styles.languagePill}>
        <Pressable
          accessibilityRole="button"
          disabled={!canChangeLanguages}
          onPress={() => onOpenPicker("source")}
          style={({ pressed }) => [styles.languagePillSide, pressed && styles.pressed]}
        >
          <Text style={styles.languagePillText} numberOfLines={1}>
            {sourceLanguageDisplayName}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Reverse translation languages"
          accessibilityRole="button"
          disabled={!canSwapLanguages}
          onPress={onSwapLanguages}
          style={({ pressed }) => getLanguageSwapButtonStyle(pressed, canSwapLanguages)}
        >
          <Text style={styles.languageSwapText}>{"<->"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!canChangeLanguages}
          onPress={() => onOpenPicker("target")}
          style={({ pressed }) => [styles.languagePillSide, pressed && styles.pressed]}
        >
          <Text style={styles.languagePillText} numberOfLines={1}>
            {targetLanguageDisplayName}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ModeToggle({
  canChangeLanguages,
  onToggleTranslationMode,
  translationMode,
}: {
  canChangeLanguages: boolean;
  onToggleTranslationMode: (mode: TranslationMode) => void;
  translationMode: TranslationMode;
}): ReactNode {
  return (
    <View
      accessibilityLabel={`Translation mode ${translationMode === "continuous" ? "Continuous" : "Phrase"}`}
      accessibilityRole="tablist"
      style={styles.modeToggle}
    >
      {(["phrase", "continuous"] as const).map((mode) => {
        const active = translationMode === mode;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: !canChangeLanguages }}
            disabled={!canChangeLanguages}
            key={mode}
            onPress={() => onToggleTranslationMode(mode)}
            style={({ pressed }) => getModeButtonStyle({
              active,
              canChangeLanguages,
              pressed,
            })}
          >
            <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>
              {mode === "continuous" ? "Continuous" : "Phrase"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getLanguageSwapButtonStyle(pressed: boolean, canSwapLanguages: boolean): ViewStyle[] {
  const result: ViewStyle[] = [styles.languageSwapButton];
  if (pressed || !canSwapLanguages) {
    result.push(styles.pressed);
  }
  return result;
}

function getModeButtonStyle(params: {
  active: boolean;
  canChangeLanguages: boolean;
  pressed: boolean;
}): ViewStyle[] {
  const result: ViewStyle[] = [styles.modeButton];
  if (params.active) {
    result.push(styles.modeButtonActive);
  }
  if (params.pressed || !params.canChangeLanguages) {
    result.push(styles.pressed);
  }
  return result;
}
