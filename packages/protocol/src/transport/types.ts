import type { LanguageCode, SourceLanguageCode } from "../languages";
import type { AcquisitionContext } from "../acquisition";

export type AppConfigResponse = {
  enabled_languages: LanguageCode[] | null;
  low_balance_threshold_minutes: number;
  min_app_version_android: string | null;
  min_app_version_ios: string | null;
  paywall_offering_id: string | null;
  personal_offer: { offering_id: string; expires_at: string } | null;
  sessions_disabled_message: string;
  sessions_enabled: boolean;
};

export type CreateSessionRequest = {
  acquisition?: AcquisitionContext;
  analytics_enabled: boolean;
  app_install_id: string;
  app_platform?: "android" | "ios";
  app_version?: string;
  capture_source?: "microphone" | "phone_audio";
  device_integrity?: {
    available: boolean;
    key_id?: string;
    kind?: string;
    nonce?: string;
    platform: string | null;
    provider?: string | null;
    token?: string;
  };
  playback_enabled?: boolean;
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
};

export type CreateSessionResponse = {
  app_session_id: string;
  features: {
    source_transcript: boolean;
  };
  limits: {
    expires_at_ms: number;
    max_session_seconds: number;
  };
  realtime_ws_url: string;
  session_epoch: number;
};

export type RealtimeClientCommand =
  | { kind: "close_session" }
  | { enabled: boolean; kind: "set_playback" };

export type RealtimeServerEvent =
  | {
      kind: "session_opened";
      provider_metadata: Record<string, unknown>;
    }
  | {
      delta: string;
      kind: "source_delta";
      provider_elapsed_ms?: number;
      provider_event_id?: string;
    }
  | {
      delta: string;
      kind: "translation_delta";
      provider_elapsed_ms?: number;
      provider_event_id?: string;
    }
  | {
      bytes_received: number;
      chunk_seq: number;
      kind: "input_audio_ack";
      worker_received_at_ms: number;
    }
  | {
      input_noise_reduction: string | null;
      kind: "provider_session_config";
      output_language: string | null;
      phase: "created" | "updated";
      provider_session_id: string | null;
      transcription_model: string | null;
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
