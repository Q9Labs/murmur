/// <reference types="@cloudflare/workers-types" />

import { defaultTranslationModelRoute } from "@murmur/protocol/translationModelRoutes";
import type { TranslationRequest } from "@murmur/protocol/transport/types";
import type { Env } from "../env";
import {
  abortAll,
  send,
  type WorkerResponseInit,
  type WorkerWebSocket,
} from "../http/response";
import { logWorkerEvent } from "../privacy";
import {
  beginTranslationDurable,
  closeSessionDurable,
  endTranslationDurable,
} from "../rateLimitDurableObject";
import { getTranslationErrorCode } from "../translation/errors";
import { streamProviderTranslation } from "../translation/streaming";
import {
  validateTranslationModelRouteForEnv,
  validateTranslationRequest,
} from "../translation/validation";

declare const WebSocketPair: {
  new (): { 0: WorkerWebSocket; 1: WorkerWebSocket };
};

type ClientMessage =
  | ({ kind: "translate" } & TranslationRequest)
  | {
      kind: "cancel_translation";
      translation_request_id?: string;
      span_id?: string;
      revision?: number;
    }
  | {
      kind: "stop_session" | "cancel_session";
      app_session_id?: string;
      reason?: string;
    };

export function connectTranslateSocket(_request: Request, env: Env): Response {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  const requests = new Map<string, AbortController>();

  server.accept();
  server.addEventListener("message", (event: MessageEvent) => {
    void handleSocketMessage(event.data, server, env, requests);
  });
  server.addEventListener("close", () => {
    abortAll(requests);
  });
  server.addEventListener("error", () => {
    abortAll(requests);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  } as WorkerResponseInit);
}

export async function handleSocketMessage(
  raw: string | ArrayBuffer,
  socket: WorkerWebSocket,
  env: Env,
  requests: Map<string, AbortController>,
): Promise<void> {
  const message = parseClientMessage(raw);
  if (!message) {
    send(socket, { kind: "translation_error", error_code: "invalid_message", retryable: false });
    return;
  }

  if (message.kind === "stop_session" || message.kind === "cancel_session") {
    abortAll(requests);
    if (typeof message.app_session_id === "string" && message.app_session_id.length > 0) {
      await closeSessionDurable({
        app_session_id: message.app_session_id,
        namespace: env.RATE_LIMITER,
        now_ms: Date.now(),
      });
    }
    send(socket, { kind: "session_stopped", reason: message.reason ?? message.kind });
    socket.close(1000, message.kind);
    return;
  }

  if (message.kind === "cancel_translation") {
    for (const [requestId, controller] of requests) {
      if (!message.translation_request_id || message.translation_request_id === requestId) {
        controller.abort();
        requests.delete(requestId);
      }
    }
    return;
  }

  if (message.kind !== "translate") {
    send(socket, { kind: "translation_error", error_code: "invalid_message_kind", retryable: false });
    return;
  }

  const validationError = validateTranslationRequest(message);
  if (validationError) {
    send(socket, {
      app_session_id: message.app_session_id,
      client_request_id: getClientRequestId(message),
      kind: "translation_error",
      session_epoch: message.session_epoch,
      span_id: message.span_id,
      revision: message.revision,
      translation_request_id: null,
      error_code: validationError,
      retryable: false,
    });
    return;
  }
  const routeError = validateTranslationModelRouteForEnv(message.translation_model_route, env);
  if (routeError) {
    send(socket, {
      app_session_id: message.app_session_id,
      client_request_id: message.client_request_id,
      connection_id: message.connection_id,
      kind: "translation_error",
      session_epoch: message.session_epoch,
      span_id: message.span_id,
      revision: message.revision,
      translation_request_id: null,
      error_code: routeError,
      retryable: false,
    });
    return;
  }

  const translationRequestId = crypto.randomUUID();
  const controller = new AbortController();
  let serverEventSeq = 0;
  logWorkerEvent({
    event: "translation_started",
    app_session_id: message.app_session_id,
    attempt: message.translation_attempt,
    client_request_id: message.client_request_id ?? null,
    source_chars: message.source_caption.length,
    span_id: message.span_id,
    translation_route: message.translation_model_route ?? defaultTranslationModelRoute,
    translation_mode: message.translation_mode ?? "phrase",
    at_ms: Date.now(),
  });
  const limitResult = await beginTranslationDurable({
    app_session_id: message.app_session_id,
    namespace: env.RATE_LIMITER,
    now_ms: Date.now(),
    source_caption: message.source_caption,
  });
  if (!limitResult.ok) {
    send(socket, {
      app_session_id: message.app_session_id,
      client_request_id: message.client_request_id,
      connection_id: message.connection_id,
      kind: "translation_error",
      session_epoch: message.session_epoch,
      span_id: message.span_id,
      revision: message.revision,
      server_event_seq: ++serverEventSeq,
      translation_request_id: null,
      error_code: limitResult.code,
      retryable: limitResult.code !== "span_too_long",
    });
    return;
  }

  requests.set(translationRequestId, controller);

  try {
    await streamProviderTranslation(message, translationRequestId, socket, env, controller.signal, () => ++serverEventSeq);
  } catch (error) {
    if (!controller.signal.aborted) {
      const errorCode = getTranslationErrorCode(error);
      logWorkerEvent({
        event: "translation_failed",
        app_session_id: message.app_session_id,
        client_request_id: message.client_request_id ?? null,
        error_code: errorCode,
        retryable: true,
        span_id: message.span_id,
        translation_route: message.translation_model_route ?? defaultTranslationModelRoute,
        translation_request_id: translationRequestId,
        at_ms: Date.now(),
      });
      send(socket, {
        app_session_id: message.app_session_id,
        client_request_id: message.client_request_id,
        connection_id: message.connection_id,
        kind: "translation_error",
        session_epoch: message.session_epoch,
        span_id: message.span_id,
        revision: message.revision,
        server_event_seq: ++serverEventSeq,
        translation_request_id: translationRequestId,
        error_code: errorCode,
        retryable: true,
      });
    }
  } finally {
    await endTranslationDurable({
      app_session_id: message.app_session_id,
      namespace: env.RATE_LIMITER,
    });
    requests.delete(translationRequestId);
  }
}

function getClientRequestId(message: Partial<TranslationRequest>): string | undefined {
  return typeof message.client_request_id === "string" ? message.client_request_id : undefined;
}

function parseClientMessage(raw: string | ArrayBuffer): ClientMessage | null {
  if (typeof raw !== "string") {
    return null;
  }
  try {
    return JSON.parse(raw) as ClientMessage;
  } catch {
    return null;
  }
}
