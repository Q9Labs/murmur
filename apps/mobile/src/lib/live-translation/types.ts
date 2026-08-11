import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { SessionState, TranslationSession, TranslationSpan } from "@murmur/protocol/session";
import type { ReportTranslationCategory } from "@murmur/protocol/transport/types";
import type { AcquisitionContext } from "@murmur/protocol/acquisition";

import type { DebugLogEntry, LatencyReport, LatencySample } from "../latency";
import type { RealtimeTransportDiagnostics } from "../providers/realtimeTranslation";
import type { AudioCaptureDiagnostics } from "./audioDiagnostics";
import type { SessionPreparationStatus } from "./sessionPreparation";

export type LiveTranslationParams = {
  acquisition?: AcquisitionContext;
  playback_enabled: boolean;
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
};

export type LiveTranslationCompletion = {
  committed_caption_count: number;
  duration_ms: number;
  error: string | null;
};

export function createLiveTranslationCompletion(params: {
  completed_at_ms: number;
  error: string | null;
  span: TranslationSpan | null;
  started_at_ms: number;
  state: "ended" | "failed";
}): LiveTranslationCompletion {
  return {
    committed_caption_count:
      params.state === "ended" && Boolean(params.span?.committed_translated_caption?.trim())
        ? 1
        : 0,
    duration_ms: Math.max(0, params.completed_at_ms - params.started_at_ms),
    error: params.state === "failed" ? params.error ?? "session_failed" : params.error,
  };
}

export type LiveTranslationDiagnosticsSnapshot = {
  capture: AudioCaptureDiagnostics;
  runtime: {
    playback_enabled: boolean;
    realtime_socket_open: boolean;
    source_char_count: number;
    translated_char_count: number;
  };
  transport: RealtimeTransportDiagnostics;
};

export type LiveTranslationState = {
  debug_log: DebugLogEntry[];
  diagnostics_snapshot: LiveTranslationDiagnosticsSnapshot;
  error: string | null;
  latency_report: LatencyReport;
  latency_samples: LatencySample[];
  preparation_status: SessionPreparationStatus;
  report_error: string | null;
  report_receipt_id: string | null;
  session: TranslationSession;
  spans: TranslationSpan[];
  status: SessionState;
  tentative_source_caption: string;
};

export type LiveTranslationController = LiveTranslationState & {
  cancel: () => Promise<void>;
  getDiagnosticsSnapshot: () => LiveTranslationDiagnosticsSnapshot;
  invalidatePreparation: () => void;
  prepare: () => Promise<void>;
  reportSpan: (
    span: TranslationSpan,
    category: ReportTranslationCategory,
    includeSnapshots?: boolean,
  ) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<LiveTranslationCompletion | undefined>;
};
