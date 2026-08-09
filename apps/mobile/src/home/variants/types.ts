import type { MutableRefObject } from "react";
import type { ScrollView } from "react-native";

import type { AudioStateEvent } from "../../../modules/murmur-audio";
import type { LiveTranslationController } from "../../lib/useLiveTranslation";
import type { OnboardingStep, PickerMode } from "../types";
import type { HomeViewModel } from "../viewModel";

export type UiVariant = "bloom";

export type VariantShellProps = {
  audioState: AudioStateEvent | null;
  autoScrollRef: MutableRefObject<boolean>;
  live: LiveTranslationController;
  onOpenPicker: (mode: PickerMode) => void;
  onOpenSettings: () => void;
  onPrimaryAction: () => void;
  onSwapLanguages: () => void;
  timelineRef: MutableRefObject<ScrollView | null>;
  userInteractedRef: MutableRefObject<boolean>;
  viewModel: HomeViewModel;
};

export type VariantOnboardingProps = {
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
};
