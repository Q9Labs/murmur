import type { ComponentType, ReactNode } from "react";

import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import {
  LanguagePickerController,
  type OnboardingStep,
  type PickerMode,
} from "./components";
import { AuraOnboarding } from "./variants/aura/onboarding";
import { BloomOnboarding } from "./variants/bloom/onboarding";
import { ClassicOnboarding } from "./variants/classic";
import { ConsoleOnboarding } from "./variants/fieldConsole/onboarding";
import type { UiVariant, VariantOnboardingProps } from "./variants/types";

const onboardingShells: Record<UiVariant, ComponentType<VariantOnboardingProps>> = {
  aura: AuraOnboarding,
  bloom: BloomOnboarding,
  classic: ClassicOnboarding,
  console: ConsoleOnboarding,
};

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
  uiVariant,
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
  uiVariant: UiVariant;
}): ReactNode {
  const OnboardingShell = onboardingShells[uiVariant];

  return (
    <>
      <OnboardingShell
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
    </>
  );
}
