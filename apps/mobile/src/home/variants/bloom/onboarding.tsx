import type { ReactNode } from "react";
import { ScrollView, StatusBar, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  formatUiNumber,
  uiContentDirectionStyle,
  uiTextDirectionStyle,
  useUiLocale,
} from "../../../i18n/runtime";
import { OnboardingFlow, type OnboardingTheme, type OnboardingText } from "../onboardingFlow";
import type { VariantOnboardingProps } from "../types";
import { BrandMark, BreathingBlob } from "./index";
import { useBloomStyles } from "./styles";

export function BloomOnboarding(props: VariantOnboardingProps): ReactNode {
  const { colors, styles } = useBloomStyles();
  const { direction, locale, t } = useUiLocale();
  const bloomText: OnboardingText = {
    agreeLabel: t("onboarding.agreeAndContinue"),
    consentLabel: t("onboarding.consent"),
    continueLabel: t("onboarding.continue"),
    languagesEyebrowText: t("onboarding.firstSetup"),
    languagesTitle: t("onboarding.languagesTitle"),
    listenLabel: t("onboarding.listen"),
    privacyDataFlow: t("onboarding.privacyDataFlow"),
    privacyDataUse: t("onboarding.privacyDataUse"),
    privacyEyebrowText: t("onboarding.beforeListen"),
    privacyNoHistory: t("onboarding.noHistory"),
    privacyTitle: t("onboarding.aiProcessingNotice"),
    sourceLabel: t("onboarding.sourceLabel"),
    targetLabel: t("onboarding.targetLabel"),
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
    eyebrow: styles.eyebrow,
    footer: styles.onboardingFooter,
    pressed: styles.pressed,
    setupRow: styles.setupRow,
    setupValue: styles.setupValue,
    textDirection: uiTextDirectionStyle(direction),
    title: styles.title,
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
