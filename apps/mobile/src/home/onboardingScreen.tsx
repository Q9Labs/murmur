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

export type OnboardingScreenProps = Omit<VariantOnboardingProps, "sourceLanguage" | "targetLanguage"> & {
  onPickerClose: () => void;
  pickerMode: PickerMode;
  setSourceLanguageCode: (language: SourceLanguageCode) => void;
  setTargetLanguageCode: (language: LanguageCode) => void;
  sourceLanguageCode: SourceLanguageCode;
  sourceLanguageDisplayName: string;
  targetLanguageCode: LanguageCode;
  targetLanguageDisplayName: string;
};

export function OnboardingScreen(props: OnboardingScreenProps): ReactNode {
  return (
    <>
      <OnboardingShell {...props} />
      <LanguagePickerController
        mode={props.pickerMode}
        onClose={props.onPickerClose}
        setSourceLanguageCode={props.setSourceLanguageCode}
        setTargetLanguageCode={props.setTargetLanguageCode}
        sourceLanguageCode={props.sourceLanguageCode}
        targetLanguageCode={props.targetLanguageCode}
      />
    </>
  );
}

function OnboardingShell({
  canStart,
  captureSource,
  devicePlaybackSupported,
  onAlreadySubscribed,
  onContinue,
  onCaptureSourceChange,
  onOpenPicker,
  onPrivacyAgree,
  onStart,
  onTogglePrivacyConsent,
  privacyConsentChecked,
  sourceLanguageDisplayName,
  step,
  targetLanguageDisplayName,
}: OnboardingScreenProps): ReactNode {
  const Shell = onboardingShells.bloom;
  return (
    <Shell
      canStart={canStart}
      captureSource={captureSource}
      devicePlaybackSupported={devicePlaybackSupported}
      onAlreadySubscribed={onAlreadySubscribed}
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
  );
}
