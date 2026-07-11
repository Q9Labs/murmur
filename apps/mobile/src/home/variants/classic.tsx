import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppChrome } from "../appChrome";
import { BottomDock } from "../bottomDock";
import { LanguageStrip, ModeToggle } from "../languageControls";
import { Onboarding } from "../onboarding";
import { styles } from "../styles";
import { TranslationSurface } from "../translationSurface";
import type { VariantOnboardingProps, VariantShellProps } from "./types";

export function ClassicOnboarding(props: VariantOnboardingProps): ReactNode {
  return (
    <SafeAreaView style={styles.screen}>
      <Onboarding {...props} />
    </SafeAreaView>
  );
}

export function ClassicShell({
  audioState,
  continuousAutoScrollRef,
  continuousTimelineRef,
  continuousUserInteractedRef,
  live,
  onOpenPicker,
  onOpenSettings,
  onPrimaryAction,
  onSwapLanguages,
  onToggleTranslationMode,
  translationMode,
  viewModel,
}: VariantShellProps): ReactNode {
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
    </SafeAreaView>
  );
}
