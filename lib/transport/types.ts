import type { LanguageCode, SourceLanguageCode } from "../languages";
import type { StableSpanContext } from "../session";

export type TranslationMode = "continuous" | "phrase";

export type SessionSummary = {
  memory_version: number;
  source_char_count_summarized: number;
  text: string;
  updated_at_ms: number;
  updated_through_span_id: string | null;
};

export type RollingMemorySpan = {
  committed_at_ms: number;
  revision: number;
  source_caption: string;
  source_char_count: number;
  span_id: string;
  translated_caption: string;
};

export type ProviderTokenBundle = {
  cartesia_access_token: string | null;
  deepgram_token: string | null;
  expires_at_ms: number;
  token_bundle_id: string;
};

export type CreateSessionRequest = {
  app_install_id: string;
  device_integrity?: {
    available: boolean;
    key_id?: string;
    kind?: string;
    nonce?: string;
    platform: string;
    provider?: string;
    reason?: string;
    token?: string;
  };
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
  translation_mode?: TranslationMode;
};

export type CreateSessionResponse = {
  app_session_id: string;
  limits?: {
    max_chars_per_span: number;
    max_session_seconds: number;
    translated_spans_per_minute: number;
  };
  session_epoch: number;
  speech?: {
    default_voice_id: string | null;
    enabled: boolean;
  };
  tokens: ProviderTokenBundle;
  deepgram_ws_url: string;
  translate_ws_url: string;
  translation_mode?: TranslationMode;
};

export type RefreshSessionTokenResponse = {
  app_session_id: string;
  session_epoch: number;
  speech?: {
    default_voice_id: string | null;
    enabled: boolean;
  };
  tokens: ProviderTokenBundle;
  deepgram_ws_url?: string;
};

export type TranslationRequest = {
  app_session_id: string;
  connection_id: string;
  context_spans: StableSpanContext[];
  context_summary?: string | null;
  event_seq: number;
  revision: number;
  session_epoch: number;
  source_language: SourceLanguageCode;
  span_id: string;
  source_caption: string;
  target_language: LanguageCode;
  translation_mode?: TranslationMode;
  translation_attempt: number;
};

export type TranslationDelta = {
  app_session_id: string;
  kind: "translation_delta";
  session_epoch: number;
  connection_id?: string;
  draft_text?: string;
  partial_seq?: number;
  revision: number;
  server_event_seq?: number;
  span_id: string;
  translation_request_id: string;
  delta: string;
};

export type TranslationDone = {
  app_session_id: string;
  kind: "translation_done";
  session_epoch: number;
  connection_id?: string;
  revision: number;
  server_event_seq?: number;
  span_id: string;
  translation_request_id: string;
  translated_caption: string;
  provider_metadata: Record<string, unknown>;
};

export type TranslationError = {
  app_session_id: string;
  kind: "translation_error";
  session_epoch: number;
  connection_id?: string;
  revision: number;
  server_event_seq?: number;
  span_id: string;
  translation_request_id: string | null;
  error_code: string;
  retryable: boolean;
};

export type TranslationServerEvent =
  | TranslationDelta
  | TranslationDone
  | TranslationError;

export type ReportTranslationCategory =
  | "inaccurate"
  | "offensive_harmful"
  | "wrong_language"
  | "speech_issue"
  | "other";

export type ReportTranslationRequest = {
  app_session_id: string;
  error_category: ReportTranslationCategory;
  optional_source_text_snapshot?: string;
  optional_translated_text_snapshot?: string;
  optional_user_note?: string;
  provider_metadata?: Record<string, unknown>;
  revision: number;
  source_language: string;
  span_id: string;
  target_language: string;
};

export type ReportTranslationResponse = {
  created_at_ms: number;
  ok: true;
  report_id: string;
  retained_text_snapshot: boolean;
};

export type SummaryRequest = {
  app_session_id: string;
  input_memory_version: number;
  previous_summary: SessionSummary;
  session_epoch: number;
  source_language: SourceLanguageCode;
  spans_to_summarize: RollingMemorySpan[];
  summary_job_id: string;
  target_language: LanguageCode;
};

export type SummaryResponse =
  | {
      input_memory_version: number;
      ok: true;
      session_epoch: number;
      summary: SessionSummary;
      summary_job_id: string;
    }
  | {
      error: string;
      retryable: boolean;
    };
