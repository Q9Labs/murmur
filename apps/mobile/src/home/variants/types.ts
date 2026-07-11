import type { MutableRefObject } from "react";
import type { ScrollView } from "react-native";

import type { AudioStateEvent } from "../../../modules/murmur-audio";
import type { LiveTranslationController } from "../../lib/useLiveTranslation";
import type { TranslationMode } from "@murmur/protocol/transport/types";
import type { OnboardingStep, PickerMode } from "../types";
import type { HomeViewModel } from "../viewModel";

export type UiVariant = "aura" | "bloom" | "classic" | "console";

export const uiVariantOptions = [
  { detail: "Precision console with live signal readouts.", id: "console", label: "Field Console" },
  { detail: "Words floating in a field of drifting light.", id: "aura", label: "Aura" },
  { detail: "A calm shape that breathes while you speak.", id: "bloom", label: "Bloom" },
  { detail: "The original Murmur look.", id: "classic", label: "Classic" },
] as const satisfies readonly { detail: string; id: UiVariant; label: string }[];

export type VariantShellProps = {
  audioState: AudioStateEvent | null;
  continuousAutoScrollRef: MutableRefObject<boolean>;
  continuousTimelineRef: MutableRefObject<ScrollView | null>;
  continuousUserInteractedRef: MutableRefObject<boolean>;
  live: LiveTranslationController;
  onOpenPicker: (mode: PickerMode) => void;
  onOpenSettings: () => void;
  onPrimaryAction: () => void;
  onSwapLanguages: () => void;
  onToggleTranslationMode: (mode: TranslationMode) => void;
  translationMode: TranslationMode;
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
