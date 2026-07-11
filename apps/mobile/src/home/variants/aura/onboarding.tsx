import type { ReactNode } from "react";
import { ScrollView, StatusBar, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OnboardingFlow, type OnboardingTheme, type OnboardingText } from "../onboardingFlow";
import type { VariantOnboardingProps } from "../types";
import { AuraBackdrop } from "./index";
import { styles } from "./styles";

const auraTheme: OnboardingTheme = {
  body: styles.onboardingBody,
  buttonStyle: styles.ghostButton,
  buttonTextStyle: styles.ghostButtonText,
  checkbox: styles.setupCheckbox,
  checkboxChecked: styles.setupCheckboxChecked,
  checkboxMark: styles.setupCheckboxMark,
  consentRow: styles.consentRow,
  copy: styles.onboardingCopy,
  eyebrow: styles.eyebrow,
  footer: styles.onboardingFooter,
  pressed: styles.pressed,
  setupRow: styles.setupRow,
  setupValue: styles.setupValue,
  title: styles.onboardingTitle,
};

const auraText: OnboardingText = {
  agreeLabel: "Agree and Continue",
  continueLabel: "Continue",
  languagesEyebrowText: "First setup",
  languagesTitle: "Translation direction",
  listenLabel: "Listen",
  privacyEyebrowText: "Before you listen",
  privacyTitle: "AI processing notice",
  sourceLabel: "I will speak",
  targetLabel: "Translate into",
  welcomeCopy: "Choose a direction, listen, and read clear captions in real time.",
  welcomeEyebrowText: "Live translation",
  welcomeTitle: "Speak. Read it in another language as it happens.",
};

export function AuraOnboarding(props: VariantOnboardingProps): ReactNode {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <AuraBackdrop live={false} />
      <View style={styles.chrome}>
        <Text style={styles.eyebrow}>Murmur</Text>
      </View>
      <ScrollView alwaysBounceVertical={false} contentContainerStyle={onboardingScroll}>
        <OnboardingFlow {...props} text={auraText} theme={auraTheme} />
      </ScrollView>
    </SafeAreaView>
  );
}

const onboardingScroll = { flexGrow: 1 } as const;
