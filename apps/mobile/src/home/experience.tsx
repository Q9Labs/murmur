import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { ComponentType, MutableRefObject, ReactNode } from "react";
import type { ScrollView } from "react-native";

import type { AudioStateEvent } from "../../modules/murmur-audio";
import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { DiagnosticsModal } from "./diagnosticsModal";
import { LanguagePickerController } from "./languagePicker";
import { SettingsModal } from "./settingsModals";
import type { PickerMode } from "./types";
import { AuraShell } from "./variants/aura";
import { BloomShell } from "./variants/bloom";
import { ClassicShell } from "./variants/classic";
import { FieldConsoleShell } from "./variants/fieldConsole";
import type { UiVariant, VariantShellProps } from "./variants/types";
import type { HomeViewModel } from "./viewModel";

const variantShells: Record<UiVariant, ComponentType<VariantShellProps>> = {
  aura: AuraShell,
  bloom: BloomShell,
  classic: ClassicShell,
  console: FieldConsoleShell,
};

export function HomeExperience(props: {
  audioState: AudioStateEvent | null;
  autoScrollRef: MutableRefObject<boolean>;
  diagnosticsOpen: boolean;
  live: LiveTranslationController;
  networkType: string;
  onCloseDiagnostics: () => void;
  onClosePicker: () => void;
  onCloseSettings: () => void;
  onDeleteLocalData: () => void;
  onOpenDiagnostics: () => void;
  onOpenPicker: (mode: PickerMode) => void;
  onOpenSettings: () => void;
  onPrimaryAction: () => void;
  onResetIdentity: () => void;
  onSelectUiVariant: (variant: UiVariant) => void;
  onShare: () => void;
  onSwapLanguages: () => void;
  pickerMode: PickerMode;
  setSourceLanguageCode: (language: SourceLanguageCode) => void;
  setTargetLanguageCode: (language: LanguageCode) => void;
  settingsMessage: string | null;
  settingsOpen: boolean;
  sourceLanguageCode: SourceLanguageCode;
  targetLanguageCode: LanguageCode;
  timelineRef: MutableRefObject<ScrollView | null>;
  uiVariant: UiVariant;
  userInteractedRef: MutableRefObject<boolean>;
  viewModel: HomeViewModel;
}): ReactNode {
  const Shell = variantShells[props.uiVariant];
  return (
    <>
      <Shell
        audioState={props.audioState}
        autoScrollRef={props.autoScrollRef}
        live={props.live}
        onOpenPicker={props.onOpenPicker}
        onOpenSettings={props.onOpenSettings}
        onPrimaryAction={props.onPrimaryAction}
        onSwapLanguages={props.onSwapLanguages}
        timelineRef={props.timelineRef}
        userInteractedRef={props.userInteractedRef}
        viewModel={props.viewModel}
      />
      <LanguagePickerController
        mode={props.pickerMode}
        onClose={props.onClosePicker}
        setSourceLanguageCode={props.setSourceLanguageCode}
        setTargetLanguageCode={props.setTargetLanguageCode}
        sourceLanguageCode={props.sourceLanguageCode}
        targetLanguageCode={props.targetLanguageCode}
      />
      <SettingsModal
        live={props.live}
        onClose={props.onCloseSettings}
        onDeleteLocalData={props.onDeleteLocalData}
        onOpenDiagnostics={props.onOpenDiagnostics}
        onResetIdentity={props.onResetIdentity}
        onSelectUiVariant={props.onSelectUiVariant}
        onShare={props.onShare}
        open={props.settingsOpen}
        settingsMessage={props.settingsMessage}
        uiVariant={props.uiVariant}
      />
      <DiagnosticsModal
        audioState={props.audioState}
        latestProviderRoute={props.viewModel.latestProviderRoute}
        live={props.live}
        networkType={props.networkType}
        onClose={props.onCloseDiagnostics}
        open={props.diagnosticsOpen}
        sourceLanguageCode={props.sourceLanguageCode}
        targetLanguage={props.viewModel.targetLanguage}
        targetLanguageCode={props.targetLanguageCode}
      />
    </>
  );
}
