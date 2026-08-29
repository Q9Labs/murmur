/// <reference types="@cloudflare/workers-types" />

import { isLanguageCode, type LanguageCode } from "@murmur/protocol/languages";
import type { RealtimeClientCommand, RealtimeServerEvent } from "@murmur/protocol/transport/types";
import * as Sentry from "@sentry/cloudflare";

import { callCustomerLedger } from "../billing/customerLedgerDurableObject";
import {
  createRealtimeUsageMeter,
  type RealtimeUsageMeter,
} from "../billing/realtimeUsageMeter";
import { findOpenUsageSession } from "../billing/usageSessionStore";
import { type Env, getRealtimeApiKey, isBillingEnforced } from "../env";
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
import {
  queuePostHogEvent,
  type TelemetryExecutionContext,
  type WorkerTelemetryEvent,
} from "../observability/posthog";

declare const WebSocketPair: {
  new (): { 0: WorkerWebSocket; 1: WorkerWebSocket };
};

const maxAudioFrameBytes = 64 * 1024;

type SessionValidationFailure = { code: number; ok: false; reason: string };

type BillingSessionValidation =
  | { availableMs: number; customerId: string | null; ok: true }
  | SessionValidationFailure;

type RealtimeSessionValidation =
  | {
      apiKey: string;
      analyticsEnabled: boolean;
      availableMs: number;
      customerId: string | null;
      expiresAtMs: number;
      ok: true;
      safetyIdentifier: string;
      targetLanguage: LanguageCode;
    }
  | SessionValidationFailure;

export function connectRealtimeSocket(
  request: Request,
  env: Env,
  context?: TelemetryExecutionContext,
): Response {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  server.binaryType = "arraybuffer";
  void proxyRealtimeSession(request, server, env, context).catch((failure: unknown) => {
    Sentry.captureException(failure, {
      tags: { operation: "proxy_realtime_session" },
    });
    closeSocket(server, 1011, "worker_internal_error");
  });
  return new Response(null, {
    status: 101,
    webSocket: client,
  } as WorkerResponseInit);
}

export async function proxyRealtimeSession(
  request: Request,
  client: WorkerWebSocket,
  env: Env,
  context?: TelemetryExecutionContext,
): Promise<void> {
  const url = new URL(request.url);
  const appSessionId = url.searchParams.get("app_session_id") ?? "";
  const targetLanguage = url.searchParams.get("target_language") ?? "";
  const analyticsEnabled = url.searchParams.get("analytics_enabled") === "true";
  const realtimeStartedAtMs = Date.now();
  const validated = await validateSession(appSessionId, targetLanguage, analyticsEnabled, env);
  if (!validated.ok) {
    closeSocket(client, validated.code, validated.reason);
    return;
  }
  const usageMeter = validated.customerId
    ? createRealtimeUsageMeter({
        availableMs: validated.availableMs,
        customerId: validated.customerId,
        namespace: env.CUSTOMER_LEDGER,
        usageSessionId: appSessionId,
      })
    : null;

  const telemetry: RealtimeTelemetry = {
    analyticsEnabled: validated.analyticsEnabled,
    appSessionId,
    context,
    distinctId: `anonymous_install_${validated.safetyIdentifier}`,
    env,
    startedAtMs: realtimeStartedAtMs,
    stats: {
      failureCode: null,
      inputAudioBytes: 0,
      inputAudioChunks: 0,
      sourceReceived: false,
      translationReceived: false,
    },
  };
  let upstream: WorkerWebSocket;
  const providerConnectStartedAtMs = Date.now();
  try {
    upstream = await openTranslationSocket({
      apiKey: validated.apiKey,
      model: env.OPENAI_REALTIME_MODEL,
      safetyIdentifier: validated.safetyIdentifier,
    });
  } catch (failure) {
    Sentry.captureException(failure, {
      tags: { app_session_id: appSessionId, operation: "open_translation_socket" },
    });
    await closeMeteredRealtimeSession(appSessionId, "failed", usageMeter, env).catch((closeFailure: unknown) => {
      Sentry.captureException(closeFailure, {
        tags: { app_session_id: appSessionId, operation: "close_failed_realtime_session" },
      });
    });
    queueRealtimeTelemetry(telemetry, createSessionEndedEvent(
      telemetry,
      "failed",
      "provider_connection_failed",
    ));
    sendSessionError(client, "provider_connection_failed", true);
    closeSocket(client, 1011, "provider_connection_failed");
    return;
  }
  queueRealtimeTelemetry(telemetry, {
    app_session_id: appSessionId,
    event: "worker_realtime_opened",
    provider_connection_latency_ms: Math.max(0, Date.now() - providerConnectStartedAtMs),
    target_language: validated.targetLanguage,
  });

  if (client.readyState !== WebSocket.OPEN) {
    closeSocket(upstream, 1000, "client_gone");
    await closeMeteredRealtimeSession(appSessionId, "failed", usageMeter, env);
    queueRealtimeTelemetry(telemetry, createSessionEndedEvent(
      telemetry,
      "failed",
      "client_gone_before_open",
    ));
    return;
  }
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let settlementTimer: ReturnType<typeof setInterval> | null = null;
  let sessionFinished = false;
  const finishSessionRecord = (
    outcome: "completed" | "failed",
    failureCode: string | null = null,
  ): void => {
    if (sessionFinished) {
      return;
    }
    sessionFinished = true;
    if (deadlineTimer) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
    if (settlementTimer) {
      clearInterval(settlementTimer);
      settlementTimer = null;
    }
    const close = closeMeteredRealtimeSession(
      appSessionId,
      outcome === "completed" ? "closed" : "failed",
      usageMeter,
      env,
    ).catch((failure: unknown) => {
      Sentry.captureException(failure, {
        tags: { app_session_id: appSessionId, operation: "close_realtime_session_record" },
      });
    });
    if (context) {
      context.waitUntil(close);
    } else {
      void close;
    }
    queueRealtimeTelemetry(
      telemetry,
      createSessionEndedEvent(telemetry, outcome, failureCode ?? telemetry.stats.failureCode),
    );
  };
  const remainingMs = Math.max(0, validated.expiresAtMs - Date.now());
  deadlineTimer = setTimeout(() => {
    sendSessionError(client, "session_expired", false);
    closeSocket(upstream, 1008, "session_expired");
    closeSocket(client, 1008, "session_expired");
    finishSessionRecord("failed", "session_expired");
  }, remainingMs);
  if (usageMeter) {
    settlementTimer = setInterval(() => {
      void usageMeter.settle().then((settlement) => {
        if (!settlement.exhausted || sessionFinished) {
          return;
        }
        sendSessionError(client, "allowance_exhausted", false);
        closeSocket(upstream, 1008, "allowance_exhausted");
        closeSocket(client, 1008, "allowance_exhausted");
        finishSessionRecord("failed", "allowance_exhausted");
      }).catch((failure: unknown) => {
        Sentry.captureException(failure, {
          tags: { app_session_id: appSessionId, operation: "settle_realtime_usage" },
        });
        sendSessionError(client, "billing_unavailable", true);
        closeSocket(upstream, 1011, "billing_unavailable");
        closeSocket(client, 1011, "billing_unavailable");
        finishSessionRecord("failed", "billing_unavailable");
      });
    }, 5_000);
  }
  bindClientEvents(client, upstream, telemetry, finishSessionRecord, usageMeter);
  bindProviderEvents(client, upstream, telemetry, finishSessionRecord);
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
  analyticsEnabled: boolean,
  env: Env,
): Promise<RealtimeSessionValidation> {
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
  const billing: BillingSessionValidation = isBillingEnforced(env)
    ? await validateBilledSession(appSessionId, env)
    : { availableMs: Number.POSITIVE_INFINITY, customerId: null, ok: true };
  if (!billing.ok) {
    return billing;
  }
  return {
    apiKey,
    analyticsEnabled,
    availableMs: billing.availableMs,
    customerId: billing.customerId,
    expiresAtMs: reservation.expires_at_ms,
    ok: true,
    safetyIdentifier: reservation.hashed_install_id,
    targetLanguage,
  };
}

async function validateBilledSession(
  appSessionId: string,
  env: Env,
): Promise<BillingSessionValidation> {
  const usageSession = await findOpenUsageSession(env.BILLING_DB, appSessionId);
  if (!usageSession) {
    return { code: 1008, ok: false, reason: "usage_session_unavailable" };
  }
  const balance = await callCustomerLedger(env.CUSTOMER_LEDGER, usageSession.customerId, {
    action: "get_balance",
    customerId: usageSession.customerId,
    nowMs: Date.now(),
  });
  if (!balance.result.ok || !("balance" in balance.result)) {
    return { code: 1011, ok: false, reason: "billing_unavailable" };
  }
  if (balance.result.balance.availableMs <= 0) {
    return { code: 1008, ok: false, reason: "allowance_exhausted" };
  }
  return {
    availableMs: balance.result.balance.availableMs,
    customerId: usageSession.customerId,
    ok: true,
  };
}

function bindClientEvents(
  client: WorkerWebSocket,
  upstream: WorkerWebSocket,
  telemetry: RealtimeTelemetry,
  finishSessionRecord: (
    outcome: "completed" | "failed",
    failureCode?: string | null,
  ) => void,
  usageMeter: RealtimeUsageMeter | null,
): void {
  const forwardAudio = (audio: ArrayBuffer): void => {
    upstream.send(createInputAudioMessage(audio));
    usageMeter?.recordAudio(audio.byteLength);
    telemetry.stats.inputAudioChunks += 1;
    telemetry.stats.inputAudioBytes += audio.byteLength;
    send(client, {
      bytes_received: telemetry.stats.inputAudioBytes,
      chunk_seq: telemetry.stats.inputAudioChunks,
      kind: "input_audio_ack",
      worker_received_at_ms: Date.now(),
    });
  };
  let audioQueue = Promise.resolve();
  let billingStopped = false;
  const stopForBilling = (code: "allowance_exhausted" | "billing_unavailable"): void => {
    if (billingStopped) {
      return;
    }
    billingStopped = true;
    sendSessionError(client, code, code === "billing_unavailable");
    closeSocket(upstream, code === "allowance_exhausted" ? 1008 : 1011, code);
    closeSocket(client, code === "allowance_exhausted" ? 1008 : 1011, code);
    finishSessionRecord("failed", code);
  };
  const queueAudio = (audio: ArrayBuffer): void => {
    audioQueue = audioQueue.then(async () => {
      if (upstream.readyState !== WebSocket.OPEN) {
        return;
      }
      if (usageMeter) {
        let acceptance = usageMeter.checkAudio(audio.byteLength);
        if (acceptance === "settlement_required") {
          const settlement = await usageMeter.settle();
          if (settlement.exhausted) {
            stopForBilling("allowance_exhausted");
            return;
          }
          acceptance = usageMeter.checkAudio(audio.byteLength);
        }
        if (acceptance !== "accepted") {
          stopForBilling("allowance_exhausted");
          return;
        }
      }
      forwardAudio(audio);
    }).catch((failure: unknown) => {
      Sentry.captureException(failure, {
        tags: { app_session_id: telemetry.appSessionId, operation: "meter_realtime_audio" },
      });
      stopForBilling("billing_unavailable");
    });
  };
  client.addEventListener("message", (event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      if (!isAcceptedAudioFrame(event.data.byteLength)) {
        sendSessionError(client, "audio_frame_too_large", false);
        return;
      }
      queueAudio(event.data);
      return;
    }
    if (event.data instanceof Blob) {
      if (!isAcceptedAudioFrame(event.data.size)) {
        sendSessionError(client, "audio_frame_too_large", false);
        return;
      }
      void event.data.arrayBuffer().then((audio) => {
        if (upstream.readyState === WebSocket.OPEN) {
          queueAudio(audio);
        }
      }).catch((failure: unknown) => {
        Sentry.captureException(failure, {
          tags: { app_session_id: telemetry.appSessionId, operation: "decode_realtime_audio" },
        });
        stopForBilling("billing_unavailable");
      });
      return;
    }
    const command = parseClientCommand(event.data);
    if (command?.kind === "close_session") {
      audioQueue = audioQueue.then(() => {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(createCloseMessage());
        }
      }).catch((failure: unknown) => {
        Sentry.captureException(failure, {
          tags: { app_session_id: telemetry.appSessionId, operation: "close_realtime_audio" },
        });
        stopForBilling("billing_unavailable");
      });
    }
  });
  client.addEventListener("close", () => {
    closeSocket(upstream, 1000, "client_close");
    finishSessionRecord("failed", "client_transport_closed");
  });
  client.addEventListener("error", () => {
    Sentry.captureMessage("worker_client_websocket_error", {
      fingerprint: ["worker_client_websocket_error"],
      level: "error",
      tags: {
        app_session_id: telemetry.appSessionId,
        operation: "client_websocket",
      },
    });
    closeSocket(upstream, 1011, "client_error");
    finishSessionRecord("failed", "client_transport_error");
  });
}

function bindProviderEvents(
  client: WorkerWebSocket,
  upstream: WorkerWebSocket,
  telemetry: RealtimeTelemetry,
  finishSessionRecord: (
    outcome: "completed" | "failed",
    failureCode?: string | null,
  ) => void,
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
      captureFirstProviderSignal(output.event, telemetry);
      if (output.event.kind === "session_error") {
        telemetry.stats.failureCode = normalizeFailureCode(output.event.code);
      }
      send(client, output.event);
      if (output.event.kind === "session_closed") {
        sessionClosedCleanly = true;
        closeSocket(client, 1000, "session_closed");
        finishSessionRecord("completed");
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
    finishSessionRecord(
      sessionClosedCleanly ? "completed" : "failed",
      sessionClosedCleanly ? null : "provider_transport_closed",
    );
  });
  upstream.addEventListener("error", () => {
    Sentry.captureMessage("worker_provider_websocket_error", {
      fingerprint: ["worker_provider_websocket_error"],
      level: "error",
      tags: {
        app_session_id: telemetry.appSessionId,
        operation: "provider_websocket",
      },
    });
    sendSessionError(client, "provider_transport_error", true);
    closeSocket(client, 1011, "provider_transport_error");
    finishSessionRecord("failed", "provider_transport_error");
  });
}

type RealtimeTelemetry = {
  analyticsEnabled: boolean;
  appSessionId: string;
  context?: TelemetryExecutionContext;
  distinctId: string;
  env: Env;
  startedAtMs: number;
  stats: {
    failureCode: string | null;
    inputAudioBytes: number;
    inputAudioChunks: number;
    sourceReceived: boolean;
    translationReceived: boolean;
  };
};

function captureFirstProviderSignal(
  event: RealtimeServerEvent,
  telemetry: RealtimeTelemetry,
): void {
  if (event.kind === "source_delta" && !telemetry.stats.sourceReceived) {
    telemetry.stats.sourceReceived = true;
    queueRealtimeTelemetry(telemetry, {
      app_session_id: telemetry.appSessionId,
      event: "worker_first_source",
      provider_elapsed_ms: event.provider_elapsed_ms ?? null,
      worker_elapsed_ms: Math.max(0, Date.now() - telemetry.startedAtMs),
    });
  }
  if (event.kind === "translation_delta" && !telemetry.stats.translationReceived) {
    telemetry.stats.translationReceived = true;
    queueRealtimeTelemetry(telemetry, {
      app_session_id: telemetry.appSessionId,
      event: "worker_first_translation",
      provider_elapsed_ms: event.provider_elapsed_ms ?? null,
      worker_elapsed_ms: Math.max(0, Date.now() - telemetry.startedAtMs),
    });
  }
}

function createSessionEndedEvent(
  telemetry: RealtimeTelemetry,
  outcome: "completed" | "failed",
  failureCode: string | null,
): WorkerTelemetryEvent {
  return {
    app_session_id: telemetry.appSessionId,
    event: "worker_session_ended",
    failure_code: failureCode,
    input_audio_bytes: telemetry.stats.inputAudioBytes,
    input_audio_chunks: telemetry.stats.inputAudioChunks,
    outcome,
    session_duration_ms: Math.max(0, Date.now() - telemetry.startedAtMs),
    source_received: telemetry.stats.sourceReceived,
    translation_received: telemetry.stats.translationReceived,
  };
}

function queueRealtimeTelemetry(
  telemetry: RealtimeTelemetry,
  payload: WorkerTelemetryEvent,
): void {
  if (!telemetry.analyticsEnabled) {
    return;
  }
  queuePostHogEvent({
    context: telemetry.context,
    distinct_id: telemetry.distinctId,
    env: telemetry.env,
    payload,
  });
}

function normalizeFailureCode(failureCode: string): string {
  const normalized = failureCode.toLowerCase().replace(/[^a-z0-9_:,-]/g, "_");
  return normalized.slice(0, 160) || "unknown_failure";
}

async function closeRealtimeSession(appSessionId: string, env: Env): Promise<void> {
  await closeSessionDurable({
    app_session_id: appSessionId,
    namespace: env.RATE_LIMITER,
    now_ms: Date.now(),
  });
}

async function closeMeteredRealtimeSession(
  appSessionId: string,
  outcome: "closed" | "failed",
  usageMeter: ReturnType<typeof createRealtimeUsageMeter> | null,
  env: Env,
): Promise<void> {
  if (usageMeter) {
    await usageMeter.close(outcome);
  }
  await closeRealtimeSession(appSessionId, env);
}

export function isAcceptedAudioFrame(byteLength: number): boolean {
  return Number.isInteger(byteLength) &&
    byteLength > 0 &&
    byteLength % 2 === 0 &&
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
