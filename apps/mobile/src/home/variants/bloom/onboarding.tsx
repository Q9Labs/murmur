import type { ReactNode } from "react";
import { ScrollView, StatusBar, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatUiNumber, uiContentDirectionStyle, useUiLocale } from "../../../i18n/runtime";
import { OnboardingFlow, type OnboardingTheme, type OnboardingText } from "../onboardingFlow";
import type { VariantOnboardingProps } from "../types";
import { BrandMark, BreathingBlob } from "./index";
import { useBloomStyles } from "./styles";

export function BloomOnboarding(props: VariantOnboardingProps): ReactNode {
  const { colors, styles } = useBloomStyles();
  const { locale, t } = useUiLocale();
  // Short screens get a compact tier so the example card and primary CTA fit
  // the first paint; the approved larger-screen metrics stay untouched and the
  // ScrollView still handles 200% text.
  const compact = useWindowDimensions().height < 640;
  const bloomText: OnboardingText = {
    agreeLabel: t("onboarding.agreeAndContinue"),
    alreadySubscribed: t("onboarding.alreadySubscribed"),
    continueLabel: t("onboarding.continue"),
    exampleCard: {
      label: t("onboarding.exampleLabel"),
      source: t("onboarding.exampleSource"),
      sourceLanguage: t("onboarding.exampleSourceLanguage"),
      target: t("onboarding.exampleTarget"),
      targetLanguage: t("onboarding.exampleTargetLanguage"),
    },
    getStarted: t("onboarding.getStarted"),
    languagesTitle: t("onboarding.languagesTitle"),
    listenLabel: t("onboarding.listen"),
    privacyTitle: t("onboarding.privacyTitle"),
    sourceLabel: t("onboarding.sourceLabel"),
    targetLabel: t("onboarding.targetLabel"),
    welcomeAccent: t("onboarding.welcomeAccent"),
    welcomeCopy: t("onboarding.welcomeCopy"),
    welcomeTitle: t("onboarding.welcomeTitle"),
  };
  const bloomTheme: OnboardingTheme = {
    body: compact ? styles.compactOnboardingBody : styles.onboardingBody,
    buttonStyle: styles.listenPill,
    buttonTextStyle: styles.listenPillText,
    checkbox: styles.checkbox,
    checkboxChecked: styles.checkboxChecked,
    checkboxMark: styles.checkboxMark,
    consentRow: styles.consentRow,
    copy: compact ? styles.compactCopy : styles.copy,
    error: styles.error,
    exampleBadge: styles.exampleBadge,
    exampleBadgeDot: styles.exampleBadgeDot,
    exampleCard: compact ? styles.compactExampleCard : styles.exampleCard,
    exampleLabel: styles.exampleLabel,
    exampleMeta: compact ? styles.compactExampleMeta : styles.exampleMeta,
    exampleRule: styles.exampleRule,
    exampleSentence: compact ? styles.compactExampleSentence : styles.exampleSentence,
    footer: compact ? styles.compactOnboardingFooter : styles.onboardingFooter,
    hero: compact ? styles.compactOnboardingHero : styles.onboardingHero,
    iconColor: colors.primary,
    link: styles.onboardingLink,
    point: styles.privacyPoint,
    pointIcon: styles.privacyPointIcon,
    pointText: styles.privacyPointText,
    pressed: styles.pressed,
    setupLabel: styles.setupLabel,
    setupRow: styles.setupRow,
    setupValue: styles.setupValue,
    signInLink: compact ? styles.compactSignInLink : styles.signInLink,
    title: compact ? styles.compactTitle : styles.title,
    welcomeAccent: styles.welcomeAccent,
    welcomeBody: compact ? styles.compactWelcomeBody : styles.welcomeBody,
  };

  return (
    <SafeAreaView style={[styles.screen, uiContentDirectionStyle(locale)]}>
      <StatusBar barStyle={colors.dark ? "light-content" : "dark-content"} />
      <View style={styles.chrome}>
        <BrandMark />
      </View>
      <OnboardingProgress step={props.step} />
      <ScrollView alwaysBounceVertical={false} contentContainerStyle={onboardingScroll}>
        <OnboardingFlow
          {...props}
          artwork={<BreathingBlob isLive={false} />}
          text={bloomText}
          theme={bloomTheme}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const onboardingScroll = { flexGrow: 1 } as const;

function OnboardingProgress({ step }: { step: VariantOnboardingProps["step"] }): ReactNode {
  const { styles } = useBloomStyles();
  const { locale, t } = useUiLocale();
  const stepIndex = step === "welcome" ? 0 : step === "privacy" ? 1 : 2;

  return (
    <View
      accessible
      accessibilityLabel={t("accessibility.setupStep", {
        current: formatUiNumber(stepIndex + 1, locale),
        total: formatUiNumber(3, locale),
      })}
      accessibilityRole="text"
      style={styles.progressRow}
    >
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={[styles.progressDot, index === stepIndex && styles.progressDotActive]}
        />
      ))}
    </View>
  );
}
