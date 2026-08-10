import type { ReactNode } from "react";
import { ScrollView, StatusBar, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OnboardingFlow, type OnboardingTheme, type OnboardingText } from "../onboardingFlow";
import type { VariantOnboardingProps } from "../types";
import { BrandMark, BreathingBlob } from "./index";
import { styles } from "./styles";

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
  title: styles.title,
};

const bloomText: OnboardingText = {
  agreeLabel: "Agree and Continue",
  continueLabel: "Continue",
  languagesEyebrowText: "First setup",
  languagesTitle: "Which way are we translating?",
  listenLabel: "Listen",
  privacyEyebrowText: "Before you listen",
  privacyTitle: "AI processing notice",
  sourceLabel: "I will speak",
  targetLabel: "Translate into",
  welcomeCopy: "Choose a direction, listen, and read clear captions in real time.",
  welcomeTitle: "Talk with anyone, in any language.",
};

export function BloomOnboarding(props: VariantOnboardingProps): ReactNode {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
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
  const stepIndex = step === "welcome" ? 0 : step === "privacy" ? 1 : 2;

  return (
    <View
      accessible
      accessibilityLabel={`Setup step ${stepIndex + 1} of 3`}
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
