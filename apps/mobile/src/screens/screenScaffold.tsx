import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Image, type ImageSourcePropType, Pressable, ScrollView, StatusBar, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { uiContentDirectionStyle, uiMirrorStyle, useUiLocale } from "../i18n/runtime";
import { useScreenStyles, type ScreenStyles } from "./styles";

// With artwork, the screen becomes a hero: illustration, title and lead replace the header
// title, and the whole block sits a little above centre between the header and the footer,
// for moments that ask the user something rather than list settings. It scrolls when it
// doesn't fit.
export function ScreenScaffold(props: {
  artwork?: ImageSourcePropType;
  children?: ReactNode;
  footer?: ReactNode;
  lead?: string;
  serif?: boolean;
  title: string;
}): ReactNode {
  const { colors, styles } = useScreenStyles();
  const { direction } = useUiLocale();
  const serif = props.serif === true;
  // On short screens the ornamental art must not push the question below the
  // fold: reduce it and top-align the hero body so title, lead and disclosure
  // content arrive with the actions; tall screens keep the centred artwork.
  const compact = useWindowDimensions().height < 640;
  return (
    <SafeAreaView edges={["top", "bottom"]} style={[styles.screen, uiContentDirectionStyle(direction)]}>
      <StatusBar barStyle={colors.dark ? "light-content" : "dark-content"} />
      <ScaffoldHeader artwork={props.artwork} serif={serif} title={props.title} />
      <ScrollView
        contentContainerStyle={props.artwork ? (compact ? styles.compactHeroContent : styles.heroContent) : styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {props.artwork ? (
          <HeroBody artwork={props.artwork} compact={compact} lead={props.lead} styles={styles} title={props.title}>
            {props.children}
          </HeroBody>
        ) : (
          <>
            {serif ? <SerifHead lead={props.lead} styles={styles} title={props.title} /> : null}
            {props.children}
          </>
        )}
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

function HeroBody(props: {
  artwork: ImageSourcePropType;
  children?: ReactNode;
  compact: boolean;
  lead?: string;
  styles: ScreenStyles;
  title: string;
}): ReactNode {
  const { styles } = props;
  return (
    <View style={[styles.heroBody, props.compact ? styles.compactHeroBody : null]}>
      <View style={styles.hero}>
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="contain"
          source={props.artwork}
          style={[styles.heroArtwork, props.compact ? styles.compactHeroArtwork : null]}
        />
        <Text accessibilityRole="header" style={styles.heroTitle}>{props.title}</Text>
        {props.lead ? <Text style={styles.heroLead}>{props.lead}</Text> : null}
      </View>
      {props.children}
    </View>
  );
}

function ScaffoldHeader(props: { artwork?: ImageSourcePropType; serif: boolean; title: string }): ReactNode {
  const router = useRouter();
  const { colors, styles } = useScreenStyles();
  const { direction, t } = useUiLocale();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel={t("common.back")}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        style={({ pressed }) => [props.serif ? styles.backRow : styles.backButton, pressed && styles.pressed]}
      >
        <View style={uiMirrorStyle(direction)}>
          <ChevronLeft color={colors.primary} size={22} strokeWidth={2.25} />
        </View>
        {props.serif ? <Text style={styles.backText}>{t("common.back")}</Text> : null}
      </Pressable>
      {props.artwork || props.serif ? null : <Text accessibilityRole="header" style={styles.title}>{props.title}</Text>}
    </View>
  );
}

function SerifHead(props: { lead?: string; styles: ScreenStyles; title: string }): ReactNode {
  return (
    <View style={props.styles.serifHead}>
      <Text accessibilityRole="header" style={props.styles.serifTitle}>{props.title}</Text>
      {props.lead ? <Text style={props.styles.serifLead}>{props.lead}</Text> : null}
    </View>
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
