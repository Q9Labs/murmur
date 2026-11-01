import type { ReactNode } from "react";
import { ScrollView, StatusBar, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatUiNumber, uiContentDirectionStyle, useUiLocale } from "../../../i18n/runtime";
import { OnboardingFlow, type OnboardingTheme, type OnboardingText } from "../onboardingFlow";
import type { VariantOnboardingProps } from "../types";
import { BrandMark, BreathingBlob } from "./index";
import { useBloomStyles } from "./styles";

export function BloomOnboarding(props: VariantOnboardingProps): ReactNode {
  const { colors, styles } = useBloomStyles();
  const { locale, t } = useUiLocale();
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
    body: styles.onboardingBody,
    buttonStyle: styles.listenPill,
    buttonTextStyle: styles.listenPillText,
    checkbox: styles.checkbox,
    checkboxChecked: styles.checkboxChecked,
    checkboxMark: styles.checkboxMark,
    consentRow: styles.consentRow,
    copy: styles.copy,
    exampleBadge: styles.exampleBadge,
    exampleBadgeDot: styles.exampleBadgeDot,
    exampleCard: styles.exampleCard,
    exampleLabel: styles.exampleLabel,
    exampleMeta: styles.exampleMeta,
    exampleRule: styles.exampleRule,
    exampleSentence: styles.exampleSentence,
    footer: styles.onboardingFooter,
    hero: styles.onboardingHero,
    iconColor: colors.primary,
    link: styles.onboardingLink,
    point: styles.privacyPoint,
    pointIcon: styles.privacyPointIcon,
    pointText: styles.privacyPointText,
    pressed: styles.pressed,
    setupLabel: styles.setupLabel,
    setupRow: styles.setupRow,
    setupValue: styles.setupValue,
    signInLink: styles.signInLink,
    title: styles.title,
    welcomeAccent: styles.welcomeAccent,
    welcomeBody: styles.welcomeBody,
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
