import type { LanguageCode, SourceLanguageCode } from "./languages";
import type { TranslationMode, TranslationModelRoute } from "./transport/types";

export type SessionState =
  | "idle"
  | "requesting_mic_permission"
  | "creating_session"
  | "connecting_deepgram"
  | "connecting_translate_ws"
  | "live"
  | "network_degraded"
  | "transport_disconnected"
  | "recovering"
  | "stopping"
  | "cancelling"
  | "failed"
  | "ended";

export type SpanStatus =
  | "tentative"
  | "stable"
  | "translating"
  | "committed"
  | "superseded"
  | "failed";

export type SpeechStatus =
  | "idle"
  | "queued"
  | "generating"
  | "buffering"
  | "playing"
  | "complete"
  | "cancelled"
  | "speech_unavailable";

export type SessionIdentity = {
  app_session_id: string;
  audio_generation_id: number;
  connection_id: string;
  event_seq: number;
  session_epoch: number;
  token_bundle_id: string | null;
};

export type TranslationSession = {
  created_at_ms: number;
  identity: SessionIdentity;
  source_language: SourceLanguageCode;
  state: SessionState;
  target_language: LanguageCode;
  translation_model_route?: TranslationModelRoute;
  translation_mode: TranslationMode;
};

export type SessionScopedEvent = {
  app_session_id?: string;
  connection_id?: string | null;
  session_epoch?: number;
};

export type StableSpanContext = {
  span_id: string;
  source_caption: string;
  translated_caption: string | null;
};

export type TranslationSpan = {
  created_at_ms: number;
  provider_metadata: Record<string, unknown> | null;
  revision: number;
  committed_translated_caption: string | null;
  partial_translated_caption: string | null;
  source_caption: string;
  source_status: "final" | "stable" | null;
  span_id: string;
  speech_attempt: number;
  speech_request_id: string | null;
  speech_status: SpeechStatus;
  status: SpanStatus;
  supersedes_span_ids: string[];
  translated_caption: string;
  translation_attempt: number;
  translation_client_request_id: string | null;
  translation_request_id: string | null;
  updated_at_ms: number;
};

export function createSession(params: {
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
  translation_model_route?: TranslationModelRoute;
  translation_mode?: TranslationMode;
}): TranslationSession {
  const createdAt = Date.now();
  return {
    created_at_ms: createdAt,
    identity: {
      app_session_id: createId("session"),
      audio_generation_id: 0,
      connection_id: createId("connection"),
      event_seq: 0,
      session_epoch: 1,
      token_bundle_id: null,
    },
    source_language: params.source_language,
    state: "idle",
    target_language: params.target_language,
    translation_model_route: params.translation_model_route,
    translation_mode: params.translation_mode ?? "phrase",
  };
}

export function createSpan(sourceCaption: string): TranslationSpan {
  const now = Date.now();
  return {
    created_at_ms: now,
    provider_metadata: null,
    revision: 1,
    committed_translated_caption: null,
    partial_translated_caption: null,
    source_caption: sourceCaption,
    source_status: null,
    span_id: createId("span"),
    speech_attempt: 0,
    speech_request_id: null,
    speech_status: "idle",
    status: "stable",
    supersedes_span_ids: [],
    translated_caption: "",
    translation_attempt: 0,
    translation_client_request_id: null,
    translation_request_id: null,
    updated_at_ms: now,
  };
}

export function selectContextSpans(spans: TranslationSpan[]): StableSpanContext[] {
  return spans
    .filter((span) => span.status === "committed" && span.source_caption.trim())
    .slice(-10)
    .map((span) => ({
      span_id: span.span_id,
      source_caption: span.source_caption,
      translated_caption: span.translated_caption || null,
    }));
}

export function canStartSession(status: SessionState): boolean {
  return status === "idle" || status === "ended" || status === "failed";
}

export function isActiveOrRecoveringSession(status: SessionState): boolean {
  return [
    "requesting_mic_permission",
    "creating_session",
    "connecting_deepgram",
    "connecting_translate_ws",
    "live",
    "network_degraded",
    "transport_disconnected",
    "recovering",
    "stopping",
  ].includes(status);
}

export function shouldAcceptTranslationEvent(
  session: TranslationSession,
  event: SessionScopedEvent,
): boolean {
  if (session.state !== "live" && session.state !== "stopping") {
    return false;
  }
  return (
    event.app_session_id === session.identity.app_session_id &&
    (!event.connection_id || event.connection_id === session.identity.connection_id) &&
    event.session_epoch === session.identity.session_epoch
  );
}

export function shouldAcceptDeepgramEvent(status: SessionState): boolean {
  return status === "connecting_deepgram" || status === "connecting_translate_ws" || status === "live";
}

export function nextEventSeq(session: TranslationSession): TranslationSession {
  return {
    ...session,
    identity: {
      ...session.identity,
      event_seq: session.identity.event_seq + 1,
    },
  };
}

export function createConnectionId(): string {
  return createId("connection");
}

function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
