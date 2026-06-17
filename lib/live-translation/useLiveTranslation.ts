import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";

import MurmurAudioModule, {
  type AudioFrameEvent,
  type AudioStateEvent,
} from "../../modules/murmur-audio";
import {
  appendRollingMemorySpan,
  applySummaryResult,
  createContinuousMemoryState,
  selectSpansForSummary,
  shouldScheduleSummary,
  trimRollingMemoryForPrompt,
  type ContinuousMemoryState,
} from "../continuousMemory";
import {
  ContinuousTranslationScheduler,
  type ContinuousTranslationRetryResult,
} from "../continuousTranslationScheduler";
import { ContinuousSpanStabilizer } from "../continuousStabilizer";
import { getOrCreateInstallId } from "../installIdentity";
import { summarizeLatency, type DebugLogEntry, type LatencySample } from "../latency";
import { getLanguage } from "../languages";
import {
  clearDeepgramKeepAlive,
  clearSilenceFinalize,
  echoGatePostRollMs,
  nextEchoGateUntilMs,
  roundMetric,
  scheduleSilenceFinalize,
  shouldGateMicFrameForEcho,
  shouldSendUltravoxFrame,
  speechRmsThreshold,
  startDeepgramKeepAlive,
} from "./audioRuntime";
import { buildLiveTranslationDiagnosticsSnapshot } from "./diagnostics";
import {
  createSummaryJobId,
  createTranslationClientRequestId,
  joinSourceCaptions,
  normalizeCaption,
  resetSpanForContinuousRetry,
  spanKey,
  withRetryClientRequestId,
} from "./spanRuntime";
import {
  getCurrentSttStartedAt,
  recordElapsedLatency,
  resetCurrentSttTiming,
} from "./timing";
import {
  clearTokenRefresh,
  nextTokenRefreshRetryDelayMs,
  scheduleTokenRefresh,
  scheduleTokenRefreshRetry,
} from "./tokenRefresh";
import type {
  LiveTranslationController,
  LiveTranslationParams,
} from "./types";
import {
  closeWorkerSession,
  collectDeviceIntegrity,
  createWorkerSession,
  getDeepgramClientLanguage,
  refreshWorkerSessionTokens,
  requestContinuousSummary,
  requestMicrophonePermission,
} from "./workerApi";
import { CartesiaSpeechClient } from "../providers/cartesia";
import { DeepgramLiveClient, type DeepgramClientEvent, type DeepgramStatusEvent } from "../providers/deepgram";
import { reportTranslation } from "../providers/reportTranslation";
import { MurmurTranslationClient } from "../providers/translation";
import { UltravoxLiveClient, type UltravoxClientEvent, type UltravoxStatusEvent } from "../providers/ultravox";
import { isUltravoxReplacementRoute } from "../translationModelRoutes";
import {
  canStartSession,
  createConnectionId,
  createSession,
  createSpan,
  isActiveOrRecoveringSession,
  nextEventSeq,
  selectContextSpans,
  shouldAcceptDeepgramEvent,
  shouldAcceptTranslationEvent,
  type SessionState,
  type TranslationSession,
  type TranslationSpan,
} from "../session";
import type {
  CreateSessionResponse,
  ReportTranslationCategory,
  SourceCaptionStatus,
  TranslationServerEvent,
  TranslationMode,
  TranslationRequest,
} from "../transport/types";

const continuousContextSpanLimit = 10;
const continuousTranslationInFlightLimit = 1;
const continuousTranslationStallTimeoutMs = 12_000;

type TranslationWaitEvent = Extract<TranslationServerEvent, { kind: "translation_wait" }>;
type TranslationDeltaEvent = Extract<TranslationServerEvent, { kind: "translation_delta" }>;
type TranslationDoneEvent = Extract<TranslationServerEvent, { kind: "translation_done" }>;
type TranslationErrorEvent = Extract<TranslationServerEvent, { kind: "translation_error" }>;

export function useLiveTranslation(params: LiveTranslationParams): LiveTranslationController {
  const normalizedParams = {
    ...params,
    translation_mode: params.translation_mode ?? ("phrase" as TranslationMode),
    ultravox_vad_enabled: params.ultravox_vad_enabled ?? true,
  };
  const [session, setSession] = useState(() => createSession(normalizedParams));
  const [spans, setSpans] = useState<TranslationSpan[]>([]);
  const [tentativeSourceCaption, setTentativeSourceCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<DebugLogEntry[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportReceiptId, setReportReceiptId] = useState<string | null>(null);
  const [latencySamples, setLatencySamples] = useState<LatencySample[]>([]);
  const deepgramRef = useRef<DeepgramLiveClient | null>(null);
  const speechRef = useRef<CartesiaSpeechClient | null>(null);
  const translationRef = useRef<MurmurTranslationClient | null>(null);
  const ultravoxRef = useRef<UltravoxLiveClient | null>(null);
  const deepgramKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deepgramSilenceFinalizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continuousMemoryRef = useRef<ContinuousMemoryState>(createContinuousMemoryState());
  const continuousStabilizerRef = useRef(new ContinuousSpanStabilizer());
  const continuousTranslationSchedulerRef = useRef(
    new ContinuousTranslationScheduler({ max_in_flight: continuousTranslationInFlightLimit }),
  );
  const echoGateUntilMsRef = useRef(0);
  const echoGateDroppedFrameCountRef = useRef(0);
  const echoGateWindowStartedAtMsRef = useRef<number | null>(null);
  const flushTranslationQueueTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRefreshRetryCountRef = useRef(0);
  const echoGateLoggedRef = useRef(false);
  const firstTranslatedTokenSeenRef = useRef<Set<string>>(new Set());
  const firstTranscriptSeenRef = useRef(false);
  const localSpeechStartedAtRef = useRef<number | null>(null);
  const hasSpeechSinceFinalizeRef = useRef(false);
  const continuousWaitPrefixRef = useRef<string | null>(null);
  const lastCommittedSourceCaptionRef = useRef<string | null>(null);
  const spansRef = useRef<TranslationSpan[]>([]);
  const sessionRef = useRef(session);
  const speechStartedAtRef = useRef<number | null>(null);
  const tentativeSourceCaptionRef = useRef("");
  const translationEventSeqRef = useRef<Map<string, number>>(new Map());
  const translationSocketOpenRef = useRef(false);
  const translationStartedAtRef = useRef<Map<string, number>>(new Map());
  const ultravoxAgentDraftByOrdinalRef = useRef<Map<number, string>>(new Map());
  const ultravoxLocalVadUntilMsRef = useRef(0);
  const ultravoxSpanKeyByOrdinalRef = useRef<Map<number, string>>(new Map());
  const ultravoxUserTextByOrdinalRef = useRef<Map<number, string>>(new Map());
  const ultravoxVadEnabledRef = useRef(normalizedParams.ultravox_vad_enabled);
  const flushContinuousTranslationQueueRef = useRef<() => void>(() => undefined);

  const recordDebug = useCallback(
    (
      name: string,
      message: string,
      level: DebugLogEntry["level"] = "info",
      data?: DebugLogEntry["data"],
    ) => {
      setDebugLog((current) =>
        [
          ...current,
          {
            at_ms: Date.now(),
            data,
            level,
            message,
            name,
          },
        ],
      );
    },
    [],
  );

  const updateTentativeSourceCaption = useCallback((caption: string) => {
    tentativeSourceCaptionRef.current = caption;
    setTentativeSourceCaption(caption);
  }, []);

  useEffect(() => {
    spansRef.current = spans;
  }, [spans]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    ultravoxVadEnabledRef.current = normalizedParams.ultravox_vad_enabled;
  }, [normalizedParams.ultravox_vad_enabled]);

  const updateSession = useCallback((updater: (current: TranslationSession) => TranslationSession) => {
    const nextSession = updater(sessionRef.current);
    sessionRef.current = nextSession;
    setSession(nextSession);
  }, []);

  const resetSession = useCallback((nextSession: TranslationSession) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }, []);

  useEffect(() => {
    const currentState = sessionRef.current.state;
    if (currentState === "live" || currentState === "stopping" || currentState === "cancelling") {
      return;
    }

    resetSession(createSession(normalizedParams));
    setSpans([]);
    updateTentativeSourceCaption("");
    continuousWaitPrefixRef.current = null;
    lastCommittedSourceCaptionRef.current = null;
    setError(null);
    setReportError(null);
    setReportReceiptId(null);
    setLatencySamples([]);
    setDebugLog([]);
    continuousMemoryRef.current = createContinuousMemoryState();
    continuousStabilizerRef.current.reset();
    continuousTranslationSchedulerRef.current.clear();
    firstTranslatedTokenSeenRef.current.clear();
    firstTranscriptSeenRef.current = false;
    translationEventSeqRef.current.clear();
    translationSocketOpenRef.current = false;
    translationStartedAtRef.current.clear();
    ultravoxAgentDraftByOrdinalRef.current.clear();
    ultravoxLocalVadUntilMsRef.current = 0;
    ultravoxSpanKeyByOrdinalRef.current.clear();
    ultravoxUserTextByOrdinalRef.current.clear();
    if (flushTranslationQueueTimeoutRef.current) {
      clearTimeout(flushTranslationQueueTimeoutRef.current);
      flushTranslationQueueTimeoutRef.current = null;
    }
  }, [
    params.source_language,
    params.target_language,
    normalizedParams.translation_mode,
    normalizedParams.translation_model_route,
    normalizedParams.ultravox_vad_enabled,
    resetSession,
    updateTentativeSourceCaption,
  ]);

  useEffect(() => {
    const subscription = MurmurAudioModule.addListener(
      "onAudioFrame",
      (frame: AudioFrameEvent) => {
        const shouldGateForEcho =
          sessionRef.current.translation_mode !== "continuous" &&
          shouldGateMicFrameForEcho(echoGateUntilMsRef.current);
        if (shouldGateForEcho) {
          echoGateDroppedFrameCountRef.current += 1;
          echoGateWindowStartedAtMsRef.current ??= Date.now();
          if (!echoGateLoggedRef.current) {
            echoGateLoggedRef.current = true;
            recordLatencyRef.current("mic_frame_echo_gated", 0);
            recordDebugRef.current("audio.echo_gate", "Microphone frame gated during speech playback", "warn", {
              echo_gate_until_ms: Number.isFinite(echoGateUntilMsRef.current) ? echoGateUntilMsRef.current : null,
              rms: roundMetric(frame.rms),
            });
          }
          return;
        }
        if (echoGateDroppedFrameCountRef.current > 0) {
          recordDebugRef.current("audio.echo_gate_finished", "Microphone echo gate finished", "debug", {
            dropped_frame_count: echoGateDroppedFrameCountRef.current,
            gated_duration_ms:
              echoGateWindowStartedAtMsRef.current === null
                ? null
                : Date.now() - echoGateWindowStartedAtMsRef.current,
          });
          echoGateDroppedFrameCountRef.current = 0;
          echoGateWindowStartedAtMsRef.current = null;
        }
        echoGateLoggedRef.current = false;
        if (frame.rms >= speechRmsThreshold && localSpeechStartedAtRef.current === null) {
          localSpeechStartedAtRef.current = Date.now();
          recordDebugRef.current("audio.local_speech_started", "Local audio level crossed speech threshold", "debug", {
            rms: roundMetric(frame.rms),
            threshold: speechRmsThreshold,
          });
        }
        if (isUltravoxReplacementRoute(sessionRef.current.translation_model_route)) {
          if (shouldSendUltravoxFrame(frame, ultravoxVadEnabledRef.current, ultravoxLocalVadUntilMsRef)) {
            ultravoxRef.current?.sendPcm16(frame.data);
          }
          return;
        }

        deepgramRef.current?.sendPcm16(frame.data);
        scheduleSilenceFinalize({
          deepgramRef,
          frame,
          hasSpeechSinceFinalizeRef,
          timeoutRef: deepgramSilenceFinalizeTimeoutRef,
        });
      },
    );
    return () => {
      subscription.remove();
      clearDeepgramKeepAlive(deepgramKeepAliveRef);
      clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
      clearTokenRefresh(tokenRefreshTimeoutRef);
      if (flushTranslationQueueTimeoutRef.current) {
        clearTimeout(flushTranslationQueueTimeoutRef.current);
        flushTranslationQueueTimeoutRef.current = null;
      }
      continuousTranslationSchedulerRef.current.clear();
      translationSocketOpenRef.current = false;
      deepgramRef.current?.close();
      speechRef.current?.close();
      translationRef.current?.close();
      ultravoxRef.current?.close();
      void MurmurAudioModule.stopCapture("hook_unmount");
      void MurmurAudioModule.clearPlayback("hook_unmount");
    };
  }, []);

  useEffect(() => {
    const subscription = MurmurAudioModule.addListener(
      "onAudioState",
      (audioState: AudioStateEvent) => {
        if (audioState.playback_active) {
          if (sessionRef.current.translation_mode === "continuous") {
            recordDebugRef.current("audio.playback_observed_continuous", "Speech playback observed during Continuous Mode without mic gating", "debug", {
              playback_queued_ms: audioState.playback_queued_ms,
              reason: audioState.reason,
            });
            return;
          }
          echoGateUntilMsRef.current = nextEchoGateUntilMs(audioState.playback_queued_ms);
          recordDebugRef.current("audio.playback_active", "Native speech playback became active", "info", {
            echo_gate_until_ms: echoGateUntilMsRef.current,
            playback_queued_ms: audioState.playback_queued_ms,
            reason: audioState.reason,
          });
          return;
        }
        if (sessionRef.current.translation_mode === "continuous") {
          return;
        }
        if (echoGateUntilMsRef.current > Date.now()) {
          echoGateUntilMsRef.current = Date.now() + echoGatePostRollMs;
          recordDebugRef.current("audio.playback_inactive", "Native speech playback ended; microphone post-roll gate started", "info", {
            post_roll_ms: echoGatePostRollMs,
            reason: audioState.reason,
          });
        }
      },
    );
    return () => subscription.remove();
  }, []);

  const setStatus = useCallback((status: SessionState) => {
    updateSession((current) => ({ ...current, state: status }));
  }, [updateSession]);

  const recordLatency = useCallback((name: string, value_ms: number) => {
    setLatencySamples((current) => [...current, { name, value_ms }]);
  }, []);
  const recordLatencyRef = useRef(recordLatency);
  const recordDebugRef = useRef(recordDebug);

  useEffect(() => {
    recordLatencyRef.current = recordLatency;
  }, [recordLatency]);

  useEffect(() => {
    recordDebugRef.current = recordDebug;
  }, [recordDebug]);

  const scheduleContinuousTranslationFlush = useCallback((delayMs = 0) => {
    if (flushTranslationQueueTimeoutRef.current) {
      clearTimeout(flushTranslationQueueTimeoutRef.current);
      flushTranslationQueueTimeoutRef.current = null;
    }
    flushTranslationQueueTimeoutRef.current = setTimeout(() => {
      flushTranslationQueueTimeoutRef.current = null;
      flushContinuousTranslationQueueRef.current();
    }, Math.max(0, delayMs));
  }, []);

  const flushContinuousTranslationQueue = useCallback(() => {
    if (sessionRef.current.translation_mode !== "continuous") {
      return;
    }
    const translation = translationRef.current;
    if (!translation || !translationSocketOpenRef.current) {
      return;
    }

    let sentCount = 0;
    while (true) {
      const item = continuousTranslationSchedulerRef.current.nextReady();
      if (!item) {
        break;
      }
      sentCount += 1;
      translationStartedAtRef.current.set(item.span_key, Date.now());
      setSpans((current) => {
        const nextSpans = current.map((span) =>
          spanKey(span.span_id, span.revision) === item.span_key
            ? {
                ...span,
                status: "translating" as const,
                translation_attempt: item.request.translation_attempt,
                translation_client_request_id: item.request.client_request_id ?? null,
                updated_at_ms: Date.now(),
              }
            : span,
        );
        spansRef.current = nextSpans;
        return nextSpans;
      });
      translation.translate(item.request);
      const counts = continuousTranslationSchedulerRef.current.counts();
      recordLatency("translation_queue_wait", item.queue_wait_ms);
      recordDebug("translation.queue_sent", "Queued continuous span sent for translation", "debug", {
        client_request_id: item.request.client_request_id ?? null,
        context_span_count: item.request.context_spans.length,
        context_summary_length: item.request.context_summary?.length ?? 0,
        in_flight: counts.in_flight,
        queue_wait_ms: item.queue_wait_ms,
        queued: counts.queued,
        source_caption: item.request.source_caption,
        source_status: item.request.source_status ?? null,
        span_id: item.request.span_id,
        translation_attempt: item.request.translation_attempt,
        translation_route: item.request.translation_model_route ?? "worker_default",
      });
    }

    const nextDelayMs = continuousTranslationSchedulerRef.current.nextDelayMs();
    if (sentCount === 0 && nextDelayMs !== null) {
      scheduleContinuousTranslationFlush(nextDelayMs);
    }
  }, [recordDebug, recordLatency, scheduleContinuousTranslationFlush]);

  useEffect(() => {
    flushContinuousTranslationQueueRef.current = flushContinuousTranslationQueue;
  }, [flushContinuousTranslationQueue]);

  const clearContinuousTranslationRuntime = useCallback(() => {
    continuousWaitPrefixRef.current = null;
    continuousTranslationSchedulerRef.current.clear();
    firstTranslatedTokenSeenRef.current.clear();
    translationEventSeqRef.current.clear();
    translationSocketOpenRef.current = false;
    translationStartedAtRef.current.clear();
    if (flushTranslationQueueTimeoutRef.current) {
      clearTimeout(flushTranslationQueueTimeoutRef.current);
      flushTranslationQueueTimeoutRef.current = null;
    }
  }, []);

  const requeueActiveContinuousTranslations = useCallback((reason: string) => {
    if (sessionRef.current.translation_mode !== "continuous") {
      return;
    }
    const requeued = continuousTranslationSchedulerRef.current.requeueInFlight();
    if (requeued.length === 0) {
      return;
    }
    for (const item of requeued) {
      translationStartedAtRef.current.delete(item.span_key);
      firstTranslatedTokenSeenRef.current.delete(item.span_key);
      translationEventSeqRef.current.delete(item.span_key);
      item.request = {
        ...item.request,
        client_request_id: createTranslationClientRequestId(
          item.request.span_id,
          item.request.revision,
          item.request.translation_attempt,
        ),
      };
    }
    setSpans((current) => {
      const requeuedByKey = new Map(requeued.map((item) => [item.span_key, item]));
      const nextSpans = current.map((span) =>
        requeuedByKey.has(spanKey(span.span_id, span.revision))
          ? {
              ...span,
              partial_translated_caption: null,
              status: "translating" as const,
              translation_attempt: requeuedByKey.get(spanKey(span.span_id, span.revision))?.request.translation_attempt ?? span.translation_attempt + 1,
              translation_client_request_id:
                requeuedByKey.get(spanKey(span.span_id, span.revision))?.request.client_request_id ?? null,
              translated_caption: span.committed_translated_caption ?? "",
              translation_request_id: null,
              updated_at_ms: Date.now(),
            }
          : span,
      );
      spansRef.current = nextSpans;
      return nextSpans;
    });
    recordDebug("translation.queue_requeued", "Active continuous translations requeued after transport change", "warn", {
      reason,
      requeued_count: requeued.length,
    });
  }, [recordDebug]);

  const handleContinuousTranslationTimeouts = useCallback(() => {
    const currentSession = sessionRef.current;
    if (
      currentSession.translation_mode !== "continuous" ||
      !isActiveOrRecoveringSession(currentSession.state)
    ) {
      return;
    }

    const staleItems = continuousTranslationSchedulerRef.current.staleInFlight(
      continuousTranslationStallTimeoutMs,
    );
    for (const staleItem of staleItems) {
      translationStartedAtRef.current.delete(staleItem.span_key);
      firstTranslatedTokenSeenRef.current.delete(staleItem.span_key);
      translationEventSeqRef.current.delete(staleItem.span_key);
      recordLatency("translation_timeout", staleItem.active_ms);

      const retry = continuousTranslationSchedulerRef.current.fail(staleItem.span_key, true);
      if (!retry.exhausted) {
        retry.item.request = withRetryClientRequestId(retry.item.request);
        setSpans((current) => {
          const nextSpans = current.map((span) =>
            spanKey(span.span_id, span.revision) === staleItem.span_key
              ? resetSpanForContinuousRetry(span, retry.item.request)
              : span,
          );
          spansRef.current = nextSpans;
          return nextSpans;
        });
        recordDebug("translation.timeout_retry_scheduled", "Continuous translation timed out; retry scheduled", "warn", {
          active_ms: staleItem.active_ms,
          retry_delay_ms: retry.retry_delay_ms,
          span_id: retry.item.request.span_id,
          source_caption: retry.item.request.source_caption,
          translation_client_request_id: retry.item.request.client_request_id ?? null,
          translation_attempt: retry.item.request.translation_attempt,
        });
        scheduleContinuousTranslationFlush(retry.retry_delay_ms);
        continue;
      }

      setError("translation_timeout");
      setSpans((current) => {
        const nextSpans = current.map((span) =>
          spanKey(span.span_id, span.revision) === staleItem.span_key
            ? {
                ...span,
                partial_translated_caption: null,
                status: "failed" as const,
                translated_caption: span.committed_translated_caption ?? "",
                translation_request_id: null,
                updated_at_ms: Date.now(),
              }
            : span,
        );
        spansRef.current = nextSpans;
        return nextSpans;
      });
      recordDebug("translation.timeout_exhausted", "Continuous translation timed out after retry budget", "error", {
        active_ms: staleItem.active_ms,
        span_id: staleItem.request.span_id,
        source_caption: staleItem.request.source_caption,
        translation_attempt: staleItem.request.translation_attempt,
        translation_client_request_id: staleItem.request.client_request_id ?? null,
      });
      flushContinuousTranslationQueueRef.current();
    }
  }, [recordDebug, recordLatency, scheduleContinuousTranslationFlush]);

  useEffect(() => {
    const interval = setInterval(handleContinuousTranslationTimeouts, 1000);
    return () => clearInterval(interval);
  }, [handleContinuousTranslationTimeouts]);

  const commitStableSourceCaption = useCallback((sourceCaption: string, options?: {
    latencyEvent?: string;
    latencyStartedAtMs?: number | null;
    sourceStatus?: SourceCaptionStatus;
    stableStartedAtMs?: number | null;
  }) => {
    const sourceStatus = options?.sourceStatus ?? "final";
    const sourceCaptionForSpan = sessionRef.current.translation_mode === "continuous"
      ? joinSourceCaptions(continuousWaitPrefixRef.current, sourceCaption)
      : sourceCaption;
    const normalizedCaption = normalizeCaption(sourceCaptionForSpan);
    if (!normalizedCaption || normalizeCaption(lastCommittedSourceCaptionRef.current ?? "") === normalizedCaption) {
      recordDebug("span.commit_skipped", "Stable source caption was empty or duplicated", "debug", {
        duplicate: Boolean(normalizedCaption),
        source_length: sourceCaptionForSpan.length,
      });
      return;
    }

    updateTentativeSourceCaption("");
    if (sessionRef.current.translation_mode === "continuous") {
      continuousWaitPrefixRef.current = null;
    }
    lastCommittedSourceCaptionRef.current = normalizedCaption;
    const span = createSpan(sourceCaptionForSpan);
    const translationAttempt = span.translation_attempt + 1;
    const clientRequestId = createTranslationClientRequestId(span.span_id, span.revision, translationAttempt);
    recordDebug("span.committed", "Stable source caption committed for translation", "info", {
      revision: span.revision,
      source_caption: sourceCaptionForSpan,
      source_length: sourceCaptionForSpan.length,
      source_status: sourceStatus,
      span_id: span.span_id,
      translation_attempt: translationAttempt,
      translation_client_request_id: clientRequestId,
    });
    recordElapsedLatency(options?.latencyEvent, options?.latencyStartedAtMs ?? undefined, recordLatency);
    recordElapsedLatency("stable_span_emitted", options?.stableStartedAtMs ?? undefined, recordLatency);
    setSpans((current) => {
      const nextSpans = [
        ...current,
        {
          ...span,
          source_status: sourceStatus,
          status: "translating" as const,
          translation_attempt: translationAttempt,
          translation_client_request_id: clientRequestId,
        },
      ];
      spansRef.current = nextSpans;
      return nextSpans;
    });
    const nextSession = nextEventSeq(sessionRef.current);
    sessionRef.current = nextSession;
    setSession(nextSession);
    const memory = continuousMemoryRef.current;
    const rollingContext =
      nextSession.translation_mode === "continuous"
        ? trimRollingMemoryForPrompt(memory.summary, memory.rolling_memory, span.source_caption.length).map(
            (memorySpan) => ({
              span_id: memorySpan.span_id,
              source_caption: memorySpan.source_caption,
              translated_caption: memorySpan.translated_caption,
            }),
          ).slice(-continuousContextSpanLimit)
        : selectContextSpans(spansRef.current);
    const request: TranslationRequest = {
      app_session_id: nextSession.identity.app_session_id,
      client_request_id: clientRequestId,
      connection_id: nextSession.identity.connection_id,
      context_spans: rollingContext,
      context_summary: nextSession.translation_mode === "continuous" ? memory.summary.text || null : null,
      event_seq: nextSession.identity.event_seq,
      revision: span.revision,
      session_epoch: nextSession.identity.session_epoch,
      source_caption: span.source_caption,
      source_language: nextSession.source_language,
      source_status: sourceStatus,
      span_id: span.span_id,
      target_language: nextSession.target_language,
      translation_mode: nextSession.translation_mode,
      translation_model_route: nextSession.translation_model_route,
      translation_attempt: translationAttempt,
    };
    recordDebug("translation.request_prepared", "Translation request prepared", "debug", {
      client_request_id: clientRequestId,
      context_span_count: rollingContext.length,
      context_summary_length: request.context_summary?.length ?? 0,
      source_caption: request.source_caption,
      source_status: request.source_status ?? null,
      span_id: request.span_id,
      translation_attempt: request.translation_attempt,
      translation_mode: request.translation_mode ?? "phrase",
      translation_route: request.translation_model_route ?? "worker_default",
    });

    if (nextSession.translation_mode === "continuous") {
      const key = spanKey(span.span_id, span.revision);
      const item = continuousTranslationSchedulerRef.current.enqueue(request, key);
      const counts = continuousTranslationSchedulerRef.current.counts();
      recordDebug("translation.queue_enqueued", "Continuous span queued for ordered translation", "debug", {
        in_flight: counts.in_flight,
        queued: counts.queued,
        queued_at_ms: item.queued_at_ms,
        span_id: span.span_id,
      });
      flushContinuousTranslationQueueRef.current();
      return;
    }

    translationStartedAtRef.current.set(spanKey(span.span_id, span.revision), Date.now());
    recordDebug("translation.sent", "Phrase span sent for translation", "debug", {
      client_request_id: request.client_request_id ?? null,
      context_span_count: request.context_spans.length,
      span_id: request.span_id,
      translation_attempt: request.translation_attempt,
      translation_route: request.translation_model_route ?? "worker_default",
    });
    translationRef.current?.translate(request);
  }, [recordDebug, recordLatency, updateTentativeSourceCaption]);

  const scheduleContinuousSummary = useCallback(() => {
    const currentSession = sessionRef.current;
    if (currentSession.translation_mode !== "continuous") {
      return;
    }
    const memory = continuousMemoryRef.current;
    if (!shouldScheduleSummary(memory)) {
      return;
    }
    const selection = selectSpansForSummary(memory.rolling_memory);
    if (selection.spans_to_summarize.length === 0 || !selection.summarized_through_span_id) {
      return;
    }
    const inputMemoryVersion = memory.memory_version;
    const summaryJobId = createSummaryJobId();
    continuousMemoryRef.current = {
      ...memory,
      summary_job_running: true,
    };
    recordDebug("summary.scheduled", "Continuous memory summary scheduled", "debug", {
      input_memory_version: inputMemoryVersion,
      span_count: selection.spans_to_summarize.length,
      summary_job_id: summaryJobId,
    });
    void requestContinuousSummary({
      app_session_id: currentSession.identity.app_session_id,
      input_memory_version: inputMemoryVersion,
      previous_summary: memory.summary,
      session_epoch: currentSession.identity.session_epoch,
      source_language: currentSession.source_language,
      spans_to_summarize: selection.spans_to_summarize,
      summary_job_id: summaryJobId,
      target_language: currentSession.target_language,
    }).then((result) => {
      if (!("ok" in result) || !result.ok) {
        continuousMemoryRef.current = {
          ...continuousMemoryRef.current,
          summary_job_running: false,
        };
        recordDebug("summary.failed", "Continuous memory summary failed", "warn", {
          error: "error" in result ? result.error : "summary_failed",
          summary_job_id: summaryJobId,
        });
        return;
      }
      if (
        result.session_epoch !== sessionRef.current.identity.session_epoch ||
        result.summary_job_id !== summaryJobId
      ) {
        recordDebug("summary.stale", "Continuous memory summary ignored because it is stale", "debug", {
          summary_job_id: summaryJobId,
        });
        return;
      }
      continuousMemoryRef.current = applySummaryResult({
        current: continuousMemoryRef.current,
        input_memory_version: result.input_memory_version,
        summarized_through_span_id: selection.summarized_through_span_id,
        summary: result.summary,
      });
      recordDebug("summary.applied", "Continuous memory summary applied", "debug", {
        memory_version: continuousMemoryRef.current.memory_version,
        summary_length: continuousMemoryRef.current.summary.text.length,
      });
    });
  }, [recordDebug]);

  function finishDeepgramSttTurn(): void {
    resetCurrentSttTiming(speechStartedAtRef, localSpeechStartedAtRef);
    firstTranscriptSeenRef.current = false;
  }

  function handleDeepgramUtteranceEnd(): void {
    hasSpeechSinceFinalizeRef.current = false;
    clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
    const sttStartedAt = getCurrentSttStartedAt(speechStartedAtRef, localSpeechStartedAtRef);
    if (sessionRef.current.translation_mode === "continuous") {
      for (const span of continuousStabilizerRef.current.acceptTranscript(tentativeSourceCaptionRef.current, true)) {
        commitStableSourceCaption(span.source_caption, {
          latencyEvent: "deepgram_utterance_end_received",
          latencyStartedAtMs: sttStartedAt,
          sourceStatus: "final",
          stableStartedAtMs: sttStartedAt,
        });
      }
      continuousStabilizerRef.current.reset();
      updateTentativeSourceCaption("");
    } else {
      commitStableSourceCaption(tentativeSourceCaptionRef.current, {
        latencyEvent: "deepgram_utterance_end_received",
        latencyStartedAtMs: sttStartedAt,
        sourceStatus: "final",
        stableStartedAtMs: sttStartedAt,
      });
    }
    finishDeepgramSttTurn();
  }

  function handleDeepgramSpeechStarted(): void {
    hasSpeechSinceFinalizeRef.current = true;
    const localSpeechStartedAt = localSpeechStartedAtRef.current;
    speechStartedAtRef.current = Date.now();
    firstTranscriptSeenRef.current = false;
    if (sessionRef.current.translation_mode === "continuous") {
      continuousStabilizerRef.current.reset();
      updateTentativeSourceCaption("");
    }
    recordElapsedLatency("deepgram_speech_started", localSpeechStartedAt ?? undefined, recordLatency);
    recordDebug("deepgram.speech_started", "Deepgram speech_started event accepted", "debug", {
      local_to_deepgram_ms:
        typeof localSpeechStartedAt === "number" ? speechStartedAtRef.current - localSpeechStartedAt : null,
    });
    clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
  }

  function handleContinuousDeepgramTranscript(
    event: Extract<DeepgramClientEvent, { type: "transcript" }>,
    sttStartedAt: number | undefined,
  ): void {
    const isFinal = event.is_final || event.speech_final;
    const stableSpans = continuousStabilizerRef.current.acceptTranscript(event.transcript, isFinal);
    for (const span of stableSpans) {
      commitStableSourceCaption(span.source_caption, {
        sourceStatus: isFinal ? "final" : "stable",
        stableStartedAtMs: sttStartedAt,
      });
    }
    if (isFinal) {
      continuousStabilizerRef.current.reset();
      updateTentativeSourceCaption("");
      hasSpeechSinceFinalizeRef.current = false;
      clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
      finishDeepgramSttTurn();
      return;
    }
    updateTentativeSourceCaption(continuousStabilizerRef.current.getUnemittedText(event.transcript));
  }

  function handleDeepgramTranscript(event: Extract<DeepgramClientEvent, { type: "transcript" }>): void {
    const sttStartedAt = getCurrentSttStartedAt(speechStartedAtRef, localSpeechStartedAtRef);
    recordDeepgramTranscriptLatency(event, sttStartedAt);
    if (sessionRef.current.translation_mode === "continuous") {
      handleContinuousDeepgramTranscript(event, sttStartedAt);
      return;
    }
    handlePhraseDeepgramTranscript(event, sttStartedAt);
  }

  function recordDeepgramTranscriptLatency(
    event: Extract<DeepgramClientEvent, { type: "transcript" }>,
    sttStartedAt: number | undefined,
  ): void {
    if (!firstTranscriptSeenRef.current) {
      recordElapsedLatency("deepgram_first_transcript_received", sttStartedAt, recordLatency);
      firstTranscriptSeenRef.current = true;
    }
    recordElapsedLatency(deepgramTranscriptLatencyName(event), sttStartedAt, recordLatency);
  }

  function deepgramTranscriptLatencyName(
    event: Extract<DeepgramClientEvent, { type: "transcript" }>,
  ): "deepgram_final_received" | "deepgram_interim_received" {
    return event.is_final || event.speech_final ? "deepgram_final_received" : "deepgram_interim_received";
  }

  function handlePhraseDeepgramTranscript(
    event: Extract<DeepgramClientEvent, { type: "transcript" }>,
    sttStartedAt: number | undefined,
  ): void {
    if (!event.is_final && !event.speech_final) {
      updateTentativeSourceCaption(event.transcript);
      return;
    }
    hasSpeechSinceFinalizeRef.current = false;
    clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
    commitStableSourceCaption(event.transcript, {
      sourceStatus: "final",
      stableStartedAtMs: sttStartedAt,
    });
    finishDeepgramSttTurn();
  }

  function recordDeepgramEvent(event: DeepgramClientEvent): void {
    if (event.type === "transcript") {
      recordDebug("deepgram.event", "Deepgram transcript event received", "debug", {
        final: event.is_final,
        reason: null,
        speech_final: event.speech_final,
        transcript_length: event.transcript.length,
      });
      return;
    }
    recordDebug("deepgram.event", `Deepgram ${event.type} event received`, deepgramStatusSeverity(event), {
      final: null,
      reason: event.reason,
      speech_final: null,
      transcript_length: null,
    });
  }

  function deepgramStatusSeverity(event: DeepgramStatusEvent): "debug" | "error" {
    return event.type === "error" && event.reason !== "deepgram_backpressure" ? "error" : "debug";
  }

  function handleDeepgramErrorEvent(event: DeepgramStatusEvent): void {
    if (event.reason === "deepgram_backpressure") {
      recordDebug("deepgram.backpressure", "Deepgram send buffer is full; dropping stale mic frames until it drains", "warn");
      return;
    }
    setError(`deepgram:${event.reason}`);
  }

  function dispatchDeepgramEvent(event: DeepgramClientEvent): void {
    switch (event.type) {
      case "utterance_end":
        handleDeepgramUtteranceEnd();
        return;
      case "speech_started":
        handleDeepgramSpeechStarted();
        return;
      case "error":
        handleDeepgramErrorEvent(event);
        return;
      case "transcript":
        handleDeepgramTranscript(event);
    }
  }

  const handleDeepgramEvent = useCallback((event: DeepgramClientEvent) => {
    if (!shouldAcceptDeepgramEvent(sessionRef.current.state)) {
      recordDebug("deepgram.event_ignored", "Deepgram event ignored because session is not active", "debug", {
        session_state: sessionRef.current.state,
        type: event.type,
      });
      return;
    }

    recordDeepgramEvent(event);
    dispatchDeepgramEvent(event);
  }, [commitStableSourceCaption, recordDebug, recordLatency, updateTentativeSourceCaption]);

  function resolveUltravoxTranscriptText(event: Extract<UltravoxClientEvent, { type: "transcript" }>): string {
    const previousText =
      event.role === "user"
        ? ultravoxUserTextByOrdinalRef.current.get(event.ordinal) ?? ""
        : ultravoxAgentDraftByOrdinalRef.current.get(event.ordinal) ?? "";
    return event.text ?? `${previousText}${event.delta ?? ""}`;
  }

  function handleUltravoxUserTranscript(
    event: Extract<UltravoxClientEvent, { type: "transcript" }>,
    nextText: string,
  ): void {
    ultravoxUserTextByOrdinalRef.current.set(event.ordinal, nextText);
    if (event.final) {
      updateTentativeSourceCaption("");
      recordElapsedLatency("ultravox_user_transcript_final", getCurrentSttStartedAt(speechStartedAtRef, localSpeechStartedAtRef), recordLatency);
      return;
    }
    updateTentativeSourceCaption(nextText);
    recordElapsedLatency("ultravox_user_transcript_interim", getCurrentSttStartedAt(speechStartedAtRef, localSpeechStartedAtRef), recordLatency);
  }

  function createUltravoxAgentSpan(
    event: Extract<UltravoxClientEvent, { type: "transcript" }>,
  ): { key: string; span: TranslationSpan } {
    const sourceCaption =
      ultravoxUserTextByOrdinalRef.current.get(event.ordinal)?.trim() ||
      tentativeSourceCaptionRef.current.trim() ||
      "Ultravox direct speech turn";
    const span = {
      ...createSpan(sourceCaption),
      source_status: event.final ? "final" as const : "stable" as const,
      status: "translating" as const,
      translation_attempt: 1,
    };
    const key = spanKey(span.span_id, span.revision);
    ultravoxSpanKeyByOrdinalRef.current.set(event.ordinal, key);
    translationStartedAtRef.current.set(key, getCurrentSttStartedAt(speechStartedAtRef, localSpeechStartedAtRef) ?? Date.now());
    return { key, span };
  }

  function updateUltravoxAgentSpan(
    event: Extract<UltravoxClientEvent, { type: "transcript" }>,
    key: string,
    nextText: string,
    createdSpan: TranslationSpan | null,
  ): void {
    setSpans((current) => {
      const baseSpans = createdSpan ? [...current, createdSpan] : current;
      const nextSpans = baseSpans.map((span) => {
        if (spanKey(span.span_id, span.revision) !== key) {
          return span;
        }
        return {
          ...span,
          committed_translated_caption: event.final ? nextText : span.committed_translated_caption,
          partial_translated_caption: event.final ? null : nextText,
          provider_metadata: event.final
            ? {
                model: "ultravox-realtime",
                provider: "ultravox",
                route_id: sessionRef.current.translation_model_route ?? "worker_default",
                source_status: span.source_status,
              }
            : span.provider_metadata,
          status: event.final ? "committed" as const : "translating" as const,
          translated_caption: nextText,
          updated_at_ms: Date.now(),
        };
      });
      spansRef.current = nextSpans;
      return nextSpans;
    });
  }

  function completeUltravoxAgentSpan(key: string, translatedCaption: string): void {
    recordElapsedLatency("translation_done", translationStartedAtRef.current.get(key), recordLatency);
    translationStartedAtRef.current.delete(key);
    firstTranslatedTokenSeenRef.current.delete(key);
    const span = spansRef.current.find((item) => spanKey(item.span_id, item.revision) === key);
    if (sessionRef.current.translation_mode === "continuous" && span) {
      continuousMemoryRef.current = appendRollingMemorySpan(continuousMemoryRef.current, {
        committed_at_ms: Date.now(),
        revision: span.revision,
        source_caption: span.source_caption,
        span_id: span.span_id,
        translated_caption: translatedCaption,
      });
      scheduleContinuousSummary();
    }
  }

  function handleUltravoxTranscript(event: Extract<UltravoxClientEvent, { type: "transcript" }>): void {
    const nextText = resolveUltravoxTranscriptText(event);
    if (!nextText.trim()) {
      return;
    }
    if (event.role === "user") {
      handleUltravoxUserTranscript(event, nextText);
      return;
    }

    ultravoxAgentDraftByOrdinalRef.current.set(event.ordinal, nextText);
    let key = ultravoxSpanKeyByOrdinalRef.current.get(event.ordinal);
    let createdSpan: TranslationSpan | null = null;
    if (!key) {
      const created = createUltravoxAgentSpan(event);
      key = created.key;
      createdSpan = created.span;
    }

    markFirstTranslatedToken(key);
    updateUltravoxAgentSpan(event, key, nextText, createdSpan);
    if (event.final) {
      completeUltravoxAgentSpan(key, nextText);
    }
  }

  function recordUltravoxEvent(event: UltravoxClientEvent): void {
    if (event.type === "transcript") {
      recordDebug("ultravox.event", "Ultravox transcript event received", "debug", {
        final: event.final,
        ordinal: event.ordinal,
        role: event.role,
        text_length: (event.text ?? event.delta ?? "").length,
      });
      return;
    }
    recordDebug("ultravox.event", `Ultravox ${event.type} event received`, event.type === "error" ? "error" : "debug", {
      final: null,
      ordinal: null,
      role: null,
      text_length: null,
    });
  }

  function handleUltravoxCloseEvent(): void {
    if (sessionRef.current.state === "live") {
      setError("ultravox_transport_closed");
      setStatus("transport_disconnected");
    }
  }

  function handleUltravoxErrorEvent(event: UltravoxStatusEvent): void {
    if (event.reason === "ultravox_backpressure") {
      recordDebug("ultravox.backpressure", "Ultravox send buffer is full; dropping stale mic frames until it drains", "warn");
      return;
    }
    setError(`ultravox:${event.reason}`);
  }

  function dispatchUltravoxEvent(event: UltravoxClientEvent): void {
    if (event.type === "transcript") {
      handleUltravoxTranscript(event);
      return;
    }
    if (event.type === "close") {
      handleUltravoxCloseEvent();
      return;
    }
    if (event.type === "error") {
      handleUltravoxErrorEvent(event);
    }
  }

  const handleUltravoxEvent = useCallback((event: UltravoxClientEvent) => {
    if (!isActiveOrRecoveringSession(sessionRef.current.state)) {
      recordDebug("ultravox.event_ignored", "Ultravox event ignored because session is not active", "debug", {
        type: event.type,
      });
      return null;
    }

    recordUltravoxEvent(event);
    dispatchUltravoxEvent(event);
  }, [recordDebug, recordLatency, scheduleContinuousSummary, setStatus, updateTentativeSourceCaption]);

  function markFirstTranslatedToken(key: string): void {
    if (firstTranslatedTokenSeenRef.current.has(key)) {
      return;
    }
    firstTranslatedTokenSeenRef.current.add(key);
    recordElapsedLatency("first_translated_token_returned", translationStartedAtRef.current.get(key), recordLatency);
  }

  function clearTranslationTracking(key: string): void {
    translationStartedAtRef.current.delete(key);
    firstTranslatedTokenSeenRef.current.delete(key);
    translationEventSeqRef.current.delete(key);
  }

  function appendCommittedContinuousSpan(span: TranslationSpan, translatedCaption: string): void {
    continuousMemoryRef.current = appendRollingMemorySpan(continuousMemoryRef.current, {
      committed_at_ms: Date.now(),
      revision: span.revision,
      source_caption: span.source_caption,
      span_id: span.span_id,
      translated_caption: translatedCaption,
    });
  }

  function getTranslatingSpanForEvent(event: TranslationServerEvent): TranslationSpan | null {
    const currentSpan = spansRef.current.find(
      (span) => span.span_id === event.span_id && span.revision === event.revision,
    );
    if (!currentSpan) {
      recordDebug("translation.event_ignored", "Translation event ignored because its span is no longer present", "debug", {
        kind: event.kind,
        span_id: event.span_id,
      });
      return null;
    }
    return isCurrentTranslationSpan(currentSpan, event) ? currentSpan : null;
  }

  function isCurrentTranslationSpan(currentSpan: TranslationSpan, event: TranslationServerEvent): boolean {
    return (
      isTranslatingSpanForEvent(currentSpan, event) &&
      hasMatchingTranslationRequestId(currentSpan, event) &&
      hasMatchingClientRequestId(currentSpan, event)
    );
  }

  function isTranslatingSpanForEvent(currentSpan: TranslationSpan, event: TranslationServerEvent): boolean {
    if (currentSpan.status === "translating") {
      return true;
    }
    recordDebug("translation.event_ignored", "Translation event ignored because the span is not awaiting translation", "debug", {
      kind: event.kind,
      span_id: event.span_id,
      span_status: currentSpan.status,
    });
    return false;
  }

  function hasMatchingTranslationRequestId(currentSpan: TranslationSpan, event: TranslationServerEvent): boolean {
    if (!event.translation_request_id || !currentSpan.translation_request_id) {
      return true;
    }
    if (event.translation_request_id === currentSpan.translation_request_id) {
      return true;
    }
    recordDebug("translation.event_ignored", "Translation event ignored because request id changed", "warn", {
      event_translation_request_id: event.translation_request_id,
      span_id: event.span_id,
      span_translation_request_id: currentSpan.translation_request_id,
    });
    return false;
  }

  function hasMatchingClientRequestId(currentSpan: TranslationSpan, event: TranslationServerEvent): boolean {
    if (!event.client_request_id || currentSpan.translation_client_request_id === event.client_request_id) {
      return true;
    }
    recordDebug("translation.event_ignored", "Translation event ignored because client request id changed", "warn", {
      event_client_request_id: event.client_request_id,
      span_client_request_id: currentSpan.translation_client_request_id,
      span_id: event.span_id,
    });
    return false;
  }

  function acceptTranslationEventSeq(event: TranslationServerEvent, key: string): boolean {
    if (typeof event.server_event_seq !== "number") {
      return true;
    }
    const previousSeq = translationEventSeqRef.current.get(key) ?? 0;
    if (event.server_event_seq <= previousSeq) {
      recordDebug("translation.event_ignored", "Translation event ignored because server sequence regressed", "warn", {
        previous_server_event_seq: previousSeq,
        server_event_seq: event.server_event_seq,
        span_id: event.span_id,
      });
      return false;
    }
    translationEventSeqRef.current.set(key, event.server_event_seq);
    return true;
  }

  function recordTranslationEvent(event: TranslationServerEvent): void {
    recordDebug("translation.event", `Translation ${event.kind} event received`, event.kind === "translation_error" ? "error" : "debug", {
      delta_length: event.kind === "translation_delta" ? event.delta.length : null,
      error_code: event.kind === "translation_error" ? event.error_code : null,
      reason: event.kind === "translation_wait" ? event.reason : null,
      span_id: event.span_id,
      translation_client_request_id: event.client_request_id ?? null,
      translation_request_id: event.translation_request_id,
    });
  }

  function handleTranslationWaitEvent(
    event: TranslationWaitEvent,
    currentSpan: TranslationSpan,
    key: string,
  ): void {
    clearTranslationTracking(key);
    continuousTranslationSchedulerRef.current.complete(key);
    const mergedQueuedItem = continuousTranslationSchedulerRef.current.prependSourceToNextQueued(
      currentSpan.source_caption,
    );
    if (!mergedQueuedItem) {
      continuousWaitPrefixRef.current = joinSourceCaptions(
        continuousWaitPrefixRef.current,
        currentSpan.source_caption,
      );
    } else {
      lastCommittedSourceCaptionRef.current = normalizeCaption(mergedQueuedItem.request.source_caption);
    }
    setSpans((current) => {
      const nextSpans = current.map((span) =>
        span.span_id === event.span_id && span.revision === event.revision
          ? {
              ...span,
              partial_translated_caption: null,
              status: "superseded" as const,
              translated_caption: "",
              translation_client_request_id: event.client_request_id ?? span.translation_client_request_id,
              translation_request_id: event.translation_request_id,
              updated_at_ms: Date.now(),
            }
          : mergedQueuedItem && span.span_id === mergedQueuedItem.request.span_id && span.revision === mergedQueuedItem.request.revision
            ? {
                ...span,
                source_caption: mergedQueuedItem.request.source_caption,
                updated_at_ms: Date.now(),
              }
          : span,
      );
      spansRef.current = nextSpans;
      return nextSpans;
    });
    recordDebug("translation.wait", "Continuous translation is waiting for more source context", "debug", {
      merged_span_id: mergedQueuedItem?.request.span_id ?? null,
      pending_source_length: (continuousWaitPrefixRef.current ?? mergedQueuedItem?.request.source_caption ?? "").length,
      reason: event.reason,
      span_id: event.span_id,
      translation_client_request_id: event.client_request_id ?? null,
    });
    flushContinuousTranslationQueueRef.current();
  }

  function handleTranslationDeltaEvent(event: TranslationDeltaEvent, key: string): void {
    markFirstTranslatedToken(key);
    setSpans((current) => {
      const nextSpans = current.map((span) =>
        span.span_id === event.span_id && span.revision === event.revision
          ? {
              ...span,
              partial_translated_caption: event.draft_text ?? `${span.partial_translated_caption ?? ""}${event.delta}`,
              translated_caption: event.draft_text ?? `${span.translated_caption}${event.delta}`,
              translation_client_request_id: event.client_request_id ?? span.translation_client_request_id,
              translation_request_id: event.translation_request_id,
              updated_at_ms: Date.now(),
            }
          : span,
      );
      spansRef.current = nextSpans;
      return nextSpans;
    });
  }

  function handleTranslationDoneEvent(
    event: TranslationDoneEvent,
    currentSpan: TranslationSpan,
    key: string,
  ): void {
    setError((current) =>
      current === "translation_timeout" ||
      current === "translation_transport_error" ||
      current === "translation_transport_reconnecting"
        ? null
        : current,
    );
    recordElapsedLatency("translation_done", translationStartedAtRef.current.get(key), recordLatency);
    clearTranslationTracking(key);
    continuousTranslationSchedulerRef.current.complete(key);
    flushContinuousTranslationQueueRef.current();
    setSpans((current) => {
      const nextSpans = current.map((item) =>
        item.span_id === event.span_id && item.revision === event.revision
          ? {
              ...item,
              status: "committed" as const,
              committed_translated_caption: event.translated_caption,
              partial_translated_caption: null,
              provider_metadata: event.provider_metadata,
              translated_caption: event.translated_caption,
              translation_client_request_id: event.client_request_id ?? item.translation_client_request_id,
              translation_request_id: event.translation_request_id,
              updated_at_ms: Date.now(),
            }
          : item,
      );
      spansRef.current = nextSpans;
      return nextSpans;
    });
    if (sessionRef.current.translation_mode === "continuous") {
      appendCommittedContinuousSpan(currentSpan, event.translated_caption);
      recordLatency("rolling_memory_appended", 0);
      scheduleContinuousSummary();
      recordDebug("speech.deferred_continuous", "Speech playback skipped in Continuous Mode to keep text translation on the critical path", "debug", {
        span_id: currentSpan.span_id,
      });
      return;
    }
    void speakSpan(currentSpan, event.translated_caption);
  }

  function applyTranslationRetry(
    event: TranslationErrorEvent,
    retry: ContinuousTranslationRetryResult & { exhausted: false },
  ): void {
    retry.item.request = withRetryClientRequestId(retry.item.request);
    setSpans((current) => {
      const nextSpans = current.map((span) =>
        span.span_id === event.span_id && span.revision === event.revision
          ? resetSpanForContinuousRetry(span, retry.item.request)
          : span,
      );
      spansRef.current = nextSpans;
      return nextSpans;
    });
    recordDebug("translation.retry_scheduled", "Continuous translation retry scheduled", "warn", {
      error_code: event.error_code,
      retry_delay_ms: retry.retry_delay_ms,
      span_id: event.span_id,
      translation_client_request_id: retry.item.request.client_request_id ?? null,
      translation_attempt: retry.item.request.translation_attempt,
    });
    scheduleContinuousTranslationFlush(retry.retry_delay_ms);
  }

  function handleTranslationErrorEvent(event: TranslationErrorEvent, key: string): void {
    clearTranslationTracking(key);
    if (sessionRef.current.translation_mode === "continuous") {
      const retry = continuousTranslationSchedulerRef.current.fail(key, event.retryable);
      if (!retry.exhausted) {
        applyTranslationRetry(event, retry);
        return;
      }
      flushContinuousTranslationQueueRef.current();
    }
    setError(event.error_code);
    setSpans((current) => {
      const nextSpans = current.map((span) =>
        span.span_id === event.span_id && span.revision === event.revision
          ? {
              ...span,
              status: "failed" as const,
              translation_client_request_id: event.client_request_id ?? span.translation_client_request_id,
              translation_request_id: event.translation_request_id,
              updated_at_ms: Date.now(),
            }
          : span,
      );
      spansRef.current = nextSpans;
      return nextSpans;
    });
  }

  function prepareTranslationEvent(event: TranslationServerEvent): { currentSpan: TranslationSpan; key: string } | null {
    if (!shouldAcceptTranslationEvent(sessionRef.current, event)) {
      recordIgnoredStaleTranslationEvent(event);
      return null;
    }

    const key = spanKey(event.span_id, event.revision);
    const currentSpan = getTranslatingSpanForEvent(event);
    if (!currentSpan) {
      return null;
    }
    if (!acceptTranslationEventSeq(event, key)) {
      return null;
    }

    recordTranslationEvent(event);
    return { currentSpan, key };
  }

  function recordIgnoredStaleTranslationEvent(event: TranslationServerEvent): void {
    recordDebug("translation.event_ignored", "Translation event ignored because it is stale for this session", "debug", {
      connection_id: "connection_id" in event ? event.connection_id ?? null : null,
      kind: event.kind,
      session_epoch: "session_epoch" in event ? event.session_epoch : null,
      span_id: "span_id" in event ? event.span_id : null,
    });
  }

  function dispatchTranslationEvent(
    event: TranslationServerEvent,
    currentSpan: TranslationSpan,
    key: string,
  ): void {
    switch (event.kind) {
      case "translation_wait":
        handleTranslationWaitEvent(event, currentSpan, key);
        return;
      case "translation_delta":
        handleTranslationDeltaEvent(event, key);
        return;
      case "translation_done":
        handleTranslationDoneEvent(event, currentSpan, key);
        return;
      case "translation_error":
        handleTranslationErrorEvent(event, key);
    }
  }

  const handleTranslationEvent = useCallback((event: TranslationServerEvent) => {
    const prepared = prepareTranslationEvent(event);
    if (!prepared) {
      return;
    }
    dispatchTranslationEvent(event, prepared.currentSpan, prepared.key);
  }, [recordDebug, recordLatency, scheduleContinuousSummary, scheduleContinuousTranslationFlush]);

  const speakSpan = useCallback(
    async (span: TranslationSpan, translatedCaption: string) => {
      const speech = speechRef.current;
      if (!speech) {
        recordDebug("speech.unavailable", "No Cartesia speech client is available for committed span", "warn", {
          span_id: span.span_id,
        });
        setSpans((current) =>
          current.map((item) =>
            item.span_id === span.span_id
              ? {
                  ...item,
                  speech_status: "speech_unavailable",
                  updated_at_ms: Date.now(),
                }
              : item,
          ),
        );
        return;
      }
      setSpans((current) =>
        current.map((item) =>
          item.span_id === span.span_id
            ? {
                ...item,
                speech_attempt: item.speech_attempt + 1,
                speech_status: "generating",
                updated_at_ms: Date.now(),
              }
            : item,
        ),
      );
      recordLatency("stable_phrase_sent_to_cartesia", 0);
      const speechRequestId = speech.speak(translatedCaption);
      recordDebug("speech.requested", "Committed translation sent to Cartesia for playback", "info", {
        speech_request_id: speechRequestId,
        span_id: span.span_id,
        translated_length: translatedCaption.length,
      });
      setSpans((current) =>
        current.map((item) =>
          item.span_id === span.span_id
            ? {
                ...item,
                speech_request_id: speechRequestId,
                speech_status: "playing",
                updated_at_ms: Date.now(),
              }
            : item,
        ),
      );
    },
    [recordDebug, recordLatency],
  );

  const refreshProviderTokens = useCallback(async () => {
    if (!isActiveOrRecoveringSession(sessionRef.current.state)) {
      return;
    }

    const appInstallId = await getOrCreateInstallId();
    const deviceIntegrity = await collectDeviceIntegrity({
      appInstallId,
      sourceLanguage: sessionRef.current.source_language,
      targetLanguage: sessionRef.current.target_language,
    });
    const refreshed = await refreshWorkerSessionTokens({
      app_install_id: appInstallId,
      app_session_id: sessionRef.current.identity.app_session_id,
      device_integrity: deviceIntegrity,
      session_epoch: sessionRef.current.identity.session_epoch,
      source_language: sessionRef.current.source_language,
      target_language: sessionRef.current.target_language,
      translation_mode: sessionRef.current.translation_mode,
    }).catch(() => ({ error: "worker_session_network_error" }));

    if ("error" in refreshed) {
      const retryDelayMs = nextTokenRefreshRetryDelayMs(tokenRefreshRetryCountRef.current);
      tokenRefreshRetryCountRef.current += 1;
      if (retryDelayMs !== null) {
        recordDebug("tokens.refresh_retrying", "Provider token refresh failed; retry scheduled", "warn", {
          error: refreshed.error,
          retry_attempt: tokenRefreshRetryCountRef.current,
          retry_delay_ms: retryDelayMs,
        });
        setError(`provider_token_refresh_retrying:${refreshed.error}`);
        setStatus("network_degraded");
        scheduleTokenRefreshRetry({
          refresh: refreshProviderTokens,
          retryInMs: retryDelayMs,
          timeoutRef: tokenRefreshTimeoutRef,
        });
        return;
      }

      recordDebug("tokens.refresh_failed", "Provider token refresh failed after retries", "error", {
        error: refreshed.error,
        retry_attempts: tokenRefreshRetryCountRef.current,
      });
      setError(`provider_token_refresh_failed:${refreshed.error}`);
      echoGateUntilMsRef.current = 0;
      echoGateDroppedFrameCountRef.current = 0;
      echoGateWindowStartedAtMsRef.current = null;
      echoGateLoggedRef.current = false;
      clearContinuousTranslationRuntime();
      clearDeepgramKeepAlive(deepgramKeepAliveRef);
      clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
      clearTokenRefresh(tokenRefreshTimeoutRef);
      deepgramRef.current?.close();
      speechRef.current?.close();
      translationRef.current?.stopSession(
        "token_refresh_failed",
        sessionRef.current.identity.app_session_id,
      );
      await MurmurAudioModule.stopCapture("token_refresh_failed");
      await MurmurAudioModule.clearPlayback("token_refresh_failed");
      await closeWorkerSession(sessionRef.current.identity.app_session_id, "token_refresh_failed");
      setStatus("transport_disconnected");
      return;
    }

    tokenRefreshRetryCountRef.current = 0;
    setError((current) => current?.startsWith("provider_token_refresh_retrying") ? null : current);
    updateSession((current) => ({
      ...current,
      identity: {
        ...current.identity,
        connection_id: createConnectionId(),
        session_epoch: refreshed.session_epoch,
        token_bundle_id: refreshed.tokens.token_bundle_id,
      },
    }));
    recordDebug("tokens.refreshed", "Provider tokens refreshed and realtime clients are reconnecting", "info", {
      cartesia_enabled: Boolean(refreshed.tokens.cartesia_access_token && refreshed.speech?.default_voice_id),
      session_epoch: refreshed.session_epoch,
      token_bundle_id: refreshed.tokens.token_bundle_id,
    });

    deepgramRef.current?.close();
    deepgramRef.current = new DeepgramLiveClient({
      language: getDeepgramClientLanguage(sessionRef.current.source_language),
      onEvent: handleDeepgramEvent,
      token: refreshed.tokens.deepgram_token,
      url: refreshed.deepgram_ws_url,
    });
    deepgramRef.current.connect();

    if (refreshed.tokens.cartesia_access_token && refreshed.speech?.default_voice_id) {
      speechRef.current?.close();
      speechRef.current = new CartesiaSpeechClient({
        accessToken: refreshed.tokens.cartesia_access_token,
        language: getLanguage(sessionRef.current.target_language),
        onSpeechUnavailable: (reason) => {
          recordDebug("speech.unavailable", "Cartesia speech reported unavailable", "error", { reason });
          setError(`speech_unavailable:${reason}`);
        },
        voiceId: refreshed.speech.default_voice_id,
      });
      speechRef.current.connect();
    } else {
      speechRef.current?.close();
      speechRef.current = null;
    }

    scheduleTokenRefresh({
      expiresAtMs: refreshed.tokens.expires_at_ms,
      refresh: refreshProviderTokens,
      timeoutRef: tokenRefreshTimeoutRef,
    });
  }, [clearContinuousTranslationRuntime, handleDeepgramEvent, recordDebug, setStatus, updateSession]);

  function resetStartRuntime(freshSession: TranslationSession): void {
    resetSession(freshSession);
    setError(null);
    setReportError(null);
    setReportReceiptId(null);
    setLatencySamples([]);
    setDebugLog([]);
    recordDebug("session.starting", "Live translation session state reset", "info", {
      source_language: params.source_language,
      target_language: params.target_language,
      translation_model_route: normalizedParams.translation_model_route ?? "worker_default",
    });
    echoGateUntilMsRef.current = 0;
    echoGateDroppedFrameCountRef.current = 0;
    echoGateWindowStartedAtMsRef.current = null;
    echoGateLoggedRef.current = false;
    tokenRefreshRetryCountRef.current = 0;
    clearContinuousTranslationRuntime();
    continuousMemoryRef.current = createContinuousMemoryState();
    continuousStabilizerRef.current.reset();
    firstTranscriptSeenRef.current = false;
    localSpeechStartedAtRef.current = null;
    hasSpeechSinceFinalizeRef.current = false;
    lastCommittedSourceCaptionRef.current = null;
    speechStartedAtRef.current = null;
    updateTentativeSourceCaption("");
    setSpans([]);
  }

  async function requestWorkerSessionForStart(): Promise<
    | {
        deviceIntegrity: Awaited<ReturnType<typeof collectDeviceIntegrity>>;
        workerSession: CreateSessionResponse;
        workerSessionHttpMs: number;
      }
    | null
  > {
    setStatus("requesting_mic_permission");
    const granted = await requestMicrophonePermission();
    if (!granted) {
      recordDebug("mic.permission_denied", "Microphone permission was denied", "error");
      setError("microphone_permission_denied");
      setStatus("failed");
      return null;
    }

    setStatus("creating_session");
    const installIdentityStartedAt = Date.now();
    const appInstallId = await getOrCreateInstallId();
    recordLatency("install_identity_ready", Date.now() - installIdentityStartedAt);
    const deviceIntegrityStartedAt = Date.now();
    const deviceIntegrity = await collectDeviceIntegrity({
      appInstallId,
      sourceLanguage: params.source_language,
      targetLanguage: params.target_language,
    });
    recordLatency("device_integrity_collected", Date.now() - deviceIntegrityStartedAt);
    const sessionStartedAt = Date.now();
    const workerSession = await createWorkerSession({
      app_install_id: appInstallId,
      device_integrity: deviceIntegrity,
      source_language: params.source_language,
      target_language: params.target_language,
      translation_model_route: normalizedParams.translation_model_route,
      translation_mode: normalizedParams.translation_mode,
      ultravox_vad_enabled: normalizedParams.ultravox_vad_enabled,
    }).catch(() => ({ error: "worker_session_network_error" }));

    if ("error" in workerSession) {
      recordDebug("session.create_failed", "Worker session creation failed", "error", {
        error: workerSession.error,
      });
      setError(workerSession.error);
      setStatus("failed");
      return null;
    }
    const workerSessionHttpMs = Date.now() - sessionStartedAt;
    return { deviceIntegrity, workerSession, workerSessionHttpMs };
  }

  function applyWorkerSessionToState(
    workerSession: CreateSessionResponse,
    deviceIntegrity: Awaited<ReturnType<typeof collectDeviceIntegrity>>,
    workerSessionHttpMs: number,
  ): void {
    recordLatency("worker_session_http", workerSessionHttpMs);
    recordLatency("session_create", workerSessionHttpMs);
    recordDebug("session.created", "Worker session created", "info", {
      app_session_id: workerSession.app_session_id,
      cartesia_enabled: Boolean(workerSession.tokens.cartesia_access_token && workerSession.speech?.default_voice_id),
      device_integrity_available: deviceIntegrity.available,
      session_epoch: workerSession.session_epoch,
      translation_model_route: workerSession.translation_model_route ?? "worker_default",
      token_bundle_id: workerSession.tokens.token_bundle_id,
      worker_session_http_ms: workerSessionHttpMs,
    });

    updateSession((current) => ({
      ...current,
      translation_model_route: workerSession.translation_model_route,
      identity: {
        ...current.identity,
        app_session_id: workerSession.app_session_id,
        session_epoch: workerSession.session_epoch,
        token_bundle_id: workerSession.tokens.token_bundle_id,
      },
    }));
  }

  async function startUltravoxMicCapture(ultravox: NonNullable<CreateSessionResponse["ultravox"]>): Promise<boolean> {
    const micStartedAt = Date.now();
    try {
      await MurmurAudioModule.startCapture();
    } catch {
      recordDebug("mic.start_failed", "Native microphone capture failed to start", "error");
      setError("microphone_start_failed");
      setStatus("failed");
      ultravoxRef.current?.close();
      await closeWorkerSession(sessionRef.current.identity.app_session_id, "mic_start_failed");
      return false;
    }
    recordLatency("mic_capture_started", Date.now() - micStartedAt);
    recordDebug("mic.started", "Native microphone capture started for Ultravox replacement", "info", {
      ultravox_call_id: ultravox.call_id,
      ultravox_vad_enabled: ultravox.vad_enabled,
      ultravox_vad_profile: ultravox.vad_profile,
    });
    setStatus("live");
    return true;
  }

  async function connectUltravoxSession(workerSession: CreateSessionResponse): Promise<boolean> {
    if (!workerSession.ultravox?.join_url) {
      recordDebug("ultravox.session_missing_join_url", "Ultravox session did not include a join URL", "error");
      setError("ultravox_join_url_missing");
      setStatus("failed");
      return false;
    }

    setStatus("connecting_ultravox");
    translationSocketOpenRef.current = true;
    ultravoxAgentDraftByOrdinalRef.current.clear();
    ultravoxSpanKeyByOrdinalRef.current.clear();
    ultravoxUserTextByOrdinalRef.current.clear();
    ultravoxRef.current = new UltravoxLiveClient({
      onEvent: handleUltravoxEvent,
      url: workerSession.ultravox.join_url,
    });
    ultravoxRef.current.connect();
    return startUltravoxMicCapture(workerSession.ultravox);
  }

  function handleTranslationSocketStatus(status: string): void {
    recordDebug("translation.socket", `Translation socket ${status}`, status === "error" ? "error" : "debug");
    translationStatusHandlers[status]?.();
  }

  const translationStatusHandlers: Record<string, () => void> = {
    close: () => {
      translationSocketOpenRef.current = false;
      requeueActiveContinuousTranslations("socket_close");
    },
    error: () => {
      translationSocketOpenRef.current = false;
      setError("translation_transport_error");
      setStatus("network_degraded");
    },
    open: () => {
      translationSocketOpenRef.current = true;
      setError((current) => current?.startsWith("translation_transport") ? null : current);
      restoreLiveStatusAfterTranslationReconnect();
      flushContinuousTranslationQueueRef.current();
    },
    reconnecting: () => {
      translationSocketOpenRef.current = false;
      requeueActiveContinuousTranslations("socket_reconnecting");
      setError("translation_transport_reconnecting");
      setStatus("recovering");
    },
  };

  function restoreLiveStatusAfterTranslationReconnect(): void {
    if (
      sessionRef.current.state === "network_degraded" ||
      sessionRef.current.state === "recovering" ||
      sessionRef.current.state === "transport_disconnected"
    ) {
      setStatus("live");
    }
  }

  function connectProviderClients(workerSession: CreateSessionResponse): boolean {
    if (!workerSession.translate_ws_url || !workerSession.deepgram_ws_url) {
      recordDebug("session.missing_provider_url", "Worker session response was missing provider WebSocket URLs", "error");
      setError("worker_session_missing_provider_url");
      setStatus("failed");
      return false;
    }

    setStatus("connecting_translate_ws");
    translationRef.current = new MurmurTranslationClient({
      onEvent: handleTranslationEvent,
      onStatus: handleTranslationSocketStatus,
      url: workerSession.translate_ws_url,
    });
    translationRef.current.connect();

    setStatus("connecting_deepgram");
    deepgramRef.current = new DeepgramLiveClient({
      language: getDeepgramClientLanguage(params.source_language),
      onEvent: handleDeepgramEvent,
      token: workerSession.tokens.deepgram_token,
      url: workerSession.deepgram_ws_url,
    });
    deepgramRef.current.connect();

    if (workerSession.tokens.cartesia_access_token && workerSession.speech?.default_voice_id) {
      speechRef.current = new CartesiaSpeechClient({
        accessToken: workerSession.tokens.cartesia_access_token,
        language: getLanguage(params.target_language),
        onSpeechUnavailable: (reason) => {
          recordDebug("speech.unavailable", "Cartesia speech reported unavailable", "error", { reason });
          setError(`speech_unavailable:${reason}`);
        },
        voiceId: workerSession.speech.default_voice_id,
      });
      speechRef.current.connect();
    } else {
      speechRef.current = null;
    }
    return true;
  }

  async function startProviderMicCapture(): Promise<boolean> {
    const micStartedAt = Date.now();
    try {
      await MurmurAudioModule.startCapture();
    } catch {
      recordDebug("mic.start_failed", "Native microphone capture failed to start", "error");
      setError("microphone_start_failed");
      setStatus("failed");
      echoGateUntilMsRef.current = 0;
      echoGateLoggedRef.current = false;
      deepgramRef.current?.close();
      speechRef.current?.close();
      translationRef.current?.stopSession("mic_start_failed", sessionRef.current.identity.app_session_id);
      clearDeepgramKeepAlive(deepgramKeepAliveRef);
      clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
      await closeWorkerSession(sessionRef.current.identity.app_session_id, "mic_start_failed");
      return false;
    }
    startDeepgramKeepAlive(deepgramRef, deepgramKeepAliveRef);
    recordLatency("mic_capture_started", Date.now() - micStartedAt);
    recordDebug("mic.started", "Native microphone capture started", "info");
    setStatus("live");
    return true;
  }

  const start = useCallback(async () => {
    if (!canStartSession(sessionRef.current.state)) {
      return;
    }

    const freshSession = createSession(normalizedParams);
    resetStartRuntime(freshSession);
    const created = await requestWorkerSessionForStart();
    if (!created) {
      return;
    }
    applyWorkerSessionToState(created.workerSession, created.deviceIntegrity, created.workerSessionHttpMs);

    if (isUltravoxReplacementRoute(created.workerSession.translation_model_route ?? normalizedParams.translation_model_route)) {
      await connectUltravoxSession(created.workerSession);
      return;
    }

    if (!connectProviderClients(created.workerSession)) {
      return;
    }
    if (!(await startProviderMicCapture())) {
      return;
    }
    scheduleTokenRefresh({
      expiresAtMs: created.workerSession.tokens.expires_at_ms,
      refresh: refreshProviderTokens,
      timeoutRef: tokenRefreshTimeoutRef,
    });
  }, [
    clearContinuousTranslationRuntime,
    handleDeepgramEvent,
    handleUltravoxEvent,
    handleTranslationEvent,
    normalizedParams.translation_mode,
    normalizedParams.translation_model_route,
    normalizedParams.ultravox_vad_enabled,
    params.source_language,
    params.target_language,
    recordDebug,
    recordLatency,
    requeueActiveContinuousTranslations,
    resetSession,
    refreshProviderTokens,
    setStatus,
    updateSession,
  ]);

  const stop = useCallback(async () => {
    if (!isActiveOrRecoveringSession(sessionRef.current.state)) {
      return;
    }
    setStatus("stopping");
    recordDebug("session.stop_requested", "User requested stop", "info", {
      app_session_id: sessionRef.current.identity.app_session_id,
      span_count: spansRef.current.length,
    });
    clearSessionRuntimeBeforeEnd();
    translationRef.current?.stopSession("user_stop", sessionRef.current.identity.app_session_id);
    await MurmurAudioModule.stopCapture("user_stop");
    await MurmurAudioModule.clearPlayback("user_stop");
    await closeWorkerSession(sessionRef.current.identity.app_session_id, "user_stop");
    setStatus("ended");
    recordDebug("session.ended", "Live translation session ended", "info");
  }, [clearContinuousTranslationRuntime, recordDebug, setStatus]);

  const cancel = useCallback(async () => {
    if (sessionRef.current.state === "idle") {
      recordDebug("session.cancel_idle", "Cancel requested while session was idle", "debug");
      lastCommittedSourceCaptionRef.current = null;
      resetEchoGateRuntime();
      clearContinuousTranslationRuntime();
      updateTentativeSourceCaption("");
      setSpans([]);
      return;
    }
    setStatus("cancelling");
    recordDebug("session.cancel_requested", "User requested cancel", "info", {
      app_session_id: sessionRef.current.identity.app_session_id,
      span_count: spansRef.current.length,
    });
    clearSessionRuntimeBeforeEnd();
    translationRef.current?.cancelSession("user_cancel", sessionRef.current.identity.app_session_id);
    await MurmurAudioModule.stopCapture("user_cancel");
    await MurmurAudioModule.clearPlayback("user_cancel");
    await closeWorkerSession(sessionRef.current.identity.app_session_id, "user_cancel");
    continuousMemoryRef.current = createContinuousMemoryState();
    continuousStabilizerRef.current.reset();
    ultravoxAgentDraftByOrdinalRef.current.clear();
    ultravoxLocalVadUntilMsRef.current = 0;
    ultravoxSpanKeyByOrdinalRef.current.clear();
    ultravoxUserTextByOrdinalRef.current.clear();
    firstTranscriptSeenRef.current = false;
    localSpeechStartedAtRef.current = null;
    hasSpeechSinceFinalizeRef.current = false;
    lastCommittedSourceCaptionRef.current = null;
    speechStartedAtRef.current = null;
    updateTentativeSourceCaption("");
    setSpans([]);
    setStatus("idle");
    recordDebug("session.cancelled", "Live translation session cancelled", "info");
  }, [clearContinuousTranslationRuntime, recordDebug, setStatus, updateTentativeSourceCaption]);

  function resetEchoGateRuntime(): void {
    echoGateUntilMsRef.current = 0;
    echoGateDroppedFrameCountRef.current = 0;
    echoGateWindowStartedAtMsRef.current = null;
    echoGateLoggedRef.current = false;
  }

  function clearSessionRuntimeBeforeEnd(): void {
    clearDeepgramKeepAlive(deepgramKeepAliveRef);
    clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
    clearTokenRefresh(tokenRefreshTimeoutRef);
    tokenRefreshRetryCountRef.current = 0;
    resetEchoGateRuntime();
    clearContinuousTranslationRuntime();
    hasSpeechSinceFinalizeRef.current = false;
    firstTranscriptSeenRef.current = false;
    localSpeechStartedAtRef.current = null;
    speechStartedAtRef.current = null;
    deepgramRef.current?.close();
    speechRef.current?.close();
    ultravoxRef.current?.close();
  }

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (!isActiveOrRecoveringSession(sessionRef.current.state)) {
        return;
      }
      if (nextState === "active") {
        recordDebugRef.current("session.foregrounded", "App returned to foreground; live session preserved", "info", {
          session_state: sessionRef.current.state,
        });
        return;
      }
      recordDebugRef.current("session.backgrounded", "App moved to background; live session remains active", "info", {
        app_state: nextState,
        session_state: sessionRef.current.state,
      });
    });
    return () => subscription.remove();
  }, []);

  const reportSpan = useCallback(
    async (
      span: TranslationSpan,
      category: ReportTranslationCategory,
      includeSnapshots = false,
    ) => {
      setReportError(null);
      recordDebug("report.requested", "Translation report requested", "info", {
        category,
        include_snapshots: includeSnapshots,
        span_id: span.span_id,
      });
      const result = await reportTranslation({
        app_session_id: sessionRef.current.identity.app_session_id,
        error_category: category,
        optional_source_text_snapshot: includeSnapshots ? span.source_caption : undefined,
        optional_translated_text_snapshot: includeSnapshots
          ? span.committed_translated_caption ?? span.translated_caption
          : undefined,
        provider_metadata: span.provider_metadata ?? undefined,
        revision: span.revision,
        source_language: sessionRef.current.source_language,
        span_id: span.span_id,
        target_language: sessionRef.current.target_language,
      });
      if ("error" in result) {
        recordDebug("report.failed", "Translation report failed", "error", {
          error: result.error,
          span_id: span.span_id,
        });
        setReportError(result.error);
        return;
      }
      recordDebug("report.created", "Translation report receipt created", "info", {
        report_id: result.report_id,
        span_id: span.span_id,
      });
      setReportReceiptId(result.report_id);
    },
    [recordDebug],
  );

  const diagnosticsSnapshot = buildLiveTranslationDiagnosticsSnapshot({
    continuousMemory: continuousMemoryRef.current,
    lastCommittedSourceCaption: lastCommittedSourceCaptionRef.current,
    pendingWaitPrefix: continuousWaitPrefixRef.current,
    scheduler: continuousTranslationSchedulerRef.current.snapshot(),
    tentativeSourceCaption,
    translationSocketOpen: translationSocketOpenRef.current,
  });

  return {
    cancel,
    debug_log: debugLog,
    diagnostics_snapshot: diagnosticsSnapshot,
    error,
    latency_report: summarizeLatency(latencySamples),
    latency_samples: latencySamples,
    report_error: reportError,
    report_receipt_id: reportReceiptId,
    reportSpan,
    session,
    spans,
    start,
    status: session.state,
    stop,
    tentative_source_caption: tentativeSourceCaption,
  };
}
