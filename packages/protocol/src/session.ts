import type { LanguageCode, SourceLanguageCode } from "./languages";

export type SessionState =
  | "idle"
  | "requesting_mic_permission"
  | "creating_session"
  | "connecting_realtime"
  | "live"
  | "network_degraded"
  | "transport_disconnected"
  | "recovering"
  | "stopping"
  | "cancelling"
  | "failed"
  | "ended";

export type SpanStatus = "translating" | "committed" | "failed";

export type SessionIdentity = {
  app_session_id: string;
  audio_generation_id: number;
  connection_id: string;
  event_seq: number;
  session_epoch: number;
};

export type TranslationSession = {
  created_at_ms: number;
  identity: SessionIdentity;
  source_language: SourceLanguageCode;
  state: SessionState;
  target_language: LanguageCode;
};

export type TranslationSpan = {
  committed_translated_caption: string | null;
  created_at_ms: number;
  partial_translated_caption: string | null;
  provider_metadata: Record<string, unknown> | null;
  revision: number;
  source_caption: string;
  span_id: string;
  status: SpanStatus;
  translated_caption: string;
  updated_at_ms: number;
};

export function createSession(params: {
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
}): TranslationSession {
  return {
    created_at_ms: Date.now(),
    identity: {
      app_session_id: createId("session"),
      audio_generation_id: 0,
      connection_id: createId("connection"),
      event_seq: 0,
      session_epoch: 1,
    },
    source_language: params.source_language,
    state: "idle",
    target_language: params.target_language,
  };
}

export function createSpan(sourceCaption = ""): TranslationSpan {
  const now = Date.now();
  return {
    committed_translated_caption: null,
    created_at_ms: now,
    partial_translated_caption: null,
    provider_metadata: null,
    revision: 1,
    source_caption: sourceCaption,
    span_id: createId("span"),
    status: "translating",
    translated_caption: "",
    updated_at_ms: now,
  };
}

export function canStartSession(status: SessionState): boolean {
  return status === "idle" || status === "ended" || status === "failed";
}

export function isActiveOrRecoveringSession(status: SessionState): boolean {
  return [
    "requesting_mic_permission",
    "creating_session",
    "connecting_realtime",
    "live",
    "network_degraded",
    "transport_disconnected",
    "recovering",
    "stopping",
  ].includes(status);
}

export function createConnectionId(): string {
  return createId("connection");
}

function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
