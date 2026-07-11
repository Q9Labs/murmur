import type { MutableRefObject, ReactNode } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AudioStateEvent } from "../../modules/murmur-audio";
import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { LiveTranslationController } from "../lib/useLiveTranslation";
import type { TranslationMode, TranslationModelRoute } from "@murmur/protocol/transport/types";
import { AppChrome } from "./appChrome";
import { BottomDock } from "./bottomDock";
import { DiagnosticsModal } from "./diagnosticsModal";
import { LanguagePickerController } from "./languagePicker";
import { LanguageStrip, ModeToggle } from "./languageControls";
import { DevModelRouteModal, SettingsModal } from "./settingsModals";
import { styles } from "./styles";
import { TranslationSurface } from "./translationSurface";
import type { PickerMode } from "./types";
import type { HomeViewModel } from "./viewModel";

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
  ultravoxVadEnabled: boolean;
  viewModel: HomeViewModel;
}): ReactNode {
  return (
    <SafeAreaView style={styles.screen}>
      <AppChrome
        audioState={audioState}
        healthText={viewModel.healthText}
        onOpenSettings={onOpenSettings}
        status={live.status}
      />
      <LanguageStrip
        canChangeLanguages={viewModel.canChangeLanguages}
        canSwapLanguages={viewModel.canSwapLanguages}
        onOpenPicker={onOpenPicker}
        onSwapLanguages={onSwapLanguages}
        sourceLanguageDisplayName={viewModel.sourceLanguageDisplayName}
        targetLanguageDisplayName={viewModel.targetLanguage.display_name}
      />
      <ModeToggle
        canChangeLanguages={viewModel.canChangeLanguages}
        onToggleTranslationMode={onToggleTranslationMode}
        translationMode={translationMode}
      />
      <TranslationSurface
        continuousAutoScrollRef={continuousAutoScrollRef}
        continuousTimelineRef={continuousTimelineRef}
        continuousUserInteractedRef={continuousUserInteractedRef}
        live={live}
        translationMode={translationMode}
        viewModel={viewModel}
      />
      <BottomDock
        canStart={viewModel.canStart}
        error={live.error}
        isLive={viewModel.isLive}
        onPrimaryAction={onPrimaryAction}
        reportError={live.report_error}
        reportReceiptId={live.report_receipt_id}
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
        onToggleUltravoxVad={onToggleUltravoxVad}
        open={settingsOpen}
        settingsMessage={settingsMessage}
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
    </SafeAreaView>
  );
}
