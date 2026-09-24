import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Image, type ImageSourcePropType, Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { uiContentDirectionStyle, uiMirrorStyle, useUiLocale } from "../i18n/runtime";
import { useScreenStyles } from "./styles";

// With artwork, the screen becomes a hero: illustration, title and lead replace the header
// title, and the whole block sits a little above centre between the header and the footer,
// for moments that ask the user something rather than list settings. It scrolls when it
// doesn't fit.
export function ScreenScaffold(props: {
  artwork?: ImageSourcePropType;
  children?: ReactNode;
  footer?: ReactNode;
  lead?: string;
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
        {props.artwork ? null : <Text accessibilityRole="header" style={styles.title}>{props.title}</Text>}
      </View>
      <ScrollView
        contentContainerStyle={props.artwork ? styles.heroContent : styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {props.artwork ? (
          <View style={styles.heroBody}>
            <View style={styles.hero}>
              <Image
                accessibilityIgnoresInvertColors
                accessible={false}
                resizeMode="contain"
                source={props.artwork}
                style={styles.heroArtwork}
              />
              <Text accessibilityRole="header" style={styles.heroTitle}>{props.title}</Text>
              {props.lead ? <Text style={styles.heroLead}>{props.lead}</Text> : null}
            </View>
            {props.children}
          </View>
        ) : props.children}
      </ScrollView>
      {props.footer ? (
        // The footer scrolls on its own when many actions or large text can't fit.
        <ScrollView
          bounces={false}
          contentContainerStyle={props.artwork ? styles.heroFooter : styles.footer}
          style={styles.footerScroll}
        >
          {props.footer}
        </ScrollView>
      ) : null}
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

// A low-emphasis text action, such as skipping an optional step or declining an offer.
// It keeps the full tap target of the other actions so declining is never harder than accepting.
export function QuietAction(props: ActionProps): ReactNode {
  const { styles } = useScreenStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled === true }}
      disabled={props.disabled}
      hitSlop={10}
      onPress={props.onPress}
      style={({ pressed }) => [styles.quietButton, (pressed || props.disabled) && styles.pressed]}
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
