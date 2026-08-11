import { useState } from "react";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { AudioStateEvent } from "../../modules/murmur-audio";
import {
  formatUiNumber,
  uiTextDirectionStyle,
  useUiLocale,
} from "../i18n/runtime";
import type { Translate } from "../i18n/runtime";
import { formatLatencyPercentiles } from "../lib/latency";
import { getLanguage, type LanguageCode, type LanguageDefinition, type SourceLanguageCode } from "@murmur/protocol/languages";
import type { TranslationSpan } from "@murmur/protocol/session";
import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { copyDiagnosticsReport, downloadDiagnosticsReport, shareLatencyReport } from "./diagnostics";
import { ModalSheet } from "./modalSheet";
import { TranslationReportActions } from "./reportTranslation";
import { styles } from "./styles";

export function DiagnosticsModal({
  audioState,
  latestProviderRoute,
  live,
  networkType,
  onClose,
  open,
  sourceLanguageCode,
  targetLanguage,
  targetLanguageCode,
}: {
  audioState: AudioStateEvent | null;
  latestProviderRoute: string;
  live: LiveTranslationController;
  networkType: string;
  onClose: () => void;
  open: boolean;
  sourceLanguageCode: SourceLanguageCode;
  targetLanguage: LanguageDefinition;
  targetLanguageCode: LanguageCode;
}): ReactNode {
  const [diagnosticsMessage, setDiagnosticsMessage] = useState<string | null>(null);
  const { direction, locale, t } = useUiLocale();
  const getReportParams = () => buildDiagnosticsReportParams({
    audioState,
    latestProviderRoute,
    live,
    networkType,
    sourceLanguageCode,
    targetLanguageCode,
  });
  const hasReport = live.latency_samples.length > 0 || live.debug_log.length > 0 || live.spans.length > 0;

  return (
    <ModalSheet onClose={onClose} open={open} title={t("diagnostics.title")}>
      <ScrollView contentContainerStyle={styles.diagnosticsContent}>
        <DiagnosticsMetrics audioState={audioState} direction={direction} live={live} locale={locale} translate={t} />
        <DiagnosticsLatency direction={direction} live={live} locale={locale} translate={t} />
        <DiagnosticActions
          direction={direction}
          getReportParams={getReportParams}
          hasReport={hasReport}
          setDiagnosticsMessage={setDiagnosticsMessage}
          translate={t}
        />
        {diagnosticsMessage ? (
          <Text style={[styles.diagnosticsMessage, uiTextDirectionStyle(direction)]}>
            {diagnosticsMessage}
          </Text>
        ) : null}
        <DiagnosticsTimeline
          direction={direction}
          live={live}
          sourceLanguageCode={sourceLanguageCode}
          targetLanguage={targetLanguage}
          translate={t}
        />
      </ScrollView>
    </ModalSheet>
  );
}

function buildDiagnosticsReportParams({
  audioState,
  latestProviderRoute,
  live,
  networkType,
  sourceLanguageCode,
  targetLanguageCode,
}: {
  audioState: AudioStateEvent | null;
  latestProviderRoute: string;
  live: LiveTranslationController;
  networkType: string;
  sourceLanguageCode: SourceLanguageCode;
  targetLanguageCode: LanguageCode;
}) {
  return {
    appSessionId: live.session.identity.app_session_id,
    audioState,
    debugLog: live.debug_log,
    diagnosticsSnapshot: live.getDiagnosticsSnapshot(),
    error: live.error,
    networkType,
    providerRoute: latestProviderRoute,
    samples: live.latency_samples,
    session: live.session,
    spans: live.spans,
    sourceLanguage: sourceLanguageCode,
    status: live.status,
    targetLanguage: targetLanguageCode,
  };
}

function getDownloadMessage(result: string, translate: Translate): string {
  if (result === "web_downloaded") {
    return translate("diagnostics.downloaded");
  }
  if (result === "native_shared") {
    return translate("diagnostics.fileReadyToShare");
  }
  return translate("diagnostics.fileCouldNotPrepare");
}

function DiagnosticsMetrics({
  audioState,
  direction,
  live,
  locale,
  translate,
}: {
  audioState: AudioStateEvent | null;
  direction: "ltr" | "rtl";
  live: LiveTranslationController;
  locale: "en" | "ar";
  translate: Translate;
}): ReactNode {
  return (
    <View style={styles.metricsRow}>
      <Metric direction={direction} label={translate("diagnostics.session")} value={live.status} valueDirection="ltr" />
      <Metric
        direction={direction}
        label={translate("diagnostics.spans")}
        value={formatUiNumber(live.spans.length, locale)}
        valueDirection={direction}
      />
      <Metric
        direction={direction}
        label={translate("diagnostics.mic")}
        value={formatBooleanState(audioState?.capture_active, translate)}
        valueDirection={direction}
      />
      <Metric
        direction={direction}
        label={translate("diagnostics.speech")}
        value={formatBooleanState(audioState?.playback_active, translate)}
        valueDirection={direction}
      />
    </View>
  );
}

function formatBooleanState(active: boolean | undefined, translate: Translate): string {
  return active ? translate("diagnostics.on") : translate("diagnostics.off");
}

function DiagnosticActions({
  direction,
  getReportParams,
  hasReport,
  setDiagnosticsMessage,
  translate,
}: {
  direction: "ltr" | "rtl";
  getReportParams: () => ReturnType<typeof buildDiagnosticsReportParams>;
  hasReport: boolean;
  setDiagnosticsMessage: (message: string | null) => void;
  translate: Translate;
}): ReactNode {
  return (
    <View style={styles.diagnosticActions}>
      <Pressable
        accessibilityRole="button"
        disabled={!hasReport}
        onPress={() =>
          void copyDiagnosticsReport(getReportParams()).then(() => {
            setDiagnosticsMessage(translate("diagnostics.copied"));
          })
        }
        style={[styles.diagnosticButton, !hasReport && styles.pressed]}
      >
        <Text style={[styles.diagnosticButtonText, uiTextDirectionStyle(direction)]}>
          {translate("diagnostics.copyReport")}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={!hasReport}
        onPress={() =>
          void downloadDiagnosticsReport(getReportParams())
            .then((result) => {
              setDiagnosticsMessage(getDownloadMessage(result, translate));
            })
            .catch(() => {
              setDiagnosticsMessage(translate("diagnostics.fileCouldNotPrepare"));
            })
        }
        style={[styles.diagnosticButtonSecondary, !hasReport && styles.pressed]}
      >
        <Text style={[styles.diagnosticButtonTextSecondary, uiTextDirectionStyle(direction)]}>
          {translate("diagnostics.downloadText")}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={!hasReport}
        onPress={() =>
          void shareLatencyReport(getReportParams())
            .then((result) => {
              setDiagnosticsMessage(
                result === "native_file"
                  ? translate("diagnostics.fileShared")
                  : translate("diagnostics.shared"),
              );
            })
            .catch(() => {
              setDiagnosticsMessage(translate("diagnostics.couldNotShare"));
            })
        }
        style={[styles.diagnosticButtonSecondary, !hasReport && styles.pressed]}
      >
        <Text style={[styles.diagnosticButtonTextSecondary, uiTextDirectionStyle(direction)]}>
          {translate("diagnostics.share")}
        </Text>
      </Pressable>
    </View>
  );
}

function DiagnosticsLatency({
  direction,
  live,
  locale,
  translate,
}: {
  direction: "ltr" | "rtl";
  live: LiveTranslationController;
  locale: "en" | "ar";
  translate: Translate;
}): ReactNode {
  return (
    <>
      <LatencyRow
        direction={direction}
        label={translate("diagnostics.firstSourceTranscript")}
        value={formatLatencyPercentiles(
          live.latency_report.first_source_transcript,
          (value) => formatUiNumber(value, locale),
        )}
      />
      <LatencyRow
        direction={direction}
        label={translate("diagnostics.firstTranslatedTranscript")}
        value={formatLatencyPercentiles(
          live.latency_report.first_translated_transcript,
          (value) => formatUiNumber(value, locale),
        )}
      />
    </>
  );
}

function DiagnosticsTimeline({
  direction,
  live,
  sourceLanguageCode,
  targetLanguage,
  translate,
}: {
  direction: "ltr" | "rtl";
  live: LiveTranslationController;
  sourceLanguageCode: SourceLanguageCode;
  targetLanguage: LanguageDefinition;
  translate: Translate;
}): ReactNode {
  const sourceLanguage = sourceLanguageCode === "auto" ? null : getLanguage(sourceLanguageCode);
  return (
    <View style={styles.timeline}>
      {live.spans.length === 0 ? (
        <Text style={[styles.timelineEmpty, uiTextDirectionStyle(direction)]}>
          {translate("diagnostics.noSpans")}
        </Text>
      ) : (
        [...live.spans].reverse().map((span) => (
          <DiagnosticSpanRow
            key={`${span.span_id}-${span.revision}`}
            live={live}
            span={span}
            sourceRtl={Boolean(sourceLanguage?.rtl)}
            targetLanguage={targetLanguage}
          />
        ))
      )}
    </View>
  );
}

function DiagnosticSpanRow({
  live,
  sourceRtl,
  span,
  targetLanguage,
}: {
  live: LiveTranslationController;
  sourceRtl: boolean;
  span: TranslationSpan;
  targetLanguage: LanguageDefinition;
}): ReactNode {
  return (
    <View style={styles.spanRow}>
      <Text style={[styles.spanSource, sourceRtl ? styles.rtlText : styles.ltrText]}>{span.source_caption}</Text>
      <Text style={[styles.spanTranslation, targetLanguage.rtl ? styles.rtlText : styles.ltrText]}>
        {getDiagnosticSpanTranslationText(span)}
      </Text>
      <TranslationReportActions live={live} span={span} />
    </View>
  );
}

function getDiagnosticSpanTranslationText(span: TranslationSpan): string {
  return span.committed_translated_caption || span.partial_translated_caption || span.status;
}

function Metric({ direction, label, value, valueDirection }: {
  direction: "ltr" | "rtl";
  label: string;
  value: string;
  valueDirection: "ltr" | "rtl";
}): ReactNode {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, uiTextDirectionStyle(direction)]}>{label}</Text>
      <Text style={[styles.metricValue, uiTextDirectionStyle(valueDirection)]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function LatencyRow({ direction, label, value }: {
  direction: "ltr" | "rtl";
  label: string;
  value: string;
}): ReactNode {
  return (
    <View style={styles.latencyRow}>
      <Text style={[styles.latencyLabel, uiTextDirectionStyle(direction)]}>{label}</Text>
      <Text style={[styles.latencyValue, uiTextDirectionStyle("ltr")]}>{value}</Text>
    </View>
  );
}
