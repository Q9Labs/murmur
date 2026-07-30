import type { ReactNode } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import type { VariantShellProps } from "./types";

export function SettingsChrome({
  buttonTextStyle,
  containerStyle,
  onOpenSettings,
  pressedStyle,
  rightSlot,
}: {
  buttonTextStyle: StyleProp<TextStyle>;
  containerStyle: StyleProp<ViewStyle>;
  onOpenSettings: () => void;
  pressedStyle: StyleProp<ViewStyle>;
  rightSlot: ReactNode;
}): ReactNode {
  return (
    <View style={containerStyle}>
      <Pressable
        accessibilityLabel="Open settings"
        accessibilityRole="button"
        onPress={onOpenSettings}
        style={({ pressed }) => [pressed && pressedStyle]}
      >
        <Text style={buttonTextStyle}>···</Text>
      </Pressable>
      {rightSlot}
    </View>
  );
}

export function TextLanguageRow({
  containerStyle,
  onOpenPicker,
  onSwapLanguages,
  pressedStyle,
  swapGlyph,
  swapStyle,
  textStyle,
  viewModel,
}: Pick<VariantShellProps, "onOpenPicker" | "onSwapLanguages" | "viewModel"> & {
  containerStyle: StyleProp<ViewStyle>;
  pressedStyle: StyleProp<ViewStyle>;
  swapGlyph: string;
  swapStyle: StyleProp<TextStyle>;
  textStyle: StyleProp<TextStyle>;
}): ReactNode {
  return (
    <View style={containerStyle}>
      <Pressable
        accessibilityLabel="Change spoken language"
        accessibilityRole="button"
        disabled={!viewModel.canChangeLanguages}
        onPress={() => onOpenPicker("source")}
        style={({ pressed }) => [pressed && pressedStyle]}
      >
        <Text numberOfLines={1} style={textStyle}>{viewModel.sourceLanguageDisplayName}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Reverse translation languages"
        accessibilityRole="button"
        disabled={!viewModel.canSwapLanguages}
        onPress={onSwapLanguages}
        style={({ pressed }) => [(pressed || !viewModel.canSwapLanguages) && pressedStyle]}
      >
        <Text style={swapStyle}>{swapGlyph}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Change translation language"
        accessibilityRole="button"
        disabled={!viewModel.canChangeLanguages}
        onPress={() => onOpenPicker("target")}
        style={({ pressed }) => [pressed && pressedStyle]}
      >
        <Text numberOfLines={1} style={textStyle}>{viewModel.targetLanguage.display_name}</Text>
      </Pressable>
    </View>
  );
}

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
  const disabled = !isLive && !canStart;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPrimaryAction}
      style={({ pressed }) => [style, (pressed || disabled) && pressedStyle]}
    >
      <Text style={textStyle}>{isLive ? stopLabel : startLabel}</Text>
    </Pressable>
  );
}
