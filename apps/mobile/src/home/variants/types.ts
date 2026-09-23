import type { MutableRefObject } from "react";
import type { ScrollView } from "react-native";

import type {
  AudioCaptureSource,
  AudioStateEvent,
} from "../../../modules/murmur-audio";
import type { LiveTranslationController } from "../../lib/useLiveTranslation";
import type { OnboardingStep, PickerMode } from "../types";
import type { HomeViewModel } from "../viewModel";

export type UiVariant = "bloom";

export type VariantShellProps = {
  audioPlaybackAvailable: boolean;
  audioPlaybackEnabled: boolean;
  audioState: AudioStateEvent | null;
  autoScrollRef: MutableRefObject<boolean>;
  captureSource: AudioCaptureSource;
  devicePlaybackSupported: boolean;
  live: LiveTranslationController;
  listeningInBackground: boolean;
  onAudioPlaybackEnabledChange: (enabled: boolean) => void;
  onCaptureSourceChange: (source: AudioCaptureSource) => void;
  onOpenLowBalance: () => void;
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
  captureSource: AudioCaptureSource;
  devicePlaybackSupported: boolean;
  onContinue: () => void;
  onCaptureSourceChange: (source: AudioCaptureSource) => void;
  onOpenPicker: (mode: PickerMode) => void;
  onPrivacyAgree: () => void;
  onStart: () => void;
  onTogglePrivacyConsent: () => void;
  privacyConsentChecked: boolean;
  sourceLanguage: string;
  step: OnboardingStep;
  targetLanguage: string;
};
