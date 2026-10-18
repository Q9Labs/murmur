/// <reference types="@cloudflare/workers-types" />

import { isLanguageCode, type LanguageCode } from "@murmur/protocol/languages";
import type {
  CreateSessionRequest,
  RealtimeClientCommand,
  RealtimeServerEvent,
} from "@murmur/protocol/transport/types";
import * as Sentry from "@sentry/cloudflare";

import { callCustomerLedger } from "../billing/customerLedgerDurableObject";
import { currentCustomerPlan, type CustomerPlan } from "../billing/allowanceService";
import { queuePersonalOfferStart } from "../billing/personalOffer";
import { getSessionPhoneAudioGift, settlePhoneAudioGift } from "../billing/phoneAudioGift";
import {
  createRealtimeUsageMeter,
  type RealtimeUsageMeter,
} from "../billing/realtimeUsageMeter";
import { findOpenUsageSession } from "../billing/usageSessionStore";
import { type Env, getRealtimeApiKey, isBillingEnforced } from "../env";
import { getServerConfig, type ServerConfig } from "../serverConfig";
import { createInsightCollector, discardInsightSession, loadInsightSession, processSessionInsight, type InsightSessionContext } from "../insights/sessionInsights";
import {
  closeSocket,
  send,
  type WorkerResponseInit,
  type WorkerWebSocket,
} from "../http/response";
import {
  createSessionUpdate,
  openTranslationSocket,
  parseTranslationOutput,
  type OpenAITranslationOutput,
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

import { createCaptionRecovery } from "./captionRecovery";

declare const WebSocketPair: {
  new (): { 0: WorkerWebSocket; 1: WorkerWebSocket };
};

const maxAudioFrameBytes = 64 * 1024;
const meaningfulAudioRmsThreshold = 0.01;
const providerConnectionTimeoutMs = 15_000;
const realtimeSilenceTimeoutMs = 120_000;
const intentionalClientCloseReasons = new Set([
  "client_finish", "user_cancel", "hook_unmount", "session_ended",
]);

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
      captureSource: NonNullable<CreateSessionRequest["capture_source"]>;
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

// fallow-ignore-next-line complexity
export async function proxyRealtimeSession(
  request: Request,
  client: WorkerWebSocket,
  env: Env,
  context?: TelemetryExecutionContext,
): Promise<void> {
  const url = new URL(request.url);
  const appSessionId = url.searchParams.get("app_session_id") ?? "";
  const targetLanguage = url.searchParams.get("target_language") ?? "";
  const captureSource = url.searchParams.get("capture_source") === "phone_audio"
    ? "phone_audio"
    : "microphone";
  const analyticsEnabled = url.searchParams.get("analytics_enabled") === "true";
  const realtimeStartedAtMs = Date.now();
  const validated = await validateSession(
    appSessionId,
    targetLanguage,
    analyticsEnabled,
    captureSource,
    env,
  );
  if (!validated.ok) {
    closeSocket(client, validated.code, validated.reason);
    return;
  }
  const giftDatabase = env.BILLING_DB;
  const phoneAudioGift = giftDatabase
    ? await getSessionPhoneAudioGift(giftDatabase, appSessionId)
    : null;
  const usageMeter = createRealtimeUsageMeter({
    availableMs: validated.availableMs,
    customerId: validated.customerId,
    enforceAllowance: validated.billingEnforced,
    gift: phoneAudioGift && giftDatabase
      ? {
        remainingMs: phoneAudioGift.remainingMs,
        settle: (totalMs) => settlePhoneAudioGift(giftDatabase, appSessionId, totalMs),
      }
      : undefined,
    namespace: env.CUSTOMER_LEDGER,
    usageSessionId: appSessionId,
  });
  let config: ServerConfig;
  let customerPlan: CustomerPlan = "free";
  try {
    customerPlan = validated.customerId
      ? await currentCustomerPlan(env.BILLING_DB, validated.customerId, Date.now())
      : "free";
    config = await getServerConfig(env, {
      appVersion: url.searchParams.get("app_version"),
      distinctId: `anonymous_install_${validated.safetyIdentifier}`,
      plan: customerPlan,
      platform: url.searchParams.get("app_platform"),
    });
  } catch (failure) {
    await closeMeteredRealtimeSession(appSessionId, "failed", usageMeter, env).catch(
      (cleanupFailure: unknown) => {
        Sentry.captureException(cleanupFailure, {
          tags: { app_session_id: appSessionId, operation: "close_failed_realtime_config" },
        });
      },
    );
    throw failure;
  }
  const playback = { enabled: url.searchParams.get("playback_enabled") !== "false" };
  const insightSession = await loadInsightSession(env, appSessionId).catch((failure: unknown) => {
    Sentry.captureException(failure, { tags: { operation: "load_insight_session" } });
    return null;
  });
  const insightCollector = insightSession ? createInsightCollector() : null;

  const telemetry: RealtimeTelemetry = {
    analyticsEnabled: validated.analyticsEnabled,
    appSessionId,
    context,
    distinctId: `anonymous_install_${validated.safetyIdentifier}`,
    env,
    startedAtMs: realtimeStartedAtMs,
    stats: {
      captionRetryCount: 0,
      captionsRecovered: false,
      originalCaptionReceived: false,
      captionConnections: 0,
      captionConnectionsWithTranscript: 0,
      captionConnectionsFailed: 0,
      captionInputBytes: 0,
      captionConnectedSeconds: 0,
      captionReplacementCount: 0,
      captionRecoveryExhausted: false,
      closeReason: null,
      failureCode: null,
      inputAudioBytes: 0,
      inputAudioChunks: 0,
      sourceReceived: false,
      translationReceived: false,
      transportClose: null,
    },
  };
  const providerAbort = new AbortController();
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let providerConnectionTimer: ReturnType<typeof setTimeout> | null = null;
  let settlementTimer: ReturnType<typeof setInterval> | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let sessionFinished = false;
  let upstream: WorkerWebSocket | null = null;
  let captionRecovery: ReturnType<typeof createCaptionRecovery> | null = null;

  const terminate = (termination: RealtimeTermination): void => {
    if (sessionFinished) {
      return;
    }
    sessionFinished = true;
    telemetry.stats.closeReason ??= termination.reason;
    if (termination.errorCode === "allowance_exhausted" && validated.customerId && customerPlan === "free") {
      queuePersonalOfferStart({
        config,
        context,
        customerId: validated.customerId,
        database: env.BILLING_DB,
        nowMs: Date.now(),
      });
    }
    providerAbort.abort();
    captionRecovery?.stop();
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
    queueSessionInsight({
      analyticsEnabled: validated.analyticsEnabled,
      appSessionId, collector: insightCollector, config, context, env, session: insightSession,
    });
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
        failureCode: null,
        outcome: "completed",
        reason: "session_silence_timeout",
        retryable: false,
        socketCode: 1008,
      });
    }, realtimeSilenceTimeoutMs);
  };

  client.addEventListener("close", (event) => {
    if (sessionFinished) return;
    telemetry.stats.transportClose = transportCloseDetails(event, "client");
    // Old clients used session_complete for both success and failure; it is not proof of intent.
    const intentional = event.code === 1000 && event.wasClean && intentionalClientCloseReasons.has(event.reason);
    terminate({
      errorCode: null,
      failureCode: intentional ? null : "client_transport_closed",
      outcome: intentional ? "completed" : "failed",
      reason: intentional ? "client_close_session" : "client_transport_closed",
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
      failureCode: null,
      outcome: "completed",
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
      model: config.realtime_model,
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
      if ((!settlement.exhausted && !settlement.giftExhausted) || sessionFinished || !validated.billingEnforced) {
        return;
      }
      terminate({
        errorCode: settlement.giftExhausted ? "phone_audio_gift_exhausted" : "allowance_exhausted",
        failureCode: null,
        outcome: "completed",
        reason: settlement.giftExhausted ? "phone_audio_gift_exhausted" : "allowance_exhausted",
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
  const bindUpstream = (socket: WorkerWebSocket): void => {
    bindProviderEvents(
      client,
      socket,
      telemetry,
      terminate,
      () => sessionFinished || upstream !== socket,
      config.source_transcript,
      (delta, event) => {
        if (delta.trim()) telemetry.stats.originalCaptionReceived = true;
        captionRecovery?.originalCaption(event);
        return false;
      },
      (audio) => {
        captionRecovery?.outputAudio();
        if (playback.enabled && config.output_audio_enabled && client.readyState === WebSocket.OPEN) client.send(audio);
      },
    );
  };
  const retryFailure = (): void => {
    Sentry.captureMessage("worker_caption_retry_failed", {
      level: "warning",
      tags: { app_session_id: appSessionId, operation: "caption_retry" },
    });
  };
  captionRecovery = createCaptionRecovery({
    initial: upstream,
    open: async (signal) => {
      const socket = await openTranslationSocket({
        apiKey: validated.apiKey,
        model: config.realtime_model,
        safetyIdentifier: validated.safetyIdentifier,
        signal: AbortSignal.any([signal, providerAbort.signal]),
      });
      try {
        socket.send(createSessionUpdate(
          validated.targetLanguage, validated.captureSource, config.source_transcript,
        ));
      } catch (failure) {
        safelyCloseSocket(socket, 1000, "caption_retry_discarded", appSessionId);
        throw failure;
      }
      return socket;
    },
    onCaption: (event) => forwardProviderEvent(
      { kind: "event", event }, client, telemetry, terminate,
      (delta) => { insightCollector?.add(delta); return true; },
    ),
    retire: (socket) => safelyCloseSocket(socket, 1000, "caption_retry_replaced", appSessionId),
    onRetry: (count) => { telemetry.stats.captionRetryCount = count; },
    onRecovered: () => { telemetry.stats.captionsRecovered = true; },
    onRetryFailure: retryFailure,
    onConnection: () => { telemetry.stats.captionConnections += 1; },
    onConnectionCaption: () => { telemetry.stats.captionConnectionsWithTranscript += 1; },
    onConnectionFailure: () => { telemetry.stats.captionConnectionsFailed += 1; },
    onInput: (bytes) => { telemetry.stats.captionInputBytes += bytes; },
    onConnectedSeconds: (seconds) => { telemetry.stats.captionConnectedSeconds += seconds; },
    onReplacement: (count) => { telemetry.stats.captionReplacementCount = count; },
    onExhausted: () => {
      telemetry.stats.captionRecoveryExhausted = true;
      Sentry.captureMessage("worker_caption_recovery_exhausted", {
        level: "warning", tags: { app_session_id: appSessionId, operation: "caption_retry" },
      });
    },
  });
  const recovery = captionRecovery;
  bindClientEvents(
    client,
    () => upstream,
    telemetry,
    terminate,
    usageMeter,
    resetSilenceDeadline,
    () => sessionFinished,
    (enabled) => { playback.enabled = enabled; },
    recovery.sendAudio,
  );
  bindUpstream(upstream);
  try {
    upstream.send(createSessionUpdate(
      validated.targetLanguage,
      validated.captureSource,
      config.source_transcript,
    ));
    send(client, {
      kind: "session_opened",
      provider_metadata: {
        model: config.realtime_model,
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
  captureSource: NonNullable<CreateSessionRequest["capture_source"]>,
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
    captureSource,
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
  getUpstream: () => WorkerWebSocket | null,
  telemetry: RealtimeTelemetry,
  terminate: (termination: RealtimeTermination) => void,
  usageMeter: RealtimeUsageMeter,
  resetSilenceDeadline: () => void,
  isSessionFinished: () => boolean,
  setPlaybackEnabled: (enabled: boolean) => void,
  sendAudio: (audio: ArrayBuffer) => void,
): void {
  const forwardAudio = (audio: ArrayBuffer): void => {
    if (hasMeaningfulPcm16Audio(audio)) {
      resetSilenceDeadline();
    }
    sendAudio(audio);
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
  const stopForBilling = (code: "allowance_exhausted" | "phone_audio_gift_exhausted" | "billing_unavailable"): void => {
    terminate({
      errorCode: code,
      failureCode: code === "billing_unavailable" ? code : null,
      outcome: code === "billing_unavailable" ? "failed" : "completed",
      reason: code,
      retryable: code === "billing_unavailable",
      socketCode: code === "billing_unavailable" ? 1011 : 1008,
    });
  };
  // fallow-ignore-next-line complexity
  const queueAudio = (audio: ArrayBuffer): void => {
    // fallow-ignore-next-line complexity
    audioQueue = audioQueue.then(async () => {
      if (isSessionFinished() || getUpstream()?.readyState !== WebSocket.OPEN) {
        return;
      }
      let acceptance = usageMeter.checkAudio(audio.byteLength);
      if (acceptance === "settlement_required") {
        const settlement = await usageMeter.settle();
        if (settlement.exhausted || settlement.giftExhausted) {
          stopForBilling(settlement.giftExhausted ? "phone_audio_gift_exhausted" : "allowance_exhausted");
          return;
        }
        acceptance = usageMeter.checkAudio(audio.byteLength);
      }
      if (acceptance !== "accepted") {
        stopForBilling(acceptance === "phone_audio_gift_exhausted" ? acceptance : "allowance_exhausted");
        return;
      }
      if (isSessionFinished() || getUpstream()?.readyState !== WebSocket.OPEN) {
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
        if (getUpstream()?.readyState === WebSocket.OPEN) {
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
    } else if (command?.kind === "set_playback") {
      setPlaybackEnabled(command.enabled);
    }
  });
}

function bindProviderEvents(
  client: WorkerWebSocket,
  upstream: WorkerWebSocket,
  telemetry: RealtimeTelemetry,
  terminate: (termination: RealtimeTermination) => void,
  isFinished: () => boolean,
  sourceTranscript: boolean,
  onTranslation: (delta: string, event: Extract<RealtimeServerEvent, { kind: "translation_delta" | "source_delta" }>) => boolean,
  onOutputAudio: (audio: ArrayBuffer) => void,
): void {
  upstream.addEventListener("message", (event: MessageEvent) => {
    if (isFinished()) return;
    try {
      const output = parseTranslationOutput(event.data);
      if (output.kind === "audio") {
        onOutputAudio(output.pcm16);
        return;
      }
      if (output.kind === "event") {
        if (output.event.kind === "source_delta" && !sourceTranscript) {
          return;
        }
        forwardProviderEvent(output, client, telemetry, terminate, onTranslation);
      }
    } catch (failure) {
      Sentry.captureException(failure, {
        tags: { app_session_id: telemetry.appSessionId, operation: "forward_provider_output" },
      });
      terminate({
        errorCode: "provider_output_invalid",
        failureCode: "provider_output_invalid",
        outcome: "failed",
        reason: "provider_output_invalid",
        retryable: true,
        socketCode: 1011,
      });
    }
  });
  upstream.addEventListener("close", (event) => {
    if (isFinished()) return;
    telemetry.stats.transportClose = transportCloseDetails(event, "provider");
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
    if (isFinished()) return;
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

function forwardProviderEvent(
  output: Extract<OpenAITranslationOutput, { kind: "event" }>,
  client: WorkerWebSocket,
  telemetry: RealtimeTelemetry,
  terminate: (termination: RealtimeTermination) => void,
  onTranslation: (delta: string, event: Extract<RealtimeServerEvent, { kind: "translation_delta" | "source_delta" }>) => boolean,
): void {
  if (output.event.kind === "translation_delta" && !onTranslation(output.event.delta, output.event)) return;
  captureFirstProviderSignal(output.event, telemetry);
  if (output.event.kind === "session_error") {
    telemetry.stats.failureCode = normalizeFailureCode(output.event.code);
  }
  send(client, output.event);
  if (output.event.kind === "session_closed") {
    telemetry.stats.closeReason = output.providerCloseReason
      ? normalizeFailureCode(output.providerCloseReason)
      : "provider_session_closed";
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

type RealtimeTermination = {
  errorCode: string | null;
  failureCode: string | null;
  outcome: "completed" | "failed";
  reason: string;
  retryable: boolean;
  socketCode: number;
};

function queueSessionInsight(params: {
  analyticsEnabled: boolean;
  appSessionId: string;
  collector: ReturnType<typeof createInsightCollector> | null;
  config: ServerConfig;
  context?: TelemetryExecutionContext;
  env: Env;
  session: InsightSessionContext | null;
}): void {
  if (!params.session || !params.collector) return;
  const translation = params.collector.finish();
  const processing = translation
    ? processSessionInsight({
        analyticsEnabled: params.analyticsEnabled,
        configModel: params.config.insights_model,
        context: params.context,
        env: params.env,
        session: params.session,
        translation,
      })
    : discardInsightSession(params.env, params.appSessionId).catch((failure: unknown) => {
        Sentry.captureException(failure, { tags: { operation: "discard_insight_session" } });
      });
  if (params.context) params.context.waitUntil(processing);
  else void processing;
}

type RealtimeTelemetry = {
  analyticsEnabled: boolean;
  appSessionId: string;
  context?: TelemetryExecutionContext;
  distinctId: string;
  env: Env;
  startedAtMs: number;
  stats: {
    captionRetryCount: number;
    captionsRecovered: boolean;
    originalCaptionReceived: boolean;
    captionConnections: number;
    captionConnectionsWithTranscript: number;
    captionConnectionsFailed: number;
    captionInputBytes: number;
    captionConnectedSeconds: number;
    captionReplacementCount: number;
    captionRecoveryExhausted: boolean;
    closeReason: string | null;
    failureCode: string | null;
    inputAudioBytes: number;
    inputAudioChunks: number;
    sourceReceived: boolean;
    translationReceived: boolean;
    transportClose: {
      code: number | null;
      reason: string | null;
      source: "client" | "provider";
      wasClean: boolean | null;
    } | null;
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
  if (event.kind === "translation_delta" && event.delta.trim() && !telemetry.stats.translationReceived) {
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
    close_reason: telemetry.stats.closeReason,
    event: "worker_session_ended",
    caption_retry_count: telemetry.stats.captionRetryCount,
    captions_recovered: telemetry.stats.captionsRecovered,
    caption_original_received: telemetry.stats.originalCaptionReceived,
    caption_recovery_connections: telemetry.stats.captionConnections,
    caption_recovery_with_transcript: telemetry.stats.captionConnectionsWithTranscript,
    caption_recovery_failed: telemetry.stats.captionConnectionsFailed,
    caption_recovery_input_bytes: telemetry.stats.captionInputBytes,
    caption_only_used: telemetry.stats.captionsRecovered,
    caption_only_connected_seconds: telemetry.stats.captionConnectedSeconds,
    caption_replacement_count: telemetry.stats.captionReplacementCount,
    caption_recovery_exhausted: telemetry.stats.captionRecoveryExhausted,
    failure_code: failureCode,
    input_audio_bytes: telemetry.stats.inputAudioBytes,
    input_audio_chunks: telemetry.stats.inputAudioChunks,
    outcome,
    session_duration_ms: Math.max(0, Date.now() - telemetry.startedAtMs),
    source_received: telemetry.stats.sourceReceived,
    translation_received: telemetry.stats.translationReceived,
    transport_close_code: telemetry.stats.transportClose?.code ?? null,
    transport_close_reason: telemetry.stats.transportClose?.reason ?? null,
    transport_close_source: telemetry.stats.transportClose?.source ?? null,
    transport_close_was_clean: telemetry.stats.transportClose?.wasClean ?? null,
  };
}

function transportCloseDetails(event: CloseEvent, source: "client" | "provider") {
  const reason = event.reason ? normalizeFailureCode(event.reason) : null;
  // Close text is peer-controlled. Record known lifecycle reasons, never arbitrary user content.
  const knownReasons = [
    "client_finish", "user_cancel", "hook_unmount", "session_ended", "session_complete",
    "session_failed", "transport_error", "idle_timeout", "session_timeout",
    "max_duration_reached", "session_expired", "insufficient_quota", "credit_balance_exhausted",
  ];
  return {
    code: event.code ?? null,
    reason: reason === null || knownReasons.includes(reason) ? reason : "other",
    source,
    wasClean: event.wasClean ?? null,
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
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || !("kind" in parsed)) {
      return null;
    }
    if (parsed.kind === "close_session") {
      return { kind: "close_session" };
    }
    if (parsed.kind === "set_playback" && "enabled" in parsed && typeof parsed.enabled === "boolean") {
      return { kind: "set_playback", enabled: parsed.enabled };
    }
    return null;
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
