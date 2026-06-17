import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

import type { AudioStateEvent } from "../../modules/murmur-audio";
import {
  buildLatencyEvidenceReport,
  type DebugLogEntry,
  type DiagnosticJsonValue,
  formatLatencyEvidenceReport,
} from "../../lib/latency";
import type { LatencySample } from "../../lib/latency";
import type { LanguageCode, SourceLanguageCode } from "../../lib/languages";
import type { TranslationSession, TranslationSpan } from "../../lib/session";
import type { LiveTranslationDiagnosticsSnapshot } from "../../lib/useLiveTranslation";

export type DiagnosticsReportParams = {
  appSessionId: string;
  audioState: AudioStateEvent | null;
  debugLog: DebugLogEntry[];
  diagnosticsSnapshot: LiveTranslationDiagnosticsSnapshot;
  error: string | null;
  networkType: string;
  providerRoute: string;
  samples: LatencySample[];
  session: TranslationSession;
  spans: TranslationSpan[];
  sourceLanguage: SourceLanguageCode;
  status: string;
  targetLanguage: LanguageCode;
};

function buildDiagnosticsReportText(params: DiagnosticsReportParams): string {
  const spansByStatus = params.spans.reduce<Record<string, number>>((counts, span) => {
    counts[span.status] = (counts[span.status] ?? 0) + 1;
    return counts;
  }, {});
  const oldestInFlightMs = Math.max(
    0,
    ...params.diagnosticsSnapshot.translation_scheduler.in_flight.map((item) => item.active_ms ?? 0),
  );
  const report = buildLatencyEvidenceReport({
    metadata: {
      app_session_id: params.appSessionId || undefined,
      device_class: Platform.OS === "android" || Platform.OS === "ios" ? "real-device-required" : "unknown",
      network_type: params.networkType,
      platform: Platform.OS,
      provider_route: params.providerRoute,
      source_language: params.sourceLanguage,
      target_language: params.targetLanguage,
    },
    samples: params.samples,
    debugLog: params.debugLog,
    diagnostics: {
      summary: {
        audio_capture_active: params.audioState?.capture_active ?? null,
        audio_playback_active: params.audioState?.playback_active ?? null,
        debug_log_count: params.debugLog.length,
        error: params.error,
        oldest_in_flight_translation_ms: oldestInFlightMs,
        queued_translation_count: params.diagnosticsSnapshot.translation_scheduler.counts.queued,
        in_flight_translation_count: params.diagnosticsSnapshot.translation_scheduler.counts.in_flight,
        span_count: params.spans.length,
        spans_by_status: spansByStatus,
        status: params.status,
        translation_mode: params.session.translation_mode,
        translation_route: params.session.translation_model_route ?? "worker_default",
      },
      audio_state: toDiagnosticJson(params.audioState),
      runtime: toDiagnosticJson(params.diagnosticsSnapshot),
      session: toDiagnosticJson(params.session),
      spans: params.spans.map((span) => toDiagnosticJson(span)),
    },
  });
  return formatLatencyEvidenceReport(report);
}

export async function copyDiagnosticsReport(params: DiagnosticsReportParams): Promise<void> {
  const reportText = buildDiagnosticsReportText(params);
  if (Platform.OS === "web" && globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(reportText);
    return;
  }
  await Share.share({
    message: reportText,
    title: "Murmur diagnostics",
  });
}

export type DiagnosticsDownloadResult = "native_shared" | "unavailable" | "web_downloaded";

export async function downloadDiagnosticsReport(params: DiagnosticsReportParams): Promise<DiagnosticsDownloadResult> {
  if (Platform.OS !== "web") {
    const fileUri = await writeDiagnosticsReportFile(params);
    if (!fileUri || !(await Sharing.isAvailableAsync())) {
      return "unavailable";
    }
    await Sharing.shareAsync(fileUri, {
      dialogTitle: "Share Murmur diagnostics",
      mimeType: "text/plain",
      UTI: "public.plain-text",
    });
    return "native_shared";
  }

  if (typeof document === "undefined") {
    return "unavailable";
  }

  const reportText = buildDiagnosticsReportText(params);
  const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = createDiagnosticsReportFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return "web_downloaded";
}

export async function shareLatencyReport(params: DiagnosticsReportParams): Promise<"native_file" | "shared_text"> {
  if (Platform.OS !== "web") {
    const fileUri = await writeDiagnosticsReportFile(params);
    if (fileUri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(fileUri, {
        dialogTitle: "Share Murmur diagnostics",
        mimeType: "text/plain",
        UTI: "public.plain-text",
      });
      return "native_file";
    }
  }

  await Share.share({
    message: buildDiagnosticsReportText(params),
    title: "Murmur latency evidence",
  });
  return "shared_text";
}

function toDiagnosticJson(value: unknown): DiagnosticJsonValue {
  if (typeof value === "undefined") {
    return null;
  }
  return JSON.parse(JSON.stringify(value)) as DiagnosticJsonValue;
}

function createDiagnosticsReportFilename(): string {
  return `murmur-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
}

async function writeDiagnosticsReportFile(params: DiagnosticsReportParams): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  const reportFile = new File(Paths.cache, createDiagnosticsReportFilename());
  reportFile.write(buildDiagnosticsReportText(params), { encoding: "utf8" });
  return reportFile.uri;
}
