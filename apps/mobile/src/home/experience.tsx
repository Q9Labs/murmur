import {
  autoSourceLanguageCode,
  getLanguage,
  type LanguageCode,
  type SourceLanguageCode,
} from "@murmur/protocol/languages";
import type { TranslationSpan } from "@murmur/protocol/session";
import type { ComponentType, MutableRefObject, ReactNode } from "react";
import { Text, View } from "react-native";
import { PostHogMaskView } from "posthog-react-native";
import type { ScrollView } from "react-native";

import type { AudioCaptureSource, AudioStateEvent } from "../../modules/murmur-audio";
import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { uiTextDirectionStyle, useUiLocale } from "../i18n/runtime";
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
import { useAppInBackground } from "./variants/bloom/backgroundListening";
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
  const inBackground = useAppInBackground();
  return (
    <>
      <Shell
        audioPlaybackAvailable={props.audioPlaybackAvailable}
        audioPlaybackEnabled={props.audioPlaybackEnabled}
        audioState={props.audioState}
        autoScrollRef={props.autoScrollRef}
        captureSource={props.captureSource}
        devicePlaybackSupported={props.devicePlaybackSupported}
        listeningInBackground={inBackground && props.viewModel.isLive}
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
          sourceLanguageDirection={
            props.sourceLanguageCode === autoSourceLanguageCode
              ? "auto"
              : getLanguage(props.sourceLanguageCode).rtl ? "rtl" : "ltr"
          }
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
  sourceLanguageDirection,
  targetLanguageRtl,
}: {
  live: LiveTranslationController;
  onClose: () => void;
  open: boolean;
  sourceLanguageDirection: "auto" | "ltr" | "rtl";
  targetLanguageRtl: boolean;
}): ReactNode {
  const { direction, t } = useUiLocale();
  const reportableSpans = [...live.spans.filter((span) => span.status === "committed")].reverse();

  return (
    <ModalSheet onClose={onClose} open={open} scroll title={t("report.title")}>
      <View style={styles.timeline}>
        {reportableSpans.length === 0 ? (
          <Text style={[styles.timelineEmpty, uiTextDirectionStyle(direction)]}>
            {t("report.noCommittedTranslations")}
          </Text>
        ) : (
          reportableSpans.map((span) => (
            <ReportSpanRow
              key={`${span.span_id}-${span.revision}`}
              live={live}
              span={span}
              sourceLanguageDirection={sourceLanguageDirection}
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
  sourceLanguageDirection,
  span,
  targetLanguageRtl,
}: {
  live: LiveTranslationController;
  sourceLanguageDirection: "auto" | "ltr" | "rtl";
  span: TranslationSpan;
  targetLanguageRtl: boolean;
}): ReactNode {
  return (
    <View style={styles.spanRow}>
      <PostHogMaskView>
        <Text style={[
          styles.spanSource,
          sourceLanguageDirection === "auto"
            ? styles.autoText
            : sourceLanguageDirection === "rtl" ? styles.rtlText : styles.ltrText,
        ]}>
          {span.source_caption}
        </Text>
        <Text style={[styles.spanTranslation, targetLanguageRtl ? styles.rtlText : styles.ltrText]}>
          {span.committed_translated_caption ?? span.translated_caption}
        </Text>
      </PostHogMaskView>
      <TranslationReportActions live={live} span={span} />
    </View>
  );
}
