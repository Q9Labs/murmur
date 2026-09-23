import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { TranslationSpan } from "@murmur/protocol/session";
import type { ComponentType, MutableRefObject, ReactNode } from "react";
import { Text, View } from "react-native";
import type { ScrollView } from "react-native";

import type { AudioCaptureSource, AudioStateEvent } from "../../modules/murmur-audio";
import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { DiagnosticsModal } from "./diagnosticsModal";
import { LanguagePickerController } from "./languagePicker";
import { ModalSheet } from "./modalSheet";
import { useMurmurBilling } from "../lib/billing/context";
import { OutOfMinutesSheet } from "./outOfMinutesSheet";
import { TranslationReportActions } from "./reportTranslation";
import { styles } from "./styles";
import type { PickerMode } from "./types";
import { UpdateRequiredSheet } from "./updateRequiredSheet";
import { BloomShell } from "./variants/bloom";
import type { UiVariant, VariantShellProps } from "./variants/types";
import type { HomeViewModel } from "./viewModel";

const variantShells: Record<UiVariant, ComponentType<VariantShellProps>> = {
  bloom: BloomShell,
};

export function HomeExperience(props: {
  audioPlaybackAvailable: boolean;
  audioPlaybackEnabled: boolean;
  audioState: AudioStateEvent | null;
  autoScrollRef: MutableRefObject<boolean>;
  diagnosticsOpen: boolean;
  developerToolsEnabled: boolean;
  captureSource: AudioCaptureSource;
  devicePlaybackSupported: boolean;
  live: LiveTranslationController;
  networkType: string;
  onCloseDiagnostics: () => void;
  onClosePicker: () => void;
  onCloseOutOfMinutes: () => void;
  onCloseUpdateRequired: () => void;
  onCaptureSourceChange: (source: AudioCaptureSource) => void;
  onAudioPlaybackEnabledChange: (enabled: boolean) => void;
  onOpenLowBalance: () => void;
  onOpenPicker: (mode: PickerMode) => void;
  onOpenSettings: () => void;
  onPrimaryAction: () => void;
  onSwapLanguages: () => void;
  pickerMode: PickerMode;
  onSeePlans: () => void;
  outOfMinutesOpen: boolean;
  setSourceLanguageCode: (language: SourceLanguageCode) => void;
  setTargetLanguageCode: (language: LanguageCode) => void;
  sourceLanguageCode: SourceLanguageCode;
  targetLanguageCode: LanguageCode;
  timelineRef: MutableRefObject<ScrollView | null>;
  updateRequiredOpen: boolean;
  userInteractedRef: MutableRefObject<boolean>;
  viewModel: HomeViewModel;
}): ReactNode {
  const Shell = variantShells.bloom;
  const { customer } = useMurmurBilling();
  return (
    <>
      <Shell
        audioPlaybackAvailable={props.audioPlaybackAvailable}
        audioPlaybackEnabled={props.audioPlaybackEnabled}
        audioState={props.audioState}
        autoScrollRef={props.autoScrollRef}
        captureSource={props.captureSource}
        devicePlaybackSupported={props.devicePlaybackSupported}
        live={props.live}
        onAudioPlaybackEnabledChange={props.onAudioPlaybackEnabledChange}
        onCaptureSourceChange={props.onCaptureSourceChange}
        onOpenLowBalance={props.onOpenLowBalance}
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
      <OutOfMinutesSheet
        customer={customer}
        onClose={props.onCloseOutOfMinutes}
        onSeePlans={props.onSeePlans}
        open={props.outOfMinutesOpen}
      />
      <UpdateRequiredSheet onClose={props.onCloseUpdateRequired} open={props.updateRequiredOpen} />
      {props.developerToolsEnabled ? (
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
      ) : (
        <TranslationReportModal
          live={props.live}
          onClose={props.onCloseDiagnostics}
          open={props.diagnosticsOpen}
          targetLanguageRtl={props.viewModel.targetLanguage.rtl}
        />
      )}
    </>
  );
}

export function TranslationReportModal({
  live,
  onClose,
  open,
  targetLanguageRtl,
}: {
  live: LiveTranslationController;
  onClose: () => void;
  open: boolean;
  targetLanguageRtl: boolean;
}): ReactNode {
  const reportableSpans = [...live.spans.filter((span) => span.status === "committed")].reverse();

  return (
    <ModalSheet onClose={onClose} open={open} scroll title="Report translation">
      <View style={styles.timeline}>
        {reportableSpans.length === 0 ? (
          <Text style={styles.timelineEmpty}>No committed translations yet.</Text>
        ) : (
          reportableSpans.map((span) => (
            <ReportSpanRow
              key={`${span.span_id}-${span.revision}`}
              live={live}
              span={span}
              targetLanguageRtl={targetLanguageRtl}
            />
          ))
        )}
      </View>
    </ModalSheet>
  );
}

function ReportSpanRow({
  live,
  span,
  targetLanguageRtl,
}: {
  live: LiveTranslationController;
  span: TranslationSpan;
  targetLanguageRtl: boolean;
}): ReactNode {
  return (
    <View style={styles.spanRow}>
      <Text style={styles.spanSource}>{span.source_caption}</Text>
      <Text style={[styles.spanTranslation, targetLanguageRtl && styles.rtlText]}>
        {span.committed_translated_caption ?? span.translated_caption}
      </Text>
      <TranslationReportActions live={live} span={span} />
    </View>
  );
}
