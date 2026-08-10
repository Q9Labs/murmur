import { useState } from "react";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { AudioStateEvent } from "../../modules/murmur-audio";
import { formatLatencyPercentiles } from "../lib/latency";
import type { LanguageCode, LanguageDefinition, SourceLanguageCode } from "@murmur/protocol/languages";
import type { TranslationSpan } from "@murmur/protocol/session";
import type { LiveTranslationController } from "../lib/useLiveTranslation";
import type { ReportTranslationCategory } from "@murmur/protocol/transport/types";
import { copyDiagnosticsReport, downloadDiagnosticsReport, shareLatencyReport } from "./diagnostics";
import { ModalSheet } from "./modalSheet";
import { styles } from "./styles";

const reportActions = [
  { category: "inaccurate", label: "Inaccurate" },
  { category: "wrong_language", label: "Wrong language" },
  { category: "offensive_harmful", label: "Harmful" },
  { category: "speech_issue", label: "Speech" },
  { category: "other", label: "Other" },
] as const satisfies readonly {
  category: ReportTranslationCategory;
  label: string;
}[];

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
    <ModalSheet onClose={onClose} open={open} title="Diagnostics">
      <ScrollView contentContainerStyle={styles.diagnosticsContent}>
        <DiagnosticsMetrics audioState={audioState} live={live} />
        <DiagnosticsLatency live={live} />
        <DiagnosticActions
          getReportParams={getReportParams}
          hasReport={hasReport}
          setDiagnosticsMessage={setDiagnosticsMessage}
        />
        {diagnosticsMessage ? <Text style={styles.diagnosticsMessage}>{diagnosticsMessage}</Text> : null}
        <DiagnosticsTimeline live={live} targetLanguage={targetLanguage} />
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

function getDownloadMessage(result: string): string {
  if (result === "web_downloaded") {
    return "Diagnostics downloaded.";
  }
  if (result === "native_shared") {
    return "Diagnostics file ready to share.";
  }
  return "Diagnostics file could not be prepared.";
}

function DiagnosticsMetrics({
  audioState,
  live,
}: {
  audioState: AudioStateEvent | null;
  live: LiveTranslationController;
}): ReactNode {
  return (
    <View style={styles.metricsRow}>
      <Metric label="Session" value={live.status} />
      <Metric label="Spans" value={String(live.spans.length)} />
      <Metric label="Mic" value={formatBooleanState(audioState?.capture_active)} />
      <Metric label="Speech" value={formatBooleanState(audioState?.playback_active)} />
    </View>
  );
}

function formatBooleanState(active: boolean | undefined): string {
  return active ? "on" : "off";
}

function DiagnosticActions({
  getReportParams,
  hasReport,
  setDiagnosticsMessage,
}: {
  getReportParams: () => ReturnType<typeof buildDiagnosticsReportParams>;
  hasReport: boolean;
  setDiagnosticsMessage: (message: string | null) => void;
}): ReactNode {
  return (
    <View style={styles.diagnosticActions}>
      <Pressable
        accessibilityRole="button"
        disabled={!hasReport}
        onPress={() =>
          void copyDiagnosticsReport(getReportParams()).then(() => {
            setDiagnosticsMessage("Diagnostics copied.");
          })
        }
        style={[styles.diagnosticButton, !hasReport && styles.pressed]}
      >
        <Text style={styles.diagnosticButtonText}>Copy report</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={!hasReport}
        onPress={() =>
          void downloadDiagnosticsReport(getReportParams())
            .then((result) => {
              setDiagnosticsMessage(getDownloadMessage(result));
            })
            .catch(() => {
              setDiagnosticsMessage("Diagnostics file could not be prepared.");
            })
        }
        style={[styles.diagnosticButtonSecondary, !hasReport && styles.pressed]}
      >
        <Text style={styles.diagnosticButtonTextSecondary}>Download .txt</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={!hasReport}
        onPress={() =>
          void shareLatencyReport(getReportParams())
            .then((result) => {
              setDiagnosticsMessage(result === "native_file" ? "Diagnostics file shared." : "Diagnostics shared.");
            })
            .catch(() => {
              setDiagnosticsMessage("Diagnostics could not be shared.");
            })
        }
        style={[styles.diagnosticButtonSecondary, !hasReport && styles.pressed]}
      >
        <Text style={styles.diagnosticButtonTextSecondary}>Share</Text>
      </Pressable>
    </View>
  );
}

function DiagnosticsLatency({ live }: { live: LiveTranslationController }): ReactNode {
  return (
    <>
      <LatencyRow
        label="First source transcript"
        value={formatLatencyPercentiles(live.latency_report.first_source_transcript)}
      />
      <LatencyRow
        label="First translated transcript"
        value={formatLatencyPercentiles(live.latency_report.first_translated_transcript)}
      />
    </>
  );
}

function DiagnosticsTimeline({
  live,
  targetLanguage,
}: {
  live: LiveTranslationController;
  targetLanguage: LanguageDefinition;
}): ReactNode {
  return (
    <View style={styles.timeline}>
      {live.spans.length === 0 ? (
        <Text style={styles.timelineEmpty}>No spans yet</Text>
      ) : (
        [...live.spans].reverse().map((span) => (
          <DiagnosticSpanRow
            key={`${span.span_id}-${span.revision}`}
            live={live}
            span={span}
            targetLanguage={targetLanguage}
          />
        ))
      )}
    </View>
  );
}

function DiagnosticSpanRow({
  live,
  span,
  targetLanguage,
}: {
  live: LiveTranslationController;
  span: TranslationSpan;
  targetLanguage: LanguageDefinition;
}): ReactNode {
  return (
    <View style={styles.spanRow}>
      <Text style={styles.spanSource}>{span.source_caption}</Text>
      <Text style={[styles.spanTranslation, targetLanguage.rtl && styles.rtlText]}>
        {getDiagnosticSpanTranslationText(span)}
      </Text>
      <ReportActions live={live} span={span} />
    </View>
  );
}

function getDiagnosticSpanTranslationText(span: TranslationSpan): string {
  return span.committed_translated_caption || span.partial_translated_caption || span.status;
}

function ReportActions({
  live,
  span,
}: {
  live: LiveTranslationController;
  span: TranslationSpan;
}): ReactNode {
  if (span.status !== "committed") {
    return null;
  }
  return (
    <View style={styles.reportRow}>
      {reportActions.map((action) => (
        <Pressable
          accessibilityRole="button"
          key={action.category}
          onPress={() => void live.reportSpan(span, action.category)}
          style={styles.reportButton}
        >
          <Text style={styles.reportButtonText}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function LatencyRow({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <View style={styles.latencyRow}>
      <Text style={styles.latencyLabel}>{label}</Text>
      <Text style={styles.latencyValue}>{value}</Text>
    </View>
  );
}
