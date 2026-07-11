import type { ReactNode } from "react";
import { ScrollView, StatusBar, Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OnboardingFlow, type OnboardingTheme, type OnboardingText } from "../onboardingFlow";
import type { VariantOnboardingProps } from "../types";
import { consoleAccents, consolePalettes, styles, type ConsolePalette } from "./styles";

const consoleText: OnboardingText = {
  agreeLabel: "AGREE AND CONTINUE",
  continueLabel: "CONTINUE",
  languagesEyebrowText: "ROUTE",
  languagesTitle: "Translation direction",
  listenLabel: "LISTEN",
  privacyEyebrowText: "AI PROCESSING NOTICE",
  sourceLabel: "INPUT",
  targetLabel: "OUTPUT",
  welcomeCopy: "Choose a direction, listen, and read clear captions in real time.",
  welcomeEyebrowText: "LIVE TRANSLATION",
  welcomeTitle: "Speech in. Translated captions and speech out.",
};

function buildConsoleTheme(palette: ConsolePalette): OnboardingTheme {
  return {
    body: styles.onboardingBody,
    buttonStyle: styles.listenKey,
    buttonTextStyle: styles.listenKeyText,
    checkbox: [styles.checkBox, { borderColor: palette.hairline }],
    checkboxChecked: { backgroundColor: consoleAccents.signal, borderColor: consoleAccents.signal },
    checkboxMark: [styles.checkMark, { color: palette.panel }],
    consentRow: styles.checkRow,
    copy: [styles.onboardingCopy, { color: palette.muted }],
    copyEmphasis: [styles.onboardingCopy, { color: palette.ink }],
    eyebrow: [styles.kicker, { color: consoleAccents.signal }],
    footer: styles.onboardingFooter,
    pressed: styles.pressed,
    privacyEyebrow: [styles.kicker, { color: consoleAccents.caution }],
    setupRow: [styles.setupKey, { backgroundColor: palette.panel, borderColor: palette.hairline }],
    setupValue: [styles.onboardingTitle, { color: palette.ink }],
    title: [styles.onboardingTitle, { color: palette.ink }],
  };
}

function stepIndicator(step: VariantOnboardingProps["step"]): string {
  if (step === "welcome") {
    return "SETUP 1/3";
  }
  return step === "privacy" ? "SETUP 2/3" : "SETUP 3/3";
}

export function ConsoleOnboarding(props: VariantOnboardingProps): ReactNode {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const palette = consolePalettes[dark ? "dark" : "light"];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.chassis }]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <Text style={[styles.wordmark, { color: palette.ink }]}>MURMUR</Text>
        <Text style={[styles.headerStat, { color: palette.muted }]}>{stepIndicator(props.step)}</Text>
      </View>
      <ScrollView alwaysBounceVertical={false} contentContainerStyle={onboardingScroll}>
        <OnboardingFlow {...props} text={consoleText} theme={buildConsoleTheme(palette)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const onboardingScroll = { flexGrow: 1 } as const;
