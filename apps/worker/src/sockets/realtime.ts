/// <reference types="@cloudflare/workers-types" />

import { isLanguageCode, type LanguageCode } from "@murmur/protocol/languages";
import type { RealtimeClientCommand, RealtimeServerEvent } from "@murmur/protocol/transport/types";

import { type Env, getRealtimeApiKey } from "../env";
import {
  closeSocket,
  send,
  type WorkerResponseInit,
  type WorkerWebSocket,
} from "../http/response";
import {
  createCloseMessage,
  createInputAudioMessage,
  createSessionUpdate,
  openTranslationSocket,
  parseTranslationOutput,
} from "../providers/openaiRealtime";
import {
  closeSessionDurable,
  reserveRealtimeSessionDurable,
} from "../rateLimitDurableObject";

declare const WebSocketPair: {
  new (): { 0: WorkerWebSocket; 1: WorkerWebSocket };
};

const maxAudioFrameBytes = 64 * 1024;

export function connectRealtimeSocket(request: Request, env: Env): Response {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  server.binaryType = "arraybuffer";
  void proxyRealtimeSession(request, server, env);
  return new Response(null, {
    status: 101,
    webSocket: client,
  } as WorkerResponseInit);
}

export async function proxyRealtimeSession(
  request: Request,
  client: WorkerWebSocket,
  env: Env,
): Promise<void> {
  const url = new URL(request.url);
  const appSessionId = url.searchParams.get("app_session_id") ?? "";
  const targetLanguage = url.searchParams.get("target_language") ?? "";
  const validated = await validateSession(appSessionId, targetLanguage, env);
  if (!validated.ok) {
    closeSocket(client, validated.code, validated.reason);
    return;
  }

  let upstream: WorkerWebSocket;
  try {
    upstream = await openTranslationSocket({
      apiKey: validated.apiKey,
      model: env.OPENAI_REALTIME_MODEL,
      safetyIdentifier: validated.safetyIdentifier,
    });
  } catch {
    await closeRealtimeSession(appSessionId, env);
    sendSessionError(client, "provider_connection_failed", true);
    closeSocket(client, 1011, "provider_connection_failed");
    return;
  }

  if (client.readyState !== WebSocket.OPEN) {
    closeSocket(upstream, 1000, "client_gone");
    await closeRealtimeSession(appSessionId, env);
    return;
  }
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let sessionFinished = false;
  const finishSessionRecord = (): void => {
    if (sessionFinished) {
      return;
    }
    sessionFinished = true;
    if (deadlineTimer) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
    void closeRealtimeSession(appSessionId, env);
  };
  const remainingMs = Math.max(0, validated.expiresAtMs - Date.now());
  deadlineTimer = setTimeout(() => {
    sendSessionError(client, "session_expired", false);
    closeSocket(upstream, 1008, "session_expired");
    closeSocket(client, 1008, "session_expired");
    finishSessionRecord();
  }, remainingMs);
  bindClientEvents(client, upstream, finishSessionRecord);
  bindProviderEvents(client, upstream, finishSessionRecord);
  upstream.send(createSessionUpdate(validated.targetLanguage));
  send(client, {
    kind: "session_opened",
    provider_metadata: {
      model: env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-translate",
      provider: "openai",
    },
  });
}

async function validateSession(
  appSessionId: string,
  targetLanguage: string,
  env: Env,
): Promise<
  | {
      apiKey: string;
      expiresAtMs: number;
      ok: true;
      safetyIdentifier: string;
      targetLanguage: LanguageCode;
    }
  | { code: number; ok: false; reason: string }
> {
  if (!appSessionId || !isLanguageCode(targetLanguage)) {
    return { code: 1008, ok: false, reason: "invalid_realtime_request" };
  }
  const apiKey = getRealtimeApiKey(env);
  if (!apiKey) {
    return { code: 1011, ok: false, reason: "provider_unconfigured" };
  }
  const reservation = await reserveRealtimeSessionDurable({
    app_session_id: appSessionId,
    namespace: env.RATE_LIMITER,
    now_ms: Date.now(),
  });
  if (!reservation.ok) {
    return { code: 1008, ok: false, reason: reservation.code };
  }
  return {
    apiKey,
    expiresAtMs: reservation.expires_at_ms,
    ok: true,
    safetyIdentifier: reservation.hashed_install_id,
    targetLanguage,
  };
}

function bindClientEvents(
  client: WorkerWebSocket,
  upstream: WorkerWebSocket,
  finishSessionRecord: () => void,
): void {
  client.addEventListener("message", (event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      if (!isAcceptedAudioFrame(event.data.byteLength)) {
        sendSessionError(client, "audio_frame_too_large", false);
        return;
      }
      upstream.send(createInputAudioMessage(event.data));
      return;
    }
    if (event.data instanceof Blob) {
      if (!isAcceptedAudioFrame(event.data.size)) {
        sendSessionError(client, "audio_frame_too_large", false);
        return;
      }
      void event.data.arrayBuffer().then((audio) => {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(createInputAudioMessage(audio));
        }
      });
      return;
    }
    const command = parseClientCommand(event.data);
    if (command?.kind === "close_session") {
      upstream.send(createCloseMessage());
    }
  });
  client.addEventListener("close", () => {
    closeSocket(upstream, 1000, "client_close");
    finishSessionRecord();
  });
  client.addEventListener("error", () => {
    closeSocket(upstream, 1011, "client_error");
    finishSessionRecord();
  });
}

function bindProviderEvents(
  client: WorkerWebSocket,
  upstream: WorkerWebSocket,
  finishSessionRecord: () => void,
): void {
  let sessionClosedCleanly = false;
  upstream.addEventListener("message", (event: MessageEvent) => {
    const output = parseTranslationOutput(event.data);
    if (output.kind === "audio") {
      if (client.readyState === WebSocket.OPEN) {
        client.send(output.pcm16);
      }
      return;
    }
    if (output.kind === "event") {
      send(client, output.event);
      if (output.event.kind === "session_closed") {
        sessionClosedCleanly = true;
        closeSocket(client, 1000, "session_closed");
        finishSessionRecord();
      }
    }
  });
  upstream.addEventListener("close", () => {
    if (sessionClosedCleanly) {
      closeSocket(client, 1000, "session_closed");
    } else {
      sendSessionError(client, "provider_transport_closed", true);
      closeSocket(client, 1011, "provider_transport_closed");
    }
    finishSessionRecord();
  });
  upstream.addEventListener("error", () => {
    sendSessionError(client, "provider_transport_error", true);
    closeSocket(client, 1011, "provider_transport_error");
    finishSessionRecord();
  });
}

async function closeRealtimeSession(appSessionId: string, env: Env): Promise<void> {
  await closeSessionDurable({
    app_session_id: appSessionId,
    namespace: env.RATE_LIMITER,
    now_ms: Date.now(),
  });
}

export function isAcceptedAudioFrame(byteLength: number): boolean {
  return Number.isInteger(byteLength) &&
    byteLength > 0 &&
    byteLength <= maxAudioFrameBytes;
}

export function parseClientCommand(value: unknown): RealtimeClientCommand | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed.kind === "close_session" ? { kind: "close_session" } : null;
  } catch {
    return null;
  }
}

function sendSessionError(
  socket: WorkerWebSocket,
  code: string,
  retryable: boolean,
): void {
  const event: RealtimeServerEvent = {
    code,
    kind: "session_error",
    retryable,
  };
  send(socket, event);
}
