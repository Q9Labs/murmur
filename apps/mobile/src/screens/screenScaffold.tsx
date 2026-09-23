import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useScreenStyles } from "./styles";

export function ScreenScaffold(props: {
  children: ReactNode;
  footer?: ReactNode;
  title: string;
}): ReactNode {
  const router = useRouter();
  const { colors, styles } = useScreenStyles();
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <StatusBar barStyle={colors.dark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <ChevronLeft color={colors.primary} size={22} strokeWidth={2.25} />
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

export function PrimaryAction(props: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}): ReactNode {
  const { styles } = useScreenStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled === true }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [styles.primaryButton, (pressed || props.disabled) && styles.pressed]}
    >
      <Text style={styles.primaryButtonText}>{props.label}</Text>
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
