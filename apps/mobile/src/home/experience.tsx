import type { ComponentType, MutableRefObject, ReactNode } from "react";
import { ScrollView } from "react-native";

import type { AudioStateEvent } from "../../modules/murmur-audio";
import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { LiveTranslationController } from "../lib/useLiveTranslation";
import type { TranslationMode, TranslationModelRoute } from "@murmur/protocol/transport/types";
import { DiagnosticsModal } from "./diagnosticsModal";
import { LanguagePickerController } from "./languagePicker";
import { DevModelRouteModal, SettingsModal } from "./settingsModals";
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

export function HomeExperience({
  audioState,
  continuousAutoScrollRef,
  continuousTimelineRef,
  continuousUserInteractedRef,
  devModelPickerEnabled,
  devModelRoute,
  devModelRouteOpen,
  diagnosticsOpen,
  live,
  networkType,
  onCloseDevModelRoute,
  onCloseDiagnostics,
  onClosePicker,
  onCloseSettings,
  onDeleteLocalData,
  onOpenDevModelRoute,
  onOpenDiagnostics,
  onOpenPicker,
  onOpenSettings,
  onPrimaryAction,
  onResetIdentity,
  onSelectDevModelRoute,
  onSelectUiVariant,
  onSwapLanguages,
  onToggleTranslationMode,
  onToggleUltravoxVad,
  pickerMode,
  setSourceLanguageCode,
  setTargetLanguageCode,
  settingsMessage,
  settingsOpen,
  sourceLanguageCode,
  targetLanguageCode,
  translationMode,
  uiVariant,
  ultravoxVadEnabled,
  viewModel,
}: {
  audioState: AudioStateEvent | null;
  continuousAutoScrollRef: MutableRefObject<boolean>;
  continuousTimelineRef: MutableRefObject<ScrollView | null>;
  continuousUserInteractedRef: MutableRefObject<boolean>;
  devModelPickerEnabled: boolean;
  devModelRoute: TranslationModelRoute;
  devModelRouteOpen: boolean;
  diagnosticsOpen: boolean;
  live: LiveTranslationController;
  networkType: string;
  onCloseDevModelRoute: () => void;
  onCloseDiagnostics: () => void;
  onClosePicker: () => void;
  onCloseSettings: () => void;
  onDeleteLocalData: () => void;
  onOpenDevModelRoute: () => void;
  onOpenDiagnostics: () => void;
  onOpenPicker: (mode: PickerMode) => void;
  onOpenSettings: () => void;
  onPrimaryAction: () => void;
  onResetIdentity: () => void;
  onSelectDevModelRoute: (route: TranslationModelRoute) => void;
  onSelectUiVariant: (variant: UiVariant) => void;
  onSwapLanguages: () => void;
  onToggleTranslationMode: (mode: TranslationMode) => void;
  onToggleUltravoxVad: () => void;
  pickerMode: PickerMode;
  setSourceLanguageCode: (language: SourceLanguageCode) => void;
  setTargetLanguageCode: (language: LanguageCode) => void;
  settingsMessage: string | null;
  settingsOpen: boolean;
  sourceLanguageCode: SourceLanguageCode;
  targetLanguageCode: LanguageCode;
  translationMode: TranslationMode;
  uiVariant: UiVariant;
  ultravoxVadEnabled: boolean;
  viewModel: HomeViewModel;
}): ReactNode {
  const Shell = variantShells[uiVariant];

  return (
    <>
      <Shell
        audioState={audioState}
        continuousAutoScrollRef={continuousAutoScrollRef}
        continuousTimelineRef={continuousTimelineRef}
        continuousUserInteractedRef={continuousUserInteractedRef}
        live={live}
        onOpenPicker={onOpenPicker}
        onOpenSettings={onOpenSettings}
        onPrimaryAction={onPrimaryAction}
        onSwapLanguages={onSwapLanguages}
        onToggleTranslationMode={onToggleTranslationMode}
        translationMode={translationMode}
        viewModel={viewModel}
      />
      <LanguagePickerController
        mode={pickerMode}
        onClose={onClosePicker}
        setSourceLanguageCode={setSourceLanguageCode}
        setTargetLanguageCode={setTargetLanguageCode}
        sourceLanguageCode={sourceLanguageCode}
        targetLanguageCode={targetLanguageCode}
      />
      <SettingsModal
        devModelPickerEnabled={devModelPickerEnabled}
        devModelRoute={devModelRoute}
        live={live}
        onClose={onCloseSettings}
        onDeleteLocalData={onDeleteLocalData}
        onOpenDevModelRoute={onOpenDevModelRoute}
        onOpenDiagnostics={onOpenDiagnostics}
        onResetIdentity={onResetIdentity}
        onSelectUiVariant={onSelectUiVariant}
        onToggleUltravoxVad={onToggleUltravoxVad}
        open={settingsOpen}
        settingsMessage={settingsMessage}
        uiVariant={uiVariant}
        ultravoxVadEnabled={ultravoxVadEnabled}
      />
      <DevModelRouteModal
        onClose={onCloseDevModelRoute}
        onSelect={onSelectDevModelRoute}
        open={devModelPickerEnabled && devModelRouteOpen}
        selected={devModelRoute}
      />
      <DiagnosticsModal
        audioState={audioState}
        latestProviderRoute={viewModel.latestProviderRoute}
        live={live}
        networkType={networkType}
        onClose={onCloseDiagnostics}
        open={diagnosticsOpen}
        sourceLanguageCode={sourceLanguageCode}
        targetLanguage={viewModel.targetLanguage}
        targetLanguageCode={targetLanguageCode}
      />
    </>
  );
}
