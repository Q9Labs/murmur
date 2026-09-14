import type { ComponentType, ReactNode } from "react";

import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { AudioCaptureSource } from "../../modules/murmur-audio";
import {
  LanguagePickerController,
  type OnboardingStep,
  type PickerMode,
} from "./components";
import { BloomOnboarding } from "./variants/bloom/onboarding";
import type { UiVariant, VariantOnboardingProps } from "./variants/types";

const onboardingShells: Record<UiVariant, ComponentType<VariantOnboardingProps>> = {
  bloom: BloomOnboarding,
};

export function OnboardingScreen({
  canStart,
  captureSource,
  devicePlaybackSupported,
  onContinue,
  onCaptureSourceChange,
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
  captureSource: AudioCaptureSource;
  devicePlaybackSupported: boolean;
  onContinue: () => void;
  onCaptureSourceChange: (source: AudioCaptureSource) => void;
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
  const OnboardingShell = onboardingShells.bloom;
  return (
    <>
      <OnboardingShell
        canStart={canStart}
        captureSource={captureSource}
        devicePlaybackSupported={devicePlaybackSupported}
        onContinue={onContinue}
        onCaptureSourceChange={onCaptureSourceChange}
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
