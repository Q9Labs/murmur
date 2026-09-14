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
const meaningfulAudioRmsThreshold = 0.01;
const providerConnectionTimeoutMs = 15_000;
const realtimeSilenceTimeoutMs = 120_000;

type SessionValidationFailure = { code: number; ok: false; reason: string };

type BillingSessionValidation =
  | { availableMs: number; customerId: string | null; ok: true }
  | SessionValidationFailure;

type RealtimeSessionValidation =
  | {
      apiKey: string;
      analyticsEnabled: boolean;
      availableMs: number;
      billingEnforced: boolean;
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
  const usageMeter = createRealtimeUsageMeter({
    availableMs: validated.availableMs,
    customerId: validated.customerId,
    enforceAllowance: validated.billingEnforced,
    namespace: env.CUSTOMER_LEDGER,
    usageSessionId: appSessionId,
  });

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
  const providerAbort = new AbortController();
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let providerConnectionTimer: ReturnType<typeof setTimeout> | null = null;
  let settlementTimer: ReturnType<typeof setInterval> | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let sessionFinished = false;
  let upstream: WorkerWebSocket | null = null;

  const terminate = (termination: RealtimeTermination): void => {
    if (sessionFinished) {
      return;
    }
    sessionFinished = true;
    providerAbort.abort();
    clearRealtimeTimers();
    if (termination.errorCode) {
      safelySendSessionError(
        client,
        termination.errorCode,
        termination.retryable,
        appSessionId,
      );
    }
    safelyCloseSocket(upstream, termination.socketCode, termination.reason, appSessionId);
    safelyCloseSocket(client, termination.socketCode, termination.reason, appSessionId);
    const cleanup = closeMeteredRealtimeSession(
      appSessionId,
      termination.outcome === "completed" ? "closed" : "failed",
      usageMeter,
      env,
    ).catch((failure: unknown) => {
      Sentry.captureException(failure, {
        tags: { app_session_id: appSessionId, operation: "close_realtime_session_record" },
      });
    });
    if (context) {
      context.waitUntil(cleanup);
    } else {
      void cleanup;
    }
    queueRealtimeTelemetry(
      telemetry,
      createSessionEndedEvent(telemetry, termination.outcome, termination.failureCode),
    );
  };
  const clearRealtimeTimers = (): void => {
    if (deadlineTimer) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
    if (providerConnectionTimer) {
      clearTimeout(providerConnectionTimer);
      providerConnectionTimer = null;
    }
    if (settlementTimer) {
      clearInterval(settlementTimer);
      settlementTimer = null;
    }
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  };
  const resetSilenceDeadline = (): void => {
    if (sessionFinished) {
      return;
    }
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }
    silenceTimer = setTimeout(() => {
      terminate({
        errorCode: "session_silence_timeout",
        failureCode: "session_silence_timeout",
        outcome: "failed",
        reason: "session_silence_timeout",
        retryable: false,
        socketCode: 1008,
      });
    }, realtimeSilenceTimeoutMs);
  };

  client.addEventListener("close", () => {
    terminate({
      errorCode: null,
      failureCode: "client_transport_closed",
      outcome: "failed",
      reason: "client_transport_closed",
      retryable: false,
      socketCode: 1000,
    });
  });
  client.addEventListener("error", () => {
    Sentry.captureMessage("worker_client_websocket_error", {
      fingerprint: ["worker_client_websocket_error"],
      level: "error",
      tags: { app_session_id: appSessionId, operation: "client_websocket" },
    });
    terminate({
      errorCode: "client_transport_error",
      failureCode: "client_transport_error",
      outcome: "failed",
      reason: "client_transport_error",
      retryable: true,
      socketCode: 1011,
    });
  });

  const remainingMs = Math.max(0, validated.expiresAtMs - Date.now());
  if (remainingMs === 0) {
    terminate({
      errorCode: "session_expired",
      failureCode: "session_expired",
      outcome: "failed",
      reason: "session_expired",
      retryable: false,
      socketCode: 1008,
    });
    return;
  }
  deadlineTimer = setTimeout(() => {
    terminate({
      errorCode: "session_expired",
      failureCode: "session_expired",
      outcome: "failed",
      reason: "session_expired",
      retryable: false,
      socketCode: 1008,
    });
  }, remainingMs);
  providerConnectionTimer = setTimeout(() => {
    terminate({
      errorCode: "provider_connection_timeout",
      failureCode: "provider_connection_timeout",
      outcome: "failed",
      reason: "provider_connection_timeout",
      retryable: true,
      socketCode: 1011,
    });
  }, Math.min(providerConnectionTimeoutMs, remainingMs));

  const providerConnectStartedAtMs = Date.now();
  try {
    upstream = await openTranslationSocket({
      apiKey: validated.apiKey,
      model: env.OPENAI_REALTIME_MODEL,
      safetyIdentifier: validated.safetyIdentifier,
      signal: providerAbort.signal,
    });
  } catch (failure) {
    if (sessionFinished) {
      return;
    }
    Sentry.captureException(failure, {
      tags: { app_session_id: appSessionId, operation: "open_translation_socket" },
    });
    terminate({
      errorCode: "provider_connection_failed",
      failureCode: "provider_connection_failed",
      outcome: "failed",
      reason: "provider_connection_failed",
      retryable: true,
      socketCode: 1011,
    });
    return;
  }
  if (providerConnectionTimer) {
    clearTimeout(providerConnectionTimer);
    providerConnectionTimer = null;
  }
  if (sessionFinished) {
    safelyCloseSocket(upstream, 1000, "session_already_terminated", appSessionId);
    return;
  }
  queueRealtimeTelemetry(telemetry, {
    app_session_id: appSessionId,
    event: "worker_realtime_opened",
    provider_connection_latency_ms: Math.max(0, Date.now() - providerConnectStartedAtMs),
    target_language: validated.targetLanguage,
  });

  if (client.readyState !== WebSocket.OPEN) {
    terminate({
      errorCode: null,
      failureCode: "client_gone_before_open",
      outcome: "failed",
      reason: "client_gone_before_open",
      retryable: false,
      socketCode: 1000,
    });
    return;
  }
  settlementTimer = setInterval(() => {
    void usageMeter.settle().then((settlement) => {
      if (!settlement.exhausted || sessionFinished || !validated.billingEnforced) {
        return;
      }
      terminate({
        errorCode: "allowance_exhausted",
        failureCode: "allowance_exhausted",
        outcome: "failed",
        reason: "allowance_exhausted",
        retryable: false,
        socketCode: 1008,
      });
    }).catch((failure: unknown) => {
      Sentry.captureException(failure, {
        tags: { app_session_id: appSessionId, operation: "settle_realtime_usage" },
      });
      terminate({
        errorCode: "billing_unavailable",
        failureCode: "billing_unavailable",
        outcome: "failed",
        reason: "billing_unavailable",
        retryable: true,
        socketCode: 1011,
      });
    });
  }, 5_000);
  resetSilenceDeadline();
  bindClientEvents(client, upstream, telemetry, terminate, usageMeter, resetSilenceDeadline);
  bindProviderEvents(client, upstream, telemetry, terminate);
  try {
    upstream.send(createSessionUpdate(validated.targetLanguage));
    send(client, {
      kind: "session_opened",
      provider_metadata: {
        model: env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-translate",
        provider: "openai",
      },
    });
  } catch (failure) {
    Sentry.captureException(failure, {
      tags: { app_session_id: appSessionId, operation: "configure_translation_socket" },
    });
    terminate({
      errorCode: "provider_configuration_failed",
      failureCode: "provider_configuration_failed",
      outcome: "failed",
      reason: "provider_configuration_failed",
      retryable: true,
      socketCode: 1011,
    });
    return;
  }
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
  const billingEnforced = isBillingEnforced(env);
  let billing: BillingSessionValidation;
  try {
    billing = billingEnforced
      ? await validateBilledSession(appSessionId, env)
      : await findOptionalMeteringSession(appSessionId, env);
  } catch (failure) {
    await closeRealtimeSession(appSessionId, env).catch((closeFailure: unknown) => {
      Sentry.captureException(closeFailure, {
        tags: { app_session_id: appSessionId, operation: "close_invalid_realtime_session" },
      });
    });
    throw failure;
  }
  if (!billing.ok) {
    await closeRealtimeSession(appSessionId, env);
    return billing;
  }
  return {
    apiKey,
    analyticsEnabled,
    availableMs: billing.availableMs,
    billingEnforced,
    customerId: billing.customerId,
    expiresAtMs: reservation.expires_at_ms,
    ok: true,
    safetyIdentifier: reservation.hashed_install_id,
    targetLanguage,
  };
}

async function findOptionalMeteringSession(
  appSessionId: string,
  env: Env,
): Promise<BillingSessionValidation> {
  if (!env.BILLING_DB) {
    return { availableMs: Number.POSITIVE_INFINITY, customerId: null, ok: true };
  }
  try {
    const usageSession = await findOpenUsageSession(env.BILLING_DB, appSessionId);
    return {
      availableMs: Number.POSITIVE_INFINITY,
      customerId: usageSession?.customerId ?? null,
      ok: true,
    };
  } catch (failure) {
    Sentry.captureException(failure, {
      tags: { app_session_id: appSessionId, operation: "find_optional_usage_session" },
    });
    return { availableMs: Number.POSITIVE_INFINITY, customerId: null, ok: true };
  }
}

async function validateBilledSession(
  appSessionId: string,
  env: Env,
): Promise<BillingSessionValidation> {
  const usageSession = await findOpenUsageSession(env.BILLING_DB, appSessionId);
  if (!usageSession) {
    return { code: 1008, ok: false, reason: "usage_session_unavailable" };
  }
  let balance: Awaited<ReturnType<typeof callCustomerLedger>>;
  try {
    balance = await callCustomerLedger(env.CUSTOMER_LEDGER, usageSession.customerId, {
      action: "get_balance",
      customerId: usageSession.customerId,
      nowMs: Date.now(),
    });
  } catch (failure) {
    await closeRejectedUsageSession(appSessionId, usageSession.customerId, env);
    throw failure;
  }
  if (!balance.result.ok || !("balance" in balance.result)) {
    await closeRejectedUsageSession(appSessionId, usageSession.customerId, env);
    return { code: 1011, ok: false, reason: "billing_unavailable" };
  }
  if (balance.result.balance.availableMs <= 0) {
    await closeRejectedUsageSession(appSessionId, usageSession.customerId, env);
    return { code: 1008, ok: false, reason: "allowance_exhausted" };
  }
  return {
    availableMs: balance.result.balance.availableMs,
    customerId: usageSession.customerId,
    ok: true,
  };
}

async function closeRejectedUsageSession(
  appSessionId: string,
  customerId: string,
  env: Env,
): Promise<void> {
  await callCustomerLedger(env.CUSTOMER_LEDGER, customerId, {
    action: "close_usage_session",
    customerId,
    nowMs: Date.now(),
    outcome: "failed",
    usageSessionId: appSessionId,
  }).catch((failure: unknown) => {
    Sentry.captureException(failure, {
      tags: { app_session_id: appSessionId, operation: "close_rejected_usage_session" },
    });
  });
}

function bindClientEvents(
  client: WorkerWebSocket,
  upstream: WorkerWebSocket,
  telemetry: RealtimeTelemetry,
  terminate: (termination: RealtimeTermination) => void,
  usageMeter: RealtimeUsageMeter,
  resetSilenceDeadline: () => void,
): void {
  const forwardAudio = (audio: ArrayBuffer): void => {
    if (hasMeaningfulPcm16Audio(audio)) {
      resetSilenceDeadline();
    }
    upstream.send(createInputAudioMessage(audio));
    usageMeter.recordAudio(audio.byteLength);
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
  const stopForBilling = (code: "allowance_exhausted" | "billing_unavailable"): void => {
    terminate({
      errorCode: code,
      failureCode: code,
      outcome: "failed",
      reason: code,
      retryable: code === "billing_unavailable",
      socketCode: code === "allowance_exhausted" ? 1008 : 1011,
    });
  };
  const queueAudio = (audio: ArrayBuffer): void => {
    audioQueue = audioQueue.then(async () => {
      if (upstream.readyState !== WebSocket.OPEN) {
        return;
      }
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
      if (upstream.readyState !== WebSocket.OPEN) {
        return;
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
      terminate({
        errorCode: null,
        failureCode: null,
        outcome: "completed",
        reason: "client_close_session",
        retryable: false,
        socketCode: 1000,
      });
    }
  });
}

function bindProviderEvents(
  client: WorkerWebSocket,
  upstream: WorkerWebSocket,
  telemetry: RealtimeTelemetry,
  terminate: (termination: RealtimeTermination) => void,
): void {
  upstream.addEventListener("message", (event: MessageEvent) => {
    try {
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
          terminate({
            errorCode: null,
            failureCode: null,
            outcome: "completed",
            reason: "provider_session_closed",
            retryable: false,
            socketCode: 1000,
          });
        } else if (output.event.kind === "session_error") {
          terminate({
            errorCode: null,
            failureCode: telemetry.stats.failureCode,
            outcome: "failed",
            reason: "provider_session_error",
            retryable: output.event.retryable,
            socketCode: 1011,
          });
        }
      }
    } catch (failure) {
      Sentry.captureException(failure, {
        tags: { app_session_id: telemetry.appSessionId, operation: "forward_provider_output" },
      });
      terminate({
        errorCode: "client_transport_error",
        failureCode: "client_transport_error",
        outcome: "failed",
        reason: "client_transport_error",
        retryable: true,
        socketCode: 1011,
      });
    }
  });
  upstream.addEventListener("close", () => {
    terminate({
      errorCode: "provider_transport_closed",
      failureCode: "provider_transport_closed",
      outcome: "failed",
      reason: "provider_transport_closed",
      retryable: true,
      socketCode: 1011,
    });
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
    terminate({
      errorCode: "provider_transport_error",
      failureCode: "provider_transport_error",
      outcome: "failed",
      reason: "provider_transport_error",
      retryable: true,
      socketCode: 1011,
    });
  });
}

type RealtimeTermination = {
  errorCode: string | null;
  failureCode: string | null;
  outcome: "completed" | "failed";
  reason: string;
  retryable: boolean;
  socketCode: number;
};

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
  usageMeter: ReturnType<typeof createRealtimeUsageMeter>,
  env: Env,
): Promise<void> {
  const results = await Promise.allSettled([
    usageMeter.close(outcome),
    closeRealtimeSession(appSessionId, env),
  ]);
  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : []
  );
  if (failures.length > 0) {
    throw new AggregateError(failures, "realtime session cleanup failed");
  }
}

export function isAcceptedAudioFrame(byteLength: number): boolean {
  return Number.isInteger(byteLength) &&
    byteLength > 0 &&
    byteLength % 2 === 0 &&
    byteLength <= maxAudioFrameBytes;
}

export function hasMeaningfulPcm16Audio(audio: ArrayBuffer): boolean {
  if (audio.byteLength < 2 || audio.byteLength % 2 !== 0) {
    return false;
  }
  const samples = new DataView(audio);
  let squaredSum = 0;
  const sampleCount = audio.byteLength / 2;
  for (let offset = 0; offset < audio.byteLength; offset += 2) {
    const normalized = samples.getInt16(offset, true) / 32_768;
    squaredSum += normalized * normalized;
  }
  return Math.sqrt(squaredSum / sampleCount) >= meaningfulAudioRmsThreshold;
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

function safelySendSessionError(
  socket: WorkerWebSocket,
  code: string,
  retryable: boolean,
  appSessionId: string,
): void {
  try {
    sendSessionError(socket, code, retryable);
  } catch (failure) {
    Sentry.captureException(failure, {
      tags: { app_session_id: appSessionId, operation: "send_realtime_error" },
    });
  }
}

function safelyCloseSocket(
  socket: WorkerWebSocket | null,
  code: number,
  reason: string,
  appSessionId: string,
): void {
  if (!socket) {
    return;
  }
  try {
    closeSocket(socket, code, reason);
  } catch (failure) {
    Sentry.captureException(failure, {
      tags: { app_session_id: appSessionId, operation: "close_realtime_socket" },
    });
  }
}
