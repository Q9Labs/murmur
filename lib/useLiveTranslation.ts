import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import type { AppStateStatus } from "react-native";

import MurmurAudioModule, {
  type AudioFrameEvent,
  type AudioStateEvent,
  type DeviceIntegrityPayload,
} from "../modules/murmur-audio";
import { getWorkerBaseUrl } from "./config";
import {
  appendRollingMemorySpan,
  applySummaryResult,
  createContinuousMemoryState,
  selectSpansForSummary,
  shouldScheduleSummary,
  trimRollingMemoryForPrompt,
  type ContinuousMemoryState,
} from "./continuousMemory";
import { ContinuousSpanStabilizer } from "./continuousStabilizer";
import { getOrCreateInstallId } from "./installIdentity";
import { summarizeLatency, type DebugLogEntry, type LatencyReport, type LatencySample } from "./latency";
import { autoSourceLanguageCode, getLanguage, type LanguageCode, type SourceLanguageCode } from "./languages";
import { CartesiaSpeechClient } from "./providers/cartesia";
import { DeepgramLiveClient, type DeepgramClientEvent } from "./providers/deepgram";
import { reportTranslation } from "./providers/reportTranslation";
import { MurmurTranslationClient } from "./providers/translation";
import { normalizeSummaryResponse } from "./summaryResponse";
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
} from "./session";
import type {
  CreateSessionResponse,
  RefreshSessionTokenResponse,
  ReportTranslationCategory,
  RollingMemorySpan,
  SessionSummary,
  SummaryResponse,
  TranslationServerEvent,
  TranslationMode,
} from "./transport/types";

const continuousContextSpanLimit = 10;

export type LiveTranslationState = {
  error: string | null;
  debug_log: DebugLogEntry[];
  latency_report: LatencyReport;
  latency_samples: LatencySample[];
  report_error: string | null;
  report_receipt_id: string | null;
  session: TranslationSession;
  spans: TranslationSpan[];
  status: SessionState;
  tentative_source_caption: string;
};

export type LiveTranslationController = LiveTranslationState & {
  cancel: () => Promise<void>;
  reportSpan: (
    span: TranslationSpan,
    category: ReportTranslationCategory,
    includeSnapshots?: boolean,
  ) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export function useLiveTranslation(params: {
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
  translation_mode?: TranslationMode;
}): LiveTranslationController {
  const normalizedParams = {
    ...params,
    translation_mode: params.translation_mode ?? ("phrase" as TranslationMode),
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
  const deepgramKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deepgramSilenceFinalizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continuousMemoryRef = useRef<ContinuousMemoryState>(createContinuousMemoryState());
  const continuousStabilizerRef = useRef(new ContinuousSpanStabilizer());
  const echoGateUntilMsRef = useRef(0);
  const tokenRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRefreshRetryCountRef = useRef(0);
  const echoGateLoggedRef = useRef(false);
  const firstTranslatedTokenSeenRef = useRef<Set<string>>(new Set());
  const firstPcmFrameSentAtRef = useRef<number | null>(null);
  const hasSpeechSinceFinalizeRef = useRef(false);
  const lastCommittedSourceCaptionRef = useRef<string | null>(null);
  const spansRef = useRef<TranslationSpan[]>([]);
  const sessionRef = useRef(session);
  const speechStartedAtRef = useRef<number | null>(null);
  const tentativeSourceCaptionRef = useRef("");
  const translationStartedAtRef = useRef<Map<string, number>>(new Map());

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
        ].slice(-300),
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
    lastCommittedSourceCaptionRef.current = null;
    setError(null);
    setReportError(null);
    setReportReceiptId(null);
    setLatencySamples([]);
    setDebugLog([]);
    continuousMemoryRef.current = createContinuousMemoryState();
    continuousStabilizerRef.current.reset();
  }, [params.source_language, params.target_language, normalizedParams.translation_mode, resetSession, updateTentativeSourceCaption]);

  useEffect(() => {
    const subscription = MurmurAudioModule.addListener(
      "onAudioFrame",
      (frame: AudioFrameEvent) => {
        if (shouldGateMicFrameForEcho(echoGateUntilMsRef.current)) {
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
        echoGateLoggedRef.current = false;
        if (firstPcmFrameSentAtRef.current === null) {
          firstPcmFrameSentAtRef.current = Date.now();
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
      deepgramRef.current?.close();
      speechRef.current?.close();
      translationRef.current?.close();
      void MurmurAudioModule.stopCapture("hook_unmount");
      void MurmurAudioModule.clearPlayback("hook_unmount");
    };
  }, []);

  useEffect(() => {
    const subscription = MurmurAudioModule.addListener(
      "onAudioState",
      (audioState: AudioStateEvent) => {
        if (audioState.playback_active) {
          echoGateUntilMsRef.current = nextEchoGateUntilMs(audioState.playback_queued_ms);
          recordDebugRef.current("audio.playback_active", "Native speech playback became active", "info", {
            echo_gate_until_ms: echoGateUntilMsRef.current,
            playback_queued_ms: audioState.playback_queued_ms,
            reason: audioState.reason,
          });
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
    setLatencySamples((current) => [...current, { name, value_ms }].slice(-500));
  }, []);
  const recordLatencyRef = useRef(recordLatency);
  const recordDebugRef = useRef(recordDebug);

  useEffect(() => {
    recordLatencyRef.current = recordLatency;
  }, [recordLatency]);

  useEffect(() => {
    recordDebugRef.current = recordDebug;
  }, [recordDebug]);

  const commitStableSourceCaption = useCallback((sourceCaption: string, options?: {
    latencyEvent?: string;
    latencyStartedAtMs?: number | null;
    stableStartedAtMs?: number | null;
  }) => {
    const normalizedCaption = normalizeCaption(sourceCaption);
    if (!normalizedCaption || normalizeCaption(lastCommittedSourceCaptionRef.current ?? "") === normalizedCaption) {
      recordDebug("span.commit_skipped", "Stable source caption was empty or duplicated", "debug", {
        duplicate: Boolean(normalizedCaption),
        source_length: sourceCaption.length,
      });
      return;
    }

    updateTentativeSourceCaption("");
    lastCommittedSourceCaptionRef.current = normalizedCaption;
    const span = createSpan(sourceCaption);
    recordDebug("span.committed", "Stable source caption committed for translation", "info", {
      revision: span.revision,
      source_length: sourceCaption.length,
      span_id: span.span_id,
    });
    recordElapsedLatency(options?.latencyEvent, options?.latencyStartedAtMs ?? undefined, recordLatency);
    recordElapsedLatency("stable_span_emitted", options?.stableStartedAtMs ?? undefined, recordLatency);
    setSpans((current) => {
      const nextSpans = [...current, { ...span, status: "translating" as const }];
      spansRef.current = nextSpans;
      return nextSpans;
    });
    translationStartedAtRef.current.set(spanKey(span.span_id, span.revision), Date.now());
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
    translationRef.current?.translate({
      app_session_id: nextSession.identity.app_session_id,
      connection_id: nextSession.identity.connection_id,
      context_spans: rollingContext,
      context_summary: nextSession.translation_mode === "continuous" ? memory.summary.text || null : null,
      event_seq: nextSession.identity.event_seq,
      revision: span.revision,
      session_epoch: nextSession.identity.session_epoch,
      source_caption: span.source_caption,
      source_language: nextSession.source_language,
      span_id: span.span_id,
      target_language: nextSession.target_language,
      translation_mode: nextSession.translation_mode,
      translation_attempt: span.translation_attempt + 1,
    });
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

  const handleDeepgramEvent = useCallback((event: DeepgramClientEvent) => {
    if (!shouldAcceptDeepgramEvent(sessionRef.current.state)) {
      recordDebug("deepgram.event_ignored", "Deepgram event ignored because session is not active", "debug", {
        session_state: sessionRef.current.state,
        type: event.type,
      });
      return;
    }

    recordDebug("deepgram.event", `Deepgram ${event.type} event received`, event.type === "error" && event.reason !== "deepgram_backpressure" ? "error" : "debug", {
      final: event.type === "transcript" ? event.is_final : null,
      reason: "reason" in event ? event.reason : null,
      speech_final: event.type === "transcript" ? event.speech_final : null,
      transcript_length: event.type === "transcript" ? event.transcript.length : null,
    });

    if (event.type === "utterance_end") {
      hasSpeechSinceFinalizeRef.current = false;
      clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
      const sttStartedAt = getCurrentSttStartedAt(speechStartedAtRef, firstPcmFrameSentAtRef);
      if (sessionRef.current.translation_mode === "continuous") {
        for (const span of continuousStabilizerRef.current.acceptTranscript(tentativeSourceCaptionRef.current, true)) {
          commitStableSourceCaption(span.source_caption, {
            latencyEvent: "deepgram_utterance_end_received",
            latencyStartedAtMs: sttStartedAt,
            stableStartedAtMs: sttStartedAt,
          });
        }
        continuousStabilizerRef.current.reset();
        updateTentativeSourceCaption("");
      } else {
        commitStableSourceCaption(tentativeSourceCaptionRef.current, {
          latencyEvent: "deepgram_utterance_end_received",
          latencyStartedAtMs: sttStartedAt,
          stableStartedAtMs: sttStartedAt,
        });
      }
      resetCurrentSttTiming(speechStartedAtRef, firstPcmFrameSentAtRef);
      return;
    }

    if (event.type === "speech_started") {
      hasSpeechSinceFinalizeRef.current = true;
      speechStartedAtRef.current = Date.now();
      if (sessionRef.current.translation_mode === "continuous") {
        continuousStabilizerRef.current.reset();
        updateTentativeSourceCaption("");
      }
      recordElapsedLatency("deepgram_speech_started", firstPcmFrameSentAtRef.current ?? undefined, recordLatency);
      clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
      return;
    }

    if (event.type === "error") {
      if (event.reason === "deepgram_backpressure") {
        recordDebug("deepgram.backpressure", "Deepgram send buffer is full; dropping stale mic frames until it drains", "warn");
        return;
      }
      setError(`deepgram:${event.reason}`);
      return;
    }

    if (event.type === "transcript") {
      const sttStartedAt = getCurrentSttStartedAt(speechStartedAtRef, firstPcmFrameSentAtRef);
      recordElapsedLatency(
        event.is_final || event.speech_final ? "deepgram_final_received" : "deepgram_interim_received",
        sttStartedAt,
        recordLatency,
      );
      if (sessionRef.current.translation_mode === "continuous") {
        const stableSpans = continuousStabilizerRef.current.acceptTranscript(
          event.transcript,
          event.is_final || event.speech_final,
        );
        for (const span of stableSpans) {
          commitStableSourceCaption(span.source_caption, {
            stableStartedAtMs: sttStartedAt,
          });
        }
        if (event.is_final || event.speech_final) {
          continuousStabilizerRef.current.reset();
          updateTentativeSourceCaption("");
          hasSpeechSinceFinalizeRef.current = false;
          clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
          resetCurrentSttTiming(speechStartedAtRef, firstPcmFrameSentAtRef);
        } else {
          updateTentativeSourceCaption(continuousStabilizerRef.current.getUnemittedText(event.transcript));
        }
        return;
      }

      if (!event.is_final && !event.speech_final) {
        updateTentativeSourceCaption(event.transcript);
        return;
      }
      hasSpeechSinceFinalizeRef.current = false;
      clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
      commitStableSourceCaption(event.transcript, {
        stableStartedAtMs: sttStartedAt,
      });
      resetCurrentSttTiming(speechStartedAtRef, firstPcmFrameSentAtRef);
    }
  }, [commitStableSourceCaption, recordDebug, recordLatency, updateTentativeSourceCaption]);

  const handleTranslationEvent = useCallback((event: TranslationServerEvent) => {
    if (!shouldAcceptTranslationEvent(sessionRef.current, event)) {
      recordDebug("translation.event_ignored", "Translation event ignored because it is stale for this session", "debug", {
        kind: event.kind,
        session_epoch: "session_epoch" in event ? event.session_epoch : null,
        span_id: "span_id" in event ? event.span_id : null,
      });
      return;
    }

    recordDebug("translation.event", `Translation ${event.kind} event received`, event.kind === "translation_error" ? "error" : "debug", {
      delta_length: event.kind === "translation_delta" ? event.delta.length : null,
      error_code: event.kind === "translation_error" ? event.error_code : null,
      span_id: "span_id" in event ? event.span_id : null,
      translation_request_id: "translation_request_id" in event ? event.translation_request_id : null,
    });

    if (event.kind === "translation_delta") {
      const key = spanKey(event.span_id, event.revision);
      if (!firstTranslatedTokenSeenRef.current.has(key)) {
        firstTranslatedTokenSeenRef.current.add(key);
        recordElapsedLatency("first_translated_token_returned", translationStartedAtRef.current.get(key), recordLatency);
      }
      setSpans((current) =>
        current.map((span) =>
          span.span_id === event.span_id && span.revision === event.revision
            ? {
                ...span,
                partial_translated_caption: event.draft_text ?? `${span.partial_translated_caption ?? ""}${event.delta}`,
                translated_caption: event.draft_text ?? `${span.translated_caption}${event.delta}`,
                translation_request_id: event.translation_request_id,
                updated_at_ms: Date.now(),
              }
            : span,
        ),
      );
      return;
    }

    if (event.kind === "translation_done") {
      const key = spanKey(event.span_id, event.revision);
      recordElapsedLatency("translation_done", translationStartedAtRef.current.get(key), recordLatency);
      translationStartedAtRef.current.delete(key);
      firstTranslatedTokenSeenRef.current.delete(key);
      const span = spansRef.current.find(
        (item) => item.span_id === event.span_id && item.revision === event.revision,
      );
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
                translation_request_id: event.translation_request_id,
                updated_at_ms: Date.now(),
              }
            : item,
        );
        spansRef.current = nextSpans;
        return nextSpans;
      });
      if (sessionRef.current.translation_mode === "continuous" && span) {
        continuousMemoryRef.current = appendRollingMemorySpan(continuousMemoryRef.current, {
          committed_at_ms: Date.now(),
          revision: event.revision,
          source_caption: span.source_caption,
          span_id: event.span_id,
          translated_caption: event.translated_caption,
        });
        recordLatency("rolling_memory_appended", 0);
        scheduleContinuousSummary();
      }
      if (span) {
        void speakSpan(span, event.translated_caption);
      }
      return;
    }

    if (event.kind === "translation_error") {
      translationStartedAtRef.current.delete(spanKey(event.span_id, event.revision));
      firstTranslatedTokenSeenRef.current.delete(spanKey(event.span_id, event.revision));
      setError(event.error_code);
      setSpans((current) =>
        current.map((span) =>
          span.span_id === event.span_id && span.revision === event.revision
            ? { ...span, status: "failed", updated_at_ms: Date.now() }
            : span,
        ),
      );
    }
  }, [recordDebug, recordLatency, scheduleContinuousSummary]);

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
      echoGateLoggedRef.current = false;
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
  }, [handleDeepgramEvent, recordDebug, setStatus, updateSession]);

  const start = useCallback(async () => {
    if (!canStartSession(sessionRef.current.state)) {
      return;
    }

    const freshSession = createSession(normalizedParams);
    resetSession(freshSession);
    setError(null);
    setReportError(null);
    setReportReceiptId(null);
    setLatencySamples([]);
    setDebugLog([]);
    recordDebug("session.starting", "Live translation session state reset", "info", {
      source_language: params.source_language,
      target_language: params.target_language,
    });
    echoGateUntilMsRef.current = 0;
    echoGateLoggedRef.current = false;
    tokenRefreshRetryCountRef.current = 0;
    firstTranslatedTokenSeenRef.current.clear();
    continuousMemoryRef.current = createContinuousMemoryState();
    continuousStabilizerRef.current.reset();
    firstPcmFrameSentAtRef.current = null;
    hasSpeechSinceFinalizeRef.current = false;
    lastCommittedSourceCaptionRef.current = null;
    speechStartedAtRef.current = null;
    translationStartedAtRef.current.clear();
    updateTentativeSourceCaption("");
    setSpans([]);
    setStatus("requesting_mic_permission");
    const granted = await requestMicrophonePermission();
    if (!granted) {
      recordDebug("mic.permission_denied", "Microphone permission was denied", "error");
      setError("microphone_permission_denied");
      setStatus("failed");
      return;
    }

    setStatus("creating_session");
    const appInstallId = await getOrCreateInstallId();
    const deviceIntegrity = await collectDeviceIntegrity({
      appInstallId,
      sourceLanguage: params.source_language,
      targetLanguage: params.target_language,
    });
    const sessionStartedAt = Date.now();
    const workerSession = await createWorkerSession({
      app_install_id: appInstallId,
      device_integrity: deviceIntegrity,
      source_language: params.source_language,
      target_language: params.target_language,
      translation_mode: normalizedParams.translation_mode,
    }).catch(() => ({ error: "worker_session_network_error" }));

    if ("error" in workerSession) {
      recordDebug("session.create_failed", "Worker session creation failed", "error", {
        error: workerSession.error,
      });
      setError(workerSession.error);
      setStatus("failed");
      return;
    }
    recordLatency("session_create", Date.now() - sessionStartedAt);
    recordDebug("session.created", "Worker session created", "info", {
      app_session_id: workerSession.app_session_id,
      cartesia_enabled: Boolean(workerSession.tokens.cartesia_access_token && workerSession.speech?.default_voice_id),
      session_epoch: workerSession.session_epoch,
      token_bundle_id: workerSession.tokens.token_bundle_id,
    });

    updateSession((current) => ({
      ...current,
      identity: {
        ...current.identity,
        app_session_id: workerSession.app_session_id,
        session_epoch: workerSession.session_epoch,
        token_bundle_id: workerSession.tokens.token_bundle_id,
      },
    }));

    setStatus("connecting_translate_ws");
    translationRef.current = new MurmurTranslationClient({
      onEvent: handleTranslationEvent,
      onStatus: (status) => {
        recordDebug("translation.socket", `Translation socket ${status}`, status === "error" ? "error" : "debug");
        if (status === "error") {
          setError("translation_transport_error");
          setStatus("network_degraded");
          return;
        }
        if (status === "reconnecting") {
          setError("translation_transport_reconnecting");
          setStatus("recovering");
          return;
        }
        if (status === "open") {
          setError((current) => current?.startsWith("translation_transport") ? null : current);
          if (
            sessionRef.current.state === "network_degraded" ||
            sessionRef.current.state === "recovering" ||
            sessionRef.current.state === "transport_disconnected"
          ) {
            setStatus("live");
          }
        }
      },
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
      return;
    }
    startDeepgramKeepAlive(deepgramRef, deepgramKeepAliveRef);
    recordLatency("mic_capture_started", Date.now() - micStartedAt);
    recordDebug("mic.started", "Native microphone capture started", "info");
    setStatus("live");
    scheduleTokenRefresh({
      expiresAtMs: workerSession.tokens.expires_at_ms,
      refresh: refreshProviderTokens,
      timeoutRef: tokenRefreshTimeoutRef,
    });
  }, [
    handleDeepgramEvent,
    handleTranslationEvent,
    normalizedParams.translation_mode,
    params.source_language,
    params.target_language,
    recordDebug,
    recordLatency,
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
    clearDeepgramKeepAlive(deepgramKeepAliveRef);
    clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
    clearTokenRefresh(tokenRefreshTimeoutRef);
    tokenRefreshRetryCountRef.current = 0;
    echoGateUntilMsRef.current = 0;
    echoGateLoggedRef.current = false;
    hasSpeechSinceFinalizeRef.current = false;
    firstPcmFrameSentAtRef.current = null;
    speechStartedAtRef.current = null;
    deepgramRef.current?.close();
    speechRef.current?.close();
    translationRef.current?.stopSession("user_stop", sessionRef.current.identity.app_session_id);
    await MurmurAudioModule.stopCapture("user_stop");
    await MurmurAudioModule.clearPlayback("user_stop");
    await closeWorkerSession(sessionRef.current.identity.app_session_id, "user_stop");
    setStatus("ended");
    recordDebug("session.ended", "Live translation session ended", "info");
  }, [recordDebug, setStatus]);

  const cancel = useCallback(async () => {
    if (sessionRef.current.state === "idle") {
      recordDebug("session.cancel_idle", "Cancel requested while session was idle", "debug");
      lastCommittedSourceCaptionRef.current = null;
      echoGateUntilMsRef.current = 0;
      echoGateLoggedRef.current = false;
      updateTentativeSourceCaption("");
      setSpans([]);
      return;
    }
    setStatus("cancelling");
    recordDebug("session.cancel_requested", "User requested cancel", "info", {
      app_session_id: sessionRef.current.identity.app_session_id,
      span_count: spansRef.current.length,
    });
    clearDeepgramKeepAlive(deepgramKeepAliveRef);
    clearSilenceFinalize(deepgramSilenceFinalizeTimeoutRef);
    clearTokenRefresh(tokenRefreshTimeoutRef);
    tokenRefreshRetryCountRef.current = 0;
    echoGateUntilMsRef.current = 0;
    echoGateLoggedRef.current = false;
    hasSpeechSinceFinalizeRef.current = false;
    firstPcmFrameSentAtRef.current = null;
    speechStartedAtRef.current = null;
    deepgramRef.current?.close();
    speechRef.current?.close();
    translationRef.current?.cancelSession("user_cancel", sessionRef.current.identity.app_session_id);
    await MurmurAudioModule.stopCapture("user_cancel");
    await MurmurAudioModule.clearPlayback("user_cancel");
    await closeWorkerSession(sessionRef.current.identity.app_session_id, "user_cancel");
    firstTranslatedTokenSeenRef.current.clear();
    continuousMemoryRef.current = createContinuousMemoryState();
    continuousStabilizerRef.current.reset();
    firstPcmFrameSentAtRef.current = null;
    translationStartedAtRef.current.clear();
    hasSpeechSinceFinalizeRef.current = false;
    lastCommittedSourceCaptionRef.current = null;
    speechStartedAtRef.current = null;
    updateTentativeSourceCaption("");
    setSpans([]);
    setStatus("idle");
    recordDebug("session.cancelled", "Live translation session cancelled", "info");
  }, [recordDebug, setStatus, updateTentativeSourceCaption]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState !== "active" && isActiveOrRecoveringSession(sessionRef.current.state)) {
        void cancel();
      }
    });
    return () => subscription.remove();
  }, [cancel]);

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

  return {
    cancel,
    debug_log: debugLog,
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

function normalizeCaption(caption: string): string {
  return caption.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  return MurmurAudioModule.requestMicrophonePermission();
}

async function createWorkerSession(body: {
  app_install_id: string;
  device_integrity: DeviceIntegrityPayload;
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
  translation_mode: TranslationMode;
}): Promise<CreateSessionResponse | { error: string }> {
  const response = await fetch(`${getWorkerBaseUrl()}/v1/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!response) {
    return { error: "worker_session_network_error" };
  }
  const payload = (await response.json().catch(() => null)) as unknown;
  if (isErrorPayload(payload)) {
    const provider =
      typeof payload.provider === "string" && payload.provider.length > 0 ? `:${payload.provider}` : "";
    const reason =
      typeof payload.reason === "string" && payload.reason.length > 0 ? `:${payload.reason}` : "";
    const missing = Array.isArray(payload.missing) ? `:${payload.missing.join(",")}` : "";
    return { error: `${payload.error}${provider}${reason}${missing}` };
  }
  if (!response.ok || !payload) {
    return { error: `worker_session_http_${response.status}` };
  }
  return payload as CreateSessionResponse;
}

async function requestContinuousSummary(body: {
  app_session_id: string;
  input_memory_version: number;
  previous_summary: SessionSummary;
  session_epoch: number;
  source_language: SourceLanguageCode;
  spans_to_summarize: RollingMemorySpan[];
  summary_job_id: string;
  target_language: LanguageCode;
}): Promise<SummaryResponse> {
  const response = await fetch(`${getWorkerBaseUrl()}/v1/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!response) {
    return { error: "summary_network_error", retryable: true };
  }
  const payload = (await response.json().catch(() => null)) as unknown;
  return normalizeSummaryResponse(response, payload);
}

async function refreshWorkerSessionTokens(body: {
  app_install_id: string;
  app_session_id: string;
  device_integrity: DeviceIntegrityPayload;
  session_epoch: number;
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
}): Promise<RefreshSessionTokenResponse | { error: string }> {
  const response = await fetch(`${getWorkerBaseUrl()}/v1/session/${body.app_session_id}/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!response) {
    return { error: "worker_session_network_error" };
  }
  const payload = (await response.json().catch(() => null)) as unknown;
  if (isErrorPayload(payload)) {
    const provider =
      typeof payload.provider === "string" && payload.provider.length > 0 ? `:${payload.provider}` : "";
    const reason =
      typeof payload.reason === "string" && payload.reason.length > 0 ? `:${payload.reason}` : "";
    const missing = Array.isArray(payload.missing) ? `:${payload.missing.join(",")}` : "";
    return { error: `${payload.error}${provider}${reason}${missing}` };
  }
  if (!response.ok || !payload) {
    return { error: `worker_session_http_${response.status}` };
  }
  return payload as RefreshSessionTokenResponse;
}

async function closeWorkerSession(appSessionId: string, reason: string): Promise<void> {
  if (!appSessionId) {
    return;
  }
  await fetch(`${getWorkerBaseUrl()}/v1/session/${appSessionId}/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  }).catch(() => null);
}

async function collectDeviceIntegrity(params: {
  appInstallId: string;
  sourceLanguage: SourceLanguageCode;
  targetLanguage: LanguageCode;
}): Promise<DeviceIntegrityPayload> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return {
      available: false,
      platform: Platform.OS,
      reason: "platform_integrity_not_implemented",
    };
  }

  const nonce = createIntegrityNonce(params);
  const payload = (await MurmurAudioModule.requestPlayIntegrityToken(nonce).catch((error) => ({
    available: false,
    platform: Platform.OS,
    provider: Platform.OS === "ios" ? "app_attest" : "play_integrity",
    reason: error instanceof Error ? error.message : "device_integrity_failed",
  }))) as DeviceIntegrityPayload;

  const provider = Platform.OS === "ios" ? "app_attest" : "play_integrity";
  return {
    available: Boolean(payload.available && payload.token),
    key_id: typeof payload.key_id === "string" ? payload.key_id : undefined,
    kind: typeof payload.kind === "string" ? payload.kind : undefined,
    nonce,
    platform: Platform.OS,
    provider,
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
    token: typeof payload.token === "string" ? payload.token : undefined,
  };
}

function createIntegrityNonce(params: {
  appInstallId: string;
  sourceLanguage: SourceLanguageCode;
  targetLanguage: LanguageCode;
}): string {
  return [
    "murmur",
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 14),
    params.sourceLanguage,
    params.targetLanguage,
    params.appInstallId.slice(-12),
  ].join("_");
}

function getDeepgramClientLanguage(sourceLanguage: SourceLanguageCode) {
  return sourceLanguage === autoSourceLanguageCode ? undefined : getLanguage(sourceLanguage);
}

function isErrorPayload(payload: unknown): payload is {
  error: string;
  missing?: unknown;
  provider?: unknown;
  reason?: unknown;
} {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  );
}

function spanKey(spanId: string, revision: number): string {
  return `${spanId}:${revision}`;
}

function createSummaryJobId(): string {
  return `summary_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function recordElapsedLatency(
  name: string | undefined,
  startedAtMs: number | undefined,
  recordLatency: (name: string, value_ms: number) => void,
): void {
  if (!name) {
    return;
  }
  if (typeof startedAtMs !== "number") {
    return;
  }
  recordLatency(name, Math.max(0, Date.now() - startedAtMs));
}

function getCurrentSttStartedAt(
  speechStartedAtRef: MutableRefObject<number | null>,
  firstPcmFrameSentAtRef: MutableRefObject<number | null>,
): number | undefined {
  return speechStartedAtRef.current ?? firstPcmFrameSentAtRef.current ?? undefined;
}

function resetCurrentSttTiming(
  speechStartedAtRef: MutableRefObject<number | null>,
  firstPcmFrameSentAtRef: MutableRefObject<number | null>,
): void {
  speechStartedAtRef.current = null;
  firstPcmFrameSentAtRef.current = null;
}

function startDeepgramKeepAlive(
  deepgramRef: MutableRefObject<DeepgramLiveClient | null>,
  intervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>,
): void {
  clearDeepgramKeepAlive(intervalRef);
  intervalRef.current = setInterval(() => {
    deepgramRef.current?.keepAlive();
  }, 8000);
}

function clearDeepgramKeepAlive(
  intervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>,
): void {
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
}

const speechRmsThreshold = 0.012;
const silenceRmsThreshold = 0.006;
const silenceFinalizeDelayMs = 800;
const echoGatePostRollMs = 450;
const echoGateFallbackMs = 1_000;
const maxEchoGateMs = 12_000;
const tokenRefreshRetryDelaysMs = [5_000, 10_000, 20_000];

function shouldGateMicFrameForEcho(echoGateUntilMs: number): boolean {
  return Date.now() < echoGateUntilMs;
}

function nextEchoGateUntilMs(playbackQueuedMs: number): number {
  const activePlaybackMs = Math.min(
    maxEchoGateMs,
    Math.max(echoGateFallbackMs, Number.isFinite(playbackQueuedMs) ? playbackQueuedMs : 0),
  );
  return Date.now() + activePlaybackMs + echoGatePostRollMs;
}

function scheduleSilenceFinalize(params: {
  deepgramRef: MutableRefObject<DeepgramLiveClient | null>;
  frame: AudioFrameEvent;
  hasSpeechSinceFinalizeRef: MutableRefObject<boolean>;
  timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}): void {
  if (params.frame.rms >= speechRmsThreshold) {
    params.hasSpeechSinceFinalizeRef.current = true;
    clearSilenceFinalize(params.timeoutRef);
    return;
  }

  if (
    !params.hasSpeechSinceFinalizeRef.current ||
    params.frame.rms > silenceRmsThreshold ||
    params.timeoutRef.current
  ) {
    return;
  }

  params.timeoutRef.current = setTimeout(() => {
    params.deepgramRef.current?.finalize();
    params.hasSpeechSinceFinalizeRef.current = false;
    params.timeoutRef.current = null;
  }, silenceFinalizeDelayMs);
}

function clearSilenceFinalize(
  timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
): void {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

function scheduleTokenRefresh(params: {
  expiresAtMs: number;
  refresh: () => Promise<void>;
  timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}): void {
  clearTokenRefresh(params.timeoutRef);
  const refreshInMs = Math.max(5_000, params.expiresAtMs - Date.now() - 30_000);
  params.timeoutRef.current = setTimeout(() => {
    void params.refresh();
  }, refreshInMs);
}

function scheduleTokenRefreshRetry(params: {
  refresh: () => Promise<void>;
  retryInMs: number;
  timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}): void {
  clearTokenRefresh(params.timeoutRef);
  params.timeoutRef.current = setTimeout(() => {
    void params.refresh();
  }, params.retryInMs);
}

function nextTokenRefreshRetryDelayMs(retryCount: number): number | null {
  return tokenRefreshRetryDelaysMs[retryCount] ?? null;
}

function clearTokenRefresh(
  timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
): void {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}
