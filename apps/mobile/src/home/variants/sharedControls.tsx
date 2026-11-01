import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { uiTextDirectionStyle, useUiLocale } from "../../i18n/runtime";
import type { VariantShellProps } from "./types";

export function TextLanguageRow({
  containerStyle,
  labelStyle,
  onOpenPicker,
  onSwapLanguages,
  pressedStyle,
  swapGlyph,
  swapStyle,
  textStyle,
  viewModel,
}: Pick<VariantShellProps, "onOpenPicker" | "onSwapLanguages" | "viewModel"> & {
  containerStyle: StyleProp<ViewStyle>;
  labelStyle: StyleProp<ViewStyle>;
  pressedStyle: StyleProp<ViewStyle>;
  swapGlyph: string;
  swapStyle: StyleProp<TextStyle>;
  textStyle: StyleProp<TextStyle>;
}): ReactNode {
  const { direction, t } = useUiLocale();
  return (
    <View style={containerStyle}>
      <Pressable
        accessibilityLabel={t("accessibility.changeSpokenLanguage")}
        accessibilityRole="button"
        disabled={!viewModel.canChangeLanguages}
        hitSlop={8}
        onPress={() => onOpenPicker("source")}
        style={({ pressed }) => [labelStyle, pressed && pressedStyle]}
      >
        <Text numberOfLines={2} style={[textStyle, uiTextDirectionStyle(direction)]}>
          {viewModel.sourceLanguageDisplayName}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel={t("accessibility.reverseTranslationLanguages")}
        accessibilityRole="button"
        disabled={!viewModel.canSwapLanguages}
        hitSlop={10}
        onPress={onSwapLanguages}
        style={({ pressed }) => [
          styles.swapButton,
          (pressed || !viewModel.canSwapLanguages) && pressedStyle,
        ]}
      >
        <Text style={swapStyle}>{swapGlyph}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={t("accessibility.changeTranslationLanguage")}
        accessibilityRole="button"
        disabled={!viewModel.canChangeLanguages}
        hitSlop={8}
        onPress={() => onOpenPicker("target")}
        style={({ pressed }) => [labelStyle, pressed && pressedStyle]}
      >
        <Text numberOfLines={2} style={[textStyle, uiTextDirectionStyle(direction)]}>
          {viewModel.targetLanguageDisplayName}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  swapButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
});

export function PrimaryAction({
  canStart,
  isLive,
  onPrimaryAction,
  pressedStyle,
  startLabel,
  stopLabel,
  style,
  textStyle,
}: {
  canStart: boolean;
  isLive: boolean;
  onPrimaryAction: () => void;
  pressedStyle: StyleProp<ViewStyle>;
  startLabel: string;
  stopLabel: string;
  style: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
}): ReactNode {
  const { direction } = useUiLocale();
  const disabled = !isLive && !canStart;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPrimaryAction}
      style={({ pressed }) => [style, (pressed || disabled) && pressedStyle]}
    >
      <Text style={[textStyle, uiTextDirectionStyle(direction)]}>{isLive ? stopLabel : startLabel}</Text>
    </Pressable>
  );
}
