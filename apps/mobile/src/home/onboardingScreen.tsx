import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import {
  LanguagePickerController,
  type OnboardingStep,
  type PickerMode,
} from "./components";
import { Onboarding } from "./onboarding";
import { styles } from "./styles";

export function OnboardingScreen({
  canStart,
  onContinue,
  onOpenPicker,
  onPickerClose,
  onPrivacyAgree,
  onStart,
  onTogglePrivacyConsent,
  privacyConsentChecked,
  sourceLanguageCode,
  sourceLanguageDisplayName,
  step,
  targetLanguageCode,
  targetLanguageDisplayName,
  pickerMode,
  setSourceLanguageCode,
  setTargetLanguageCode,
}: {
  canStart: boolean;
  onContinue: () => void;
  onOpenPicker: (mode: PickerMode) => void;
  onPickerClose: () => void;
  onPrivacyAgree: () => void;
  onStart: () => void;
  onTogglePrivacyConsent: () => void;
  pickerMode: PickerMode;
  privacyConsentChecked: boolean;
  setSourceLanguageCode: (language: SourceLanguageCode) => void;
  setTargetLanguageCode: (language: LanguageCode) => void;
  sourceLanguageCode: SourceLanguageCode;
  sourceLanguageDisplayName: string;
  step: OnboardingStep;
  targetLanguageCode: LanguageCode;
  targetLanguageDisplayName: string;
}): ReactNode {
  return (
    <SafeAreaView style={styles.screen}>
      <Onboarding
        canStart={canStart}
        onContinue={onContinue}
        onOpenPicker={onOpenPicker}
        onPrivacyAgree={onPrivacyAgree}
        onStart={onStart}
        onTogglePrivacyConsent={onTogglePrivacyConsent}
        privacyConsentChecked={privacyConsentChecked}
        sourceLanguage={sourceLanguageDisplayName}
        step={step}
        targetLanguage={targetLanguageDisplayName}
      />
      <LanguagePickerController
        mode={pickerMode}
        onClose={onPickerClose}
        setSourceLanguageCode={setSourceLanguageCode}
        setTargetLanguageCode={setTargetLanguageCode}
        sourceLanguageCode={sourceLanguageCode}
        targetLanguageCode={targetLanguageCode}
      />
    </SafeAreaView>
  );
}
