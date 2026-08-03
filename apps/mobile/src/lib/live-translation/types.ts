import type { AcquisitionContext } from "@murmur/protocol/acquisition";
import type { DebugLogEntry, LatencyReport, LatencySample } from "../latency";
import type { SessionState, TranslationSession, TranslationSpan } from "@murmur/protocol/session";
import type {
  ReportTranslationCategory,
  TranslationMode,
  TranslationModelRoute,
} from "@murmur/protocol/transport/types";
import type { ContinuousTranslationSchedulerSnapshot } from "../continuousTranslationScheduler";
import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";

export type LiveTranslationParams = {
  acquisition?: AcquisitionContext;
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
  translation_model_route?: TranslationModelRoute;
  translation_mode?: TranslationMode;
  ultravox_vad_enabled?: boolean;
};

export type LiveTranslationDiagnosticsSnapshot = {
  continuous_memory: {
    memory_version: number;
    rolling_source_char_count: number;
    rolling_span_count: number;
    summary_job_running: boolean;
    summary_length: number;
    summary_updated_through_span_id: string | null;
  };
  runtime: {
    last_committed_source_caption: string | null;
    pending_wait_prefix: string | null;
    tentative_source_caption: string;
    translation_socket_open: boolean;
  };
  translation_scheduler: ContinuousTranslationSchedulerSnapshot;
};

export type LiveTranslationState = {
  error: string | null;
  debug_log: DebugLogEntry[];
  latency_report: LatencyReport;
  latency_samples: LatencySample[];
  diagnostics_snapshot: LiveTranslationDiagnosticsSnapshot;
  report_error: string | null;
  report_receipt_id: string | null;
  session: TranslationSession;
  spans: TranslationSpan[];
  status: SessionState;
  tentative_source_caption: string;
};

export type LiveTranslationController = LiveTranslationState & {
  cancel: () => Promise<void>;
  reportSpan: (
    span: TranslationSpan,
    category: ReportTranslationCategory,
    includeSnapshots?: boolean,
  ) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};
