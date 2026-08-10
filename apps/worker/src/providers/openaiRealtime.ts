import type { LanguageCode } from "@murmur/protocol/languages";
import type { RealtimeServerEvent } from "@murmur/protocol/transport/types";

import type { WorkerWebSocket } from "../http/response";

const defaultOpenAIRealtimeModel = "gpt-realtime-translate";

export type OpenAITranslationOutput =
  | { kind: "audio"; pcm16: ArrayBuffer }
  | { event: RealtimeServerEvent; kind: "event" }
  | { kind: "ignored" };

export async function openTranslationSocket(params: {
  apiKey: string;
  model?: string;
  safetyIdentifier: string;
}): Promise<WorkerWebSocket> {
  const model = params.model ?? defaultOpenAIRealtimeModel;
  const url = new URL("https://api.openai.com/v1/realtime/translations");
  url.searchParams.set("model", model);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "OpenAI-Safety-Identifier": params.safetyIdentifier,
      Upgrade: "websocket",
    },
  });
  const socket = (response as Response & { webSocket?: WorkerWebSocket }).webSocket;
  if (!socket) {
    throw new Error(`openai_realtime_handshake_${response.status}`);
  }
  socket.accept();
  return socket;
}

export function createSessionUpdate(targetLanguage: LanguageCode): string {
  return JSON.stringify({
    type: "session.update",
    session: {
      audio: {
        input: {
          transcription: {
            model: "gpt-realtime-whisper",
          },
        },
        output: {
          language: toOpenAILanguage(targetLanguage),
        },
      },
    },
  });
}

export function createInputAudioMessage(pcm16: ArrayBuffer): string {
  return JSON.stringify({
    type: "session.input_audio_buffer.append",
    audio: encodeBase64(pcm16),
  });
}

export function createCloseMessage(): string {
  return JSON.stringify({ type: "session.close" });
}

export function parseTranslationOutput(data: unknown): OpenAITranslationOutput {
  if (typeof data !== "string") {
    return { kind: "ignored" };
  }
  const parsed = parseJson(data);
  if (!parsed || typeof parsed.type !== "string") {
    return { kind: "ignored" };
  }
  if (parsed.type === "session.input_transcript.delta" && typeof parsed.delta === "string") {
    return {
      kind: "event",
      event: transcriptEvent("source_delta", parsed),
    };
  }
  if (parsed.type === "session.output_transcript.delta" && typeof parsed.delta === "string") {
    return {
      kind: "event",
      event: transcriptEvent("translation_delta", parsed),
    };
  }
  if (parsed.type === "session.output_audio.delta" && typeof parsed.delta === "string") {
    return { kind: "audio", pcm16: decodeBase64(parsed.delta) };
  }
  if (parsed.type === "session.created" || parsed.type === "session.updated") {
    return {
      kind: "event",
      event: providerSessionConfig(
        parsed.type === "session.created" ? "created" : "updated",
        parsed.session,
      ),
    };
  }
  if (parsed.type === "session.closed") {
    return { kind: "event", event: { kind: "session_closed" } };
  }
  if (parsed.type === "error") {
    return {
      kind: "event",
      event: {
        code: parseProviderErrorCode(parsed.error),
        kind: "session_error",
        retryable: isRetryableProviderError(parsed.error),
      },
    };
  }
  return { kind: "ignored" };
}

function providerSessionConfig(
  phase: "created" | "updated",
  value: unknown,
): Extract<RealtimeServerEvent, { kind: "provider_session_config" }> {
  return {
    input_noise_reduction: nestedShortString(value, ["audio", "input", "noise_reduction", "type"]),
    kind: "provider_session_config",
    output_language: nestedShortString(value, ["audio", "output", "language"]),
    phase,
    provider_session_id: nestedShortString(value, ["id"]),
    transcription_model: nestedShortString(value, ["audio", "input", "transcription", "model"]),
  };
}

function transcriptEvent(
  kind: "source_delta" | "translation_delta",
  parsed: Record<string, unknown>,
): Extract<RealtimeServerEvent, { kind: "source_delta" | "translation_delta" }> {
  const event: Extract<RealtimeServerEvent, { kind: "source_delta" | "translation_delta" }> = {
    delta: parsed.delta as string,
    kind,
  };
  if (
    typeof parsed.elapsed_ms === "number" &&
    Number.isFinite(parsed.elapsed_ms) &&
    parsed.elapsed_ms >= 0
  ) {
    event.provider_elapsed_ms = parsed.elapsed_ms;
  }
  if (typeof parsed.event_id === "string" && parsed.event_id.length <= 512) {
    event.provider_event_id = parsed.event_id;
  }
  return event;
}

function toOpenAILanguage(language: LanguageCode): string {
  if (language === "pt-BR") {
    return "pt";
  }
  if (language === "zh-Hans") {
    return "zh";
  }
  return language;
}

function parseProviderErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "provider_error";
  }
  const code = (error as Record<string, unknown>).code;
  return typeof code === "string" && code.length <= 80 ? code : "provider_error";
}

function isRetryableProviderError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as Record<string, unknown>).code;
  return code === "server_error" || code === "rate_limit_exceeded";
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function shortString(value: unknown): string | null {
  return typeof value === "string" && value.length <= 512 ? value : null;
}

function nestedShortString(value: unknown, keys: string[]): string | null {
  let current = value;
  for (const key of keys) {
    const parent = record(current);
    if (!parent) {
      return null;
    }
    current = parent[key];
  }
  return shortString(current);
}

function encodeBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}
