import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { uiContentDirectionStyle, uiMirrorStyle, useUiLocale } from "../i18n/runtime";
import { useScreenStyles } from "./styles";

export function ScreenScaffold(props: {
  children: ReactNode;
  footer?: ReactNode;
  title: string;
}): ReactNode {
  const router = useRouter();
  const { colors, styles } = useScreenStyles();
  const { direction, t } = useUiLocale();
  return (
    <SafeAreaView edges={["top", "bottom"]} style={[styles.screen, uiContentDirectionStyle(direction)]}>
      <StatusBar barStyle={colors.dark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t("common.back")}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <View style={uiMirrorStyle(direction)}>
            <ChevronLeft color={colors.primary} size={22} strokeWidth={2.25} />
          </View>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>{props.title}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {props.children}
      </ScrollView>
      {props.footer ? <View style={styles.footer}>{props.footer}</View> : null}
    </SafeAreaView>
  );
}

export function PrimaryAction(props: ActionProps): ReactNode {
  return <ActionButton {...props} tone="primary" />;
}

export function SecondaryAction(props: ActionProps): ReactNode {
  return <ActionButton {...props} tone="secondary" />;
}

type ActionProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

function ActionButton(props: ActionProps & { tone: "primary" | "secondary" }): ReactNode {
  const { styles } = useScreenStyles();
  const primary = props.tone === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled === true }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        primary ? styles.primaryButton : styles.secondaryButton,
        (pressed || props.disabled) && styles.pressed,
      ]}
    >
      <Text style={primary ? styles.primaryButtonText : styles.secondaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

// A low-emphasis text action, such as skipping an optional step.
export function QuietAction(props: { label: string; onPress: () => void }): ReactNode {
  const { styles } = useScreenStyles();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={10}
      onPress={props.onPress}
      style={({ pressed }) => [styles.quietButton, pressed && styles.pressed]}
    >
      <Text style={styles.quietButtonText}>{props.label}</Text>
    </Pressable>
  );
}

export function StatusLine(props: { error: string | null; notice: string | null }): ReactNode {
  const { styles } = useScreenStyles();
  return (
    <>
      {props.notice ? <Text accessibilityLiveRegion="polite" style={styles.message}>{props.notice}</Text> : null}
      {props.error ? (
        <Text accessibilityLiveRegion="assertive" style={styles.messageError}>{props.error}</Text>
      ) : null}
    </>
  );
}
