import { ChevronRight } from "lucide-react-native";
import { Children, type ReactNode } from "react";
import { Pressable, Switch, Text, View } from "react-native";

import { uiMirrorStyle, useUiLocale } from "../i18n/runtime";

import { useScreenStyles } from "./styles";

export function RowGroup({ children }: { children: ReactNode }): ReactNode {
  const { styles } = useScreenStyles();
  const rows = Children.toArray(children);
  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <View key={index} style={index > 0 ? styles.rowDivider : undefined}>{row}</View>
      ))}
    </View>
  );
}

export function LinkRow(props: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: "danger";
  value?: string;
}): ReactNode {
  const { colors, styles } = useScreenStyles();
  const { direction } = useUiLocale();
  const accessibilityLabel = props.value ? `${props.label}, ${props.value}` : props.label;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled === true }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, props.disabled && styles.rowDisabled, pressed && styles.pressed]}
    >
      <Text style={[styles.rowLabel, props.tone === "danger" && styles.danger]}>{props.label}</Text>
      {props.value ? <Text style={styles.rowValue}>{props.value}</Text> : null}
      {props.tone === "danger" ? null : (
        <View style={uiMirrorStyle(direction)}>
          <ChevronRight color={colors.muted} size={20} strokeWidth={2} />
        </View>
      )}
    </Pressable>
  );
}

export function SwitchRow(props: {
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}): ReactNode {
  const { colors, styles } = useScreenStyles();
  return (
    <View style={[styles.row, props.disabled && styles.rowDisabled]}>
      <Text style={styles.rowLabel}>{props.label}</Text>
      <Switch
        accessibilityLabel={props.label}
        accessibilityRole="switch"
        disabled={props.disabled}
        onValueChange={props.onChange}
        thumbColor={colors.surface}
        trackColor={{ false: colors.muted, true: colors.teal }}
        value={props.value}
      />
    </View>
  );
}
