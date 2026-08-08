import type { LanguageCode, SourceLanguageCode } from "../languages";

export type CreateSessionResponse = {
  app_session_id: string;
  limits: {
    expires_at_ms: number;
    max_session_seconds: number;
  };
  realtime_ws_url: string;
  session_epoch: number;
};

export type RealtimeClientCommand = {
  kind: "close_session";
};

export type RealtimeServerEvent =
  | {
      kind: "session_opened";
      provider_metadata: Record<string, unknown>;
    }
  | {
      delta: string;
      kind: "source_delta";
    }
  | {
      delta: string;
      kind: "translation_delta";
    }
  | {
      kind: "session_closed";
    }
  | {
      code: string;
      kind: "session_error";
      retryable: boolean;
    };

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
  source_language: SourceLanguageCode;
  span_id: string;
  target_language: LanguageCode;
};

export type ReportTranslationResponse = {
  created_at_ms: number;
  ok: true;
  report_id: string;
  retained_text_snapshot: boolean;
};
