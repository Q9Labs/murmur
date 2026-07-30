import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { styles } from "./styles";
import type { OnboardingStep, PickerMode } from "./types";

const brandLogo = require("../../assets/images/icon.png");

export function Onboarding({
  canStart,
  onContinue,
  onOpenPicker,
  onPrivacyAgree,
  onStart,
  onTogglePrivacyConsent,
  privacyConsentChecked,
  sourceLanguage,
  step,
  targetLanguage,
}: {
  canStart: boolean;
  onContinue: () => void;
  onOpenPicker: (mode: PickerMode) => void;
  onPrivacyAgree: () => void;
  onStart: () => void;
  onTogglePrivacyConsent: () => void;
  privacyConsentChecked: boolean;
  sourceLanguage: string;
  step: OnboardingStep;
  targetLanguage: string;
}): ReactNode {
  if (step === "welcome") {
    return <WelcomeOnboarding onContinue={onContinue} />;
  }
  if (step === "privacy") {
    return (
      <PrivacyOnboarding
        onPrivacyAgree={onPrivacyAgree}
        onTogglePrivacyConsent={onTogglePrivacyConsent}
        privacyConsentChecked={privacyConsentChecked}
      />
    );
  }
  return (
    <LanguageSetupOnboarding
      canStart={canStart}
      onOpenPicker={onOpenPicker}
      onStart={onStart}
      sourceLanguage={sourceLanguage}
      targetLanguage={targetLanguage}
    />
  );
}

function WelcomeOnboarding({ onContinue }: { onContinue: () => void }): ReactNode {
  return (
    <OnboardingFrame>
      <View style={styles.welcomeHero}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <View style={styles.previewHeader}>
          <Text style={styles.previewLanguage}>English</Text>
          <Text style={styles.previewArrow}>-&gt;</Text>
          <Text style={styles.previewLanguage}>Arabic</Text>
        </View>
        <Text style={styles.previewTranslation}>أين محطة القطار؟</Text>
        <Text style={styles.previewSource}>Where is the train station?</Text>
        <View style={styles.previewMeter}>
          <View style={[styles.previewMeterBar, styles.previewMeterBarShort]} />
          <View style={styles.previewMeterBar} />
          <View style={[styles.previewMeterBar, styles.previewMeterBarTall]} />
          <View style={styles.previewMeterBar} />
          <View style={[styles.previewMeterBar, styles.previewMeterBarShort]} />
        </View>
      </View>
      <View style={styles.onboardingBody}>
        <Text style={styles.onboardingTitle}>Translate speech as it happens.</Text>
        <Text style={styles.onboardingCopy}>
          Choose a direction, listen, and read clear captions in real time.
        </Text>
      </View>
      <View style={styles.onboardingFooter}>
        <Pressable accessibilityRole="button" onPress={onContinue} style={styles.onboardingButton}>
          <Text style={styles.onboardingButtonText}>Continue</Text>
        </Pressable>
      </View>
    </OnboardingFrame>
  );
}

function PrivacyOnboarding({
  onPrivacyAgree,
  onTogglePrivacyConsent,
  privacyConsentChecked,
}: {
  onPrivacyAgree: () => void;
  onTogglePrivacyConsent: () => void;
  privacyConsentChecked: boolean;
}): ReactNode {
  return (
    <OnboardingFrame>
      <View style={styles.privacyHero}>
        <View style={styles.privacyMic}>
          <View style={styles.privacyMicCapsule} />
          <View style={styles.privacyMicStem} />
        </View>
        <View style={styles.privacyPulseOuter} />
        <View style={styles.privacyPulseInner} />
        <Text style={styles.privacyHeroTitle}>AI processing notice</Text>
        <Text style={styles.privacyHeroCopy}>
          When you tap Listen, Murmur sends live audio through Q9 Labs on Cloudflare
          to OpenAI for transcription, translation, and translated speech.
        </Text>
        <View style={styles.privacyDetails}>
          <Text style={styles.privacyDetailText}>
            Murmur uses this data only to provide translation, speech output, safety reports,
            diagnostics, and abuse prevention.
          </Text>
          <Text style={styles.privacyDetailText}>
            Murmur does not save audio or transcript history by default.
          </Text>
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: privacyConsentChecked }}
          onPress={onTogglePrivacyConsent}
          style={styles.privacyConsentRow}
        >
          <View style={[styles.privacyCheckbox, privacyConsentChecked && styles.privacyCheckboxChecked]}>
            <Text style={styles.privacyCheckboxMark}>{privacyConsentChecked ? "✓" : ""}</Text>
          </View>
          <Text style={styles.privacyConsentText}>
            I agree to share this data with these services for live AI translation.
          </Text>
        </Pressable>
      </View>
      <View style={styles.onboardingFooter}>
        <Pressable
          accessibilityRole="button"
          disabled={!privacyConsentChecked}
          onPress={onPrivacyAgree}
          style={[styles.onboardingButton, !privacyConsentChecked && styles.pressed]}
        >
          <Text style={styles.onboardingButtonText}>Agree and Continue</Text>
        </Pressable>
      </View>
    </OnboardingFrame>
  );
}

function LanguageSetupOnboarding({
  canStart,
  onOpenPicker,
  onStart,
  sourceLanguage,
  targetLanguage,
}: {
  canStart: boolean;
  onOpenPicker: (mode: PickerMode) => void;
  onStart: () => void;
  sourceLanguage: string;
  targetLanguage: string;
}): ReactNode {
  return (
    <OnboardingFrame>
      <View style={styles.onboardingCenter}>
        <View style={styles.setupHero}>
          <Text style={styles.onboardingEyebrow}>First setup</Text>
          <Text style={styles.setupTitle}>Translation direction</Text>
          <View style={styles.setupRows}>
            <SetupButton label="I will speak" value={sourceLanguage} onPress={() => onOpenPicker("source")} />
            <View style={styles.setupConnector}>
              <Text style={styles.setupConnectorText}>-&gt;</Text>
            </View>
            <SetupButton label="Translate into" value={targetLanguage} onPress={() => onOpenPicker("target")} />
          </View>
        </View>
      </View>
      <View style={styles.onboardingFooter}>
        <Pressable
          accessibilityRole="button"
          disabled={!canStart}
          onPress={onStart}
          style={[styles.onboardingButton, !canStart && styles.pressed]}
        >
          <Text style={styles.onboardingButtonText}>Listen</Text>
        </Pressable>
      </View>
    </OnboardingFrame>
  );
}

function OnboardingFrame({ children }: { children: ReactNode }): ReactNode {
  return (
    <ScrollView
      alwaysBounceVertical={false}
      contentContainerStyle={styles.onboardingScroll}
      showsVerticalScrollIndicator={false}
    >
      <OnboardingHeader />
      {children}
    </ScrollView>
  );
}

function OnboardingHeader(): ReactNode {
  return (
    <View style={styles.onboardingHeader}>
      <View style={styles.brandMark}>
        <Image accessibilityIgnoresInvertColors source={brandLogo} style={styles.brandLogo} />
      </View>
      <Text style={styles.brand}>Murmur</Text>
    </View>
  );
}

function SetupButton({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress: () => void;
  value: string;
}): ReactNode {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.setupButton}>
      <Text style={styles.setupLabel}>{label}</Text>
      <Text style={styles.setupValue}>{value}</Text>
    </Pressable>
  );
}
