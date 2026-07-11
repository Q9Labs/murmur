import type { ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import type { TranslationMode } from "@murmur/protocol/transport/types";
import { styles } from "./styles";
import type { PickerMode } from "./types";
import { TextModeTabs } from "./variants/sharedControls";

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
    <TextModeTabs
      activeStyle={[styles.modeButtonText, styles.modeButtonTextActive]}
      activeTabStyle={styles.modeButtonActive}
      canChangeLanguages={canChangeLanguages}
      containerStyle={styles.modeToggle}
      inactiveStyle={styles.modeButtonText}
      onToggleTranslationMode={onToggleTranslationMode}
      pressedStyle={styles.pressed}
      tabStyle={styles.modeButton}
      translationMode={translationMode}
    />
  );
}

function getLanguageSwapButtonStyle(pressed: boolean, canSwapLanguages: boolean): ViewStyle[] {
  const result: ViewStyle[] = [styles.languageSwapButton];
  if (pressed || !canSwapLanguages) {
    result.push(styles.pressed);
  }
  return result;
}
