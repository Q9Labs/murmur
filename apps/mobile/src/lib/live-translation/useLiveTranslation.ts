import {
  canStartSession,
  createConnectionId,
  createSession,
  createSpan,
  type SessionState,
  type TranslationSpan,
} from "@murmur/protocol/session";
import type {
  ReportTranslationCategory,
  RealtimeServerEvent,
} from "@murmur/protocol/transport/types";
import { useCallback, useEffect, useRef, useState } from "react";

import MurmurAudioModule, {
  type AudioFrameEvent,
  type AudioStateEvent,
} from "../../../modules/murmur-audio";
import { getOrCreateInstallId } from "../installIdentity";
import {
  type DebugLogEntry,
  type LatencySample,
  summarizeLatency,
} from "../latency";
import {
  createEmptyRealtimeTransportDiagnostics,
  createRealtimeTranslationClient,
  type RealtimeTranslationClient,
  type RealtimeTranslationClientEvent,
  type RealtimeTransportDiagnostics,
} from "../providers/realtimeTranslation";
import { reportTranslation } from "../providers/reportTranslation";
import {
  getGracefulSessionStopDelay,
  scheduleRealtimeConnectionDeadline,
} from "./realtimeConnectionDeadline";
import { createLiveTranslationCompletion } from "./types";
import type {
  LiveTranslationCompletion,
  LiveTranslationController,
  LiveTranslationParams,
} from "./types";
import {
  closeWorkerSession,
  collectDeviceIntegrity,
  createWorkerSession,
  requestMicrophonePermission,
} from "./workerApi";
import { createAudioCaptureDiagnosticsTracker } from "./audioDiagnostics";
import {
  createSessionPreparation,
  type SessionPreparation,
  type SessionPreparationStatus,
} from "./sessionPreparation";
import {
  createSessionTimingTracker,
  type ListenTimingStep,
  type SessionTimingTracker,
  type StopTimingStep,
} from "./sessionTiming";

const maxDebugEntries = 200;
const sessionCloseTimeoutMs = 5_000;

type LocalStopCleanup = {
  capture: Promise<void>;
  playback: Promise<void>;
};

export function useLiveTranslation(
  params: LiveTranslationParams,
): LiveTranslationController {
  const [session, setSession] = useState(() => createSession(params));
  const [spans, setSpans] = useState<TranslationSpan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportReceiptId, setReportReceiptId] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<DebugLogEntry[]>([]);
  const [latencySamples, setLatencySamples] = useState<LatencySample[]>([]);
  const [preparationStatus, setPreparationStatus] =
    useState<SessionPreparationStatus>("idle");
  const sessionRef = useRef(session);
  const spanRef = useRef<TranslationSpan | null>(null);
  const clientRef = useRef<RealtimeTranslationClient | null>(null);
  const captureStartedAtRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const errorRef = useRef<string | null>(null);
  const firstSourceReceivedRef = useRef(false);
  const firstTranslationReceivedRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectDeadlineRef = useRef<(() => void) | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishingRef = useRef(false);
  const completionPromiseRef = useRef<Promise<LiveTranslationCompletion | undefined> | null>(null);
  const completionResolveRef = useRef<((completion: LiveTranslationCompletion | undefined) => void) | null>(null);
  const captureDiagnosticsRef = useRef(createAudioCaptureDiagnosticsTracker());
  const lastTransportDiagnosticsRef = useRef<RealtimeTransportDiagnostics>(
    createEmptyRealtimeTransportDiagnostics(),
  );
  const playbackActiveRef = useRef(false);
  const playbackEnabledRef = useRef(params.playback_enabled);
  const playbackSuppressedRef = useRef(false);
  const lastAudioStateRef = useRef<AudioStateEvent | null>(null);
  const localStopCleanupRef = useRef<LocalStopCleanup | null>(null);
  const workerClosePromiseRef = useRef<Promise<void> | null>(null);
  const preparationRef = useRef<SessionPreparation | null>(null);
  const timingRef = useRef<SessionTimingTracker | null>(null);
  if (!preparationRef.current) {
    preparationRef.current = createSessionPreparation({
      getInstallId: getOrCreateInstallId,
      onStatusChange: setPreparationStatus,
      requestMicrophonePermission,
    });
  }
  timingRef.current ??= createSessionTimingTracker();

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    playbackEnabledRef.current = params.playback_enabled;
    if (!params.playback_enabled) {
      void MurmurAudioModule.clearPlayback("playback_disabled");
    }
  }, [params.playback_enabled]);

  useEffect(() => {
    if (!canStartSession(sessionRef.current.state)) {
      return;
    }
    const next = createSession(params);
    sessionRef.current = next;
    setSession(next);
  }, [params.source_language, params.target_language]);

  useEffect(() => {
    const subscription = MurmurAudioModule.addListener(
      "onAudioFrame",
      (frame: AudioFrameEvent) => {
        captureDiagnosticsRef.current.recordFrame(frame, playbackActiveRef.current);
        if (sessionRef.current.state === "live") {
          clientRef.current?.sendAudio(frame.data);
        }
      },
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = MurmurAudioModule.addListener(
      "onAudioState",
      (state: AudioStateEvent) => {
        const current = lastAudioStateRef.current;
        const generationOrder = current
          ? Math.sign(state.audio_generation_id - current.audio_generation_id)
          : 1;
        const eventOrder = current ? Math.sign(state.event_seq - current.event_seq) : 1;
        if ((generationOrder || eventOrder) >= 0) {
          lastAudioStateRef.current = state;
          playbackActiveRef.current = state.playback_active;
        }
      },
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => () => {
    clearCloseTimer(closeTimerRef);
    clearCloseTimer(sessionTimerRef);
    clearConnectionDeadline(connectDeadlineRef);
    preparationRef.current?.dispose();
    const client = clientRef.current;
    clientRef.current = null;
    void Promise.all([
      client?.close("hook_unmount"),
      MurmurAudioModule.stopCapture("hook_unmount"),
    ]).then(() => MurmurAudioModule.clearPlayback("hook_unmount"));
  }, []);

  function transition(state: SessionState): void {
    setSession((current) => {
      const next = { ...current, state };
      sessionRef.current = next;
      return next;
    });
  }

  function setLiveError(nextError: string | null): void {
    errorRef.current = nextError;
    setError(nextError);
  }

  function resetCompletionWaiter(): void {
    completionPromiseRef.current = new Promise((resolve) => {
      completionResolveRef.current = resolve;
    });
  }

  function getCompletionPromise(): Promise<LiveTranslationCompletion | undefined> {
    if (!completionPromiseRef.current) {
      resetCompletionWaiter();
    }
    return completionPromiseRef.current!;
  }

  function resolveCompletion(completion: LiveTranslationCompletion): void {
    completionResolveRef.current?.(completion);
    completionResolveRef.current = null;
  }

  function recordDebug(
    name: string,
    message: string,
    level: DebugLogEntry["level"] = "info",
  ): void {
    setDebugLog((current) => [
      ...current,
      { at_ms: Date.now(), level, message, name },
    ].slice(-maxDebugEntries));
  }

  function recordFirstLatency(name: string, seenRef: { current: boolean }): void {
    if (seenRef.current || captureStartedAtRef.current === null) {
      return;
    }
    seenRef.current = true;
    setLatencySamples((current) => [
      ...current,
      {
        name,
        value_ms: Math.max(0, Date.now() - captureStartedAtRef.current!),
      },
    ]);
  }

  function appendLatencySample(sample: LatencySample | null): void {
    if (sample) {
      setLatencySamples((current) => [...current, sample]);
    }
  }

  function recordListenTiming(step: ListenTimingStep, atMs?: number): void {
    appendLatencySample(timingRef.current!.recordListen(step, atMs));
  }

  function recordStopTiming(step: StopTimingStep, atMs?: number): void {
    appendLatencySample(timingRef.current!.recordStop(step, atMs));
  }

  const prepare = useCallback(async (): Promise<void> => {
    await preparationRef.current!.prepare();
  }, []);

  const invalidatePreparation = useCallback((): void => {
    preparationRef.current!.invalidateIdentity();
  }, []);

  function updateSpan(update: (current: TranslationSpan) => TranslationSpan): void {
    const current = spanRef.current ?? createSpan();
    const next = update(current);
    spanRef.current = next;
    setSpans([next]);
  }

  async function start(): Promise<void> {
    if (!canStartSession(sessionRef.current.state)) {
      return;
    }
    const listenTappedAtMs = Date.now();
    timingRef.current!.beginListen(listenTappedAtMs);
    const freshSession = createSession(params);
    sessionRef.current = freshSession;
    setSession(freshSession);
    sessionStartedAtRef.current = listenTappedAtMs;
    captureStartedAtRef.current = null;
    setLiveError(null);
    setReportError(null);
    setReportReceiptId(null);
    setSpans([]);
    finishingRef.current = false;
    spanRef.current = null;
    firstSourceReceivedRef.current = false;
    firstTranslationReceivedRef.current = false;
    captureDiagnosticsRef.current.reset();
    lastTransportDiagnosticsRef.current = createEmptyRealtimeTransportDiagnostics();
    playbackActiveRef.current = false;
    playbackSuppressedRef.current = false;
    localStopCleanupRef.current = null;
    workerClosePromiseRef.current = null;
    resetCompletionWaiter();
    transition("requesting_mic_permission");
    const preparation = await preparationRef.current!.prepare();
    if (preparation.microphone_granted) {
      recordListenTiming("microphone_ready", preparation.microphone_ready_at_ms);
    }
    if (preparation.identity_ready_at_ms !== null) {
      recordListenTiming("identity_ready", preparation.identity_ready_at_ms);
    }
    if (!preparation.microphone_granted) {
      setLiveError("microphone_permission_denied");
      transition("failed");
      return;
    }
    if (!preparation.app_install_id) {
      setLiveError("install_identity_failed");
      transition("failed");
      return;
    }

    transition("checking_device");
    const deviceIntegrity = await collectDeviceIntegrity({
      appInstallId: preparation.app_install_id,
      sourceLanguage: params.source_language,
      targetLanguage: params.target_language,
    });
    recordListenTiming("integrity_ready");
    transition("creating_session");
    const response = await createWorkerSession({
      acquisition: params.acquisition,
      app_install_id: preparation.app_install_id,
      device_integrity: deviceIntegrity,
      source_language: params.source_language,
      target_language: params.target_language,
    });
    if ("error" in response) {
      setLiveError(response.error);
      transition("failed");
      return;
    }
    recordListenTiming("worker_session_ready");

    setSession((current) => {
      const next = {
        ...current,
        identity: {
          ...current.identity,
          app_session_id: response.app_session_id,
          connection_id: createConnectionId(),
          session_epoch: response.session_epoch,
        },
        state: "connecting_realtime" as const,
      };
      sessionRef.current = next;
      return next;
    });
    const client = createRealtimeTranslationClient({
      onEvent: (event) => {
        void receiveRealtimeEvent(event);
      },
      shouldPlayAudio: () =>
        playbackEnabledRef.current && !playbackSuppressedRef.current,
      url: response.realtime_ws_url,
    });
    clientRef.current = client;
    connectDeadlineRef.current = scheduleRealtimeConnectionDeadline(() => {
      if (sessionRef.current.state !== "connecting_realtime") {
        return;
      }
      setLiveError("realtime_connect_timeout");
      recordDebug("realtime.timeout", "Live translation connection timed out", "error");
      void finishSession("failed");
    });
    const gracefulStopDelayMs = getGracefulSessionStopDelay(
      response.limits.expires_at_ms,
      Date.now(),
    );
    sessionTimerRef.current = setTimeout(() => {
      if (sessionRef.current.state === "live") {
        void stop();
      } else {
        void finishSession("failed");
      }
    }, gracefulStopDelayMs);
    client.connect();
    recordDebug("realtime.connecting", "Connecting to live translation");
  }

  async function receiveRealtimeEvent(
    event: RealtimeTranslationClientEvent,
  ): Promise<void> {
    if (event.kind === "session_opened") {
      clearConnectionDeadline(connectDeadlineRef);
      recordListenTiming("realtime_provider_ready");
      updateSpan((span) => ({
        ...span,
        provider_metadata: event.provider_metadata,
        updated_at_ms: Date.now(),
      }));
      try {
        await MurmurAudioModule.startCapture();
      } catch {
        setLiveError("microphone_start_failed");
        await finishSession("failed");
        return;
      }
      captureStartedAtRef.current = Date.now();
      recordListenTiming("capture_started", captureStartedAtRef.current);
      transition("live");
      recordDebug("realtime.opened", "Live translation connected");
      return;
    }
    if (event.kind === "source_delta") {
      recordListenTiming("first_source");
      recordFirstLatency("first_source_transcript", firstSourceReceivedRef);
      applyTranscriptDelta(event);
      return;
    }
    if (event.kind === "translation_delta") {
      recordListenTiming("first_translation");
      recordFirstLatency("first_translated_transcript", firstTranslationReceivedRef);
      applyTranscriptDelta(event);
      return;
    }
    if (event.kind === "input_audio_ack" || event.kind === "provider_session_config") {
      return;
    }
    if (event.kind === "session_closed") {
      await finishSession("ended");
      return;
    }
    if (event.kind === "session_error") {
      setLiveError(`realtime_${event.code}`);
      recordDebug("realtime.error", "Live translation failed", "error");
      await finishSession("failed");
      return;
    }
    if (event.kind === "transport_error") {
      setLiveError("realtime_transport_error");
      transition("network_degraded");
      return;
    }
    if (event.kind === "playback_error") {
      recordDebug(
        "audio.playback_error",
        "Translated audio playback failed; captions remain live",
        "error",
      );
      await MurmurAudioModule.clearPlayback("playback_error");
      return;
    }
    if (
      event.kind === "transport_closed" &&
      sessionRef.current.state !== "ended" &&
      sessionRef.current.state !== "failed" &&
      sessionRef.current.state !== "cancelling"
    ) {
      await finishSession(
        sessionRef.current.state === "stopping" ? "ended" : "failed",
      );
    }
  }

  function applyTranscriptDelta(
    event: Extract<RealtimeServerEvent, { kind: "source_delta" | "translation_delta" }>,
  ): void {
    updateSpan((span) => {
      if (event.kind === "source_delta") {
        return {
          ...span,
          source_caption: `${span.source_caption}${event.delta}`,
          updated_at_ms: Date.now(),
        };
      }
      const translatedCaption = `${span.translated_caption}${event.delta}`;
      return {
        ...span,
        partial_translated_caption: translatedCaption,
        translated_caption: translatedCaption,
        updated_at_ms: Date.now(),
      };
    });
  }

  async function stop(): Promise<LiveTranslationCompletion | undefined> {
    if (sessionRef.current.state !== "live") {
      return undefined;
    }
    const completionPromise = getCompletionPromise();
    timingRef.current!.beginStop();
    playbackSuppressedRef.current = true;
    transition("stopping");
    const localCleanup = startLocalStopCleanup("user_stop");
    try {
      clientRef.current?.finish();
    } catch {
      recordDebug("realtime.finish_error", "Could not request a clean provider finish", "error");
    }
    recordStopTiming("close_requested");
    void startWorkerSessionClose("user_stop");
    clearCloseTimer(closeTimerRef);
    clearCloseTimer(sessionTimerRef);
    clearConnectionDeadline(connectDeadlineRef);
    closeTimerRef.current = setTimeout(() => {
      void finishSession("ended");
    }, sessionCloseTimeoutMs);
    void Promise.all([localCleanup.capture, localCleanup.playback]);
    return completionPromise;
  }

  async function cancel(): Promise<void> {
    clearCloseTimer(closeTimerRef);
    clearCloseTimer(sessionTimerRef);
    clearConnectionDeadline(connectDeadlineRef);
    playbackSuppressedRef.current = true;
    transition("cancelling");
    const appSessionId = sessionRef.current.identity.app_session_id;
    const client = clientRef.current;
    clientRef.current = null;
    completionResolveRef.current?.(undefined);
    completionResolveRef.current = null;
    completionPromiseRef.current = null;
    sessionStartedAtRef.current = null;
    captureStartedAtRef.current = null;
    localStopCleanupRef.current = null;
    workerClosePromiseRef.current = null;
    await Promise.allSettled([
      client?.close("user_cancel"),
      MurmurAudioModule.stopCapture("user_cancel"),
    ]);
    preserveClientDiagnostics(client);
    await Promise.allSettled([
      MurmurAudioModule.clearPlayback("user_cancel"),
      closeWorkerSession(appSessionId, "cancel"),
    ]);
    spanRef.current = null;
    setSpans([]);
    transition("ended");
  }

  async function finishSession(state: "ended" | "failed"): Promise<LiveTranslationCompletion> {
    if (finishingRef.current) {
      return getCompletionPromise() as Promise<LiveTranslationCompletion>;
    }
    finishingRef.current = true;
    clearCloseTimer(closeTimerRef);
    clearCloseTimer(sessionTimerRef);
    clearConnectionDeadline(connectDeadlineRef);
    const client = clientRef.current;
    clientRef.current = null;
    const localCleanup = localStopCleanupRef.current ?? startLocalStopCleanup("session_complete");
    await client?.close("session_complete").catch(() => undefined);
    preserveClientDiagnostics(client);
    recordStopTiming("provider_client_closed");
    await Promise.all([localCleanup.capture, localCleanup.playback]);
    await settleCleanup(
      "audio.final_clear_failed",
      "Could not confirm translated audio was cleared",
      () => MurmurAudioModule.clearPlayback(
        state === "failed" ? "session_failed" : "session_complete",
      ),
    );
    let finalizedSpan: TranslationSpan | null = null;
    if (spanRef.current) {
      finalizedSpan = {
        ...spanRef.current,
        committed_translated_caption: spanRef.current.translated_caption || null,
        partial_translated_caption: null,
        status: state === "failed" ? "failed" : "committed",
        updated_at_ms: Date.now(),
      };
      spanRef.current = finalizedSpan;
      setSpans([finalizedSpan]);
    }
    await (workerClosePromiseRef.current ?? startWorkerSessionClose(state));
    transition(state);
    recordStopTiming("ui_ended_start_enabled");
    const completion: LiveTranslationCompletion = createLiveTranslationCompletion({
      completed_at_ms: Date.now(),
      error: errorRef.current,
      span: finalizedSpan,
      started_at_ms: sessionStartedAtRef.current ?? sessionRef.current.created_at_ms,
      state,
    });
    resolveCompletion(completion);
    return completion;
  }

  function startLocalStopCleanup(reason: string): LocalStopCleanup {
    if (localStopCleanupRef.current) {
      return localStopCleanupRef.current;
    }
    const capture = settleCleanup(
      "audio.capture_stop_failed",
      "Could not confirm microphone capture stopped",
      () => MurmurAudioModule.stopCapture(reason),
    ).then(() => recordStopTiming("capture_stopped"));
    const playback = settleCleanup(
      "audio.playback_clear_failed",
      "Could not clear translated audio promptly",
      () => MurmurAudioModule.clearPlayback(reason),
    ).then(() => recordStopTiming("playback_cleared_silenced"));
    const cleanup = { capture, playback };
    localStopCleanupRef.current = cleanup;
    return cleanup;
  }

  function startWorkerSessionClose(reason: string): Promise<void> {
    workerClosePromiseRef.current ??= closeWorkerSession(
      sessionRef.current.identity.app_session_id,
      reason,
    )
      .catch(() => undefined)
      .then(() => recordStopTiming("worker_session_close_completed"));
    return workerClosePromiseRef.current;
  }

  async function settleCleanup(
    debugName: string,
    debugMessage: string,
    operation: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await operation();
    } catch {
      recordDebug(debugName, debugMessage, "error");
    }
  }

  async function reportSpan(
    span: TranslationSpan,
    category: ReportTranslationCategory,
    includeSnapshots = false,
  ): Promise<void> {
    setReportError(null);
    const response = await reportTranslation({
      app_session_id: sessionRef.current.identity.app_session_id,
      error_category: category,
      optional_source_text_snapshot: includeSnapshots ? span.source_caption : undefined,
      optional_translated_text_snapshot: includeSnapshots ? span.translated_caption : undefined,
      provider_metadata: span.provider_metadata ?? undefined,
      revision: span.revision,
      source_language: sessionRef.current.source_language,
      span_id: span.span_id,
      target_language: sessionRef.current.target_language,
    });
    if ("error" in response) {
      setReportError(response.error);
      return;
    }
    setReportReceiptId(response.report_id);
  }

  function getDiagnosticsSnapshot(): LiveTranslationController["diagnostics_snapshot"] {
    const currentSpan = spanRef.current;
    return {
      capture: captureDiagnosticsRef.current.snapshot(),
      runtime: {
        playback_enabled: playbackEnabledRef.current,
        realtime_socket_open:
          sessionRef.current.state === "live" || sessionRef.current.state === "stopping",
        source_char_count: currentSpan?.source_caption.length ?? 0,
        translated_char_count: currentSpan?.translated_caption.length ?? 0,
      },
      transport: clientRef.current?.getDiagnostics() ?? lastTransportDiagnosticsRef.current,
    };
  }

  const diagnosticsSnapshot = getDiagnosticsSnapshot();

  function preserveClientDiagnostics(client = clientRef.current): void {
    if (client) {
      lastTransportDiagnosticsRef.current = client.getDiagnostics();
    }
  }

  return {
    cancel,
    debug_log: debugLog,
    diagnostics_snapshot: diagnosticsSnapshot,
    error,
    getDiagnosticsSnapshot,
    latency_report: summarizeLatency(latencySamples),
    latency_samples: latencySamples,
    invalidatePreparation,
    preparation_status: preparationStatus,
    prepare,
    report_error: reportError,
    report_receipt_id: reportReceiptId,
    reportSpan,
    session,
    spans,
    start,
    status: session.state,
    stop,
    tentative_source_caption: "",
  };
}

function clearCloseTimer(
  timerRef: { current: ReturnType<typeof setTimeout> | null },
): void {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

function clearConnectionDeadline(
  deadlineRef: { current: (() => void) | null },
): void {
  deadlineRef.current?.();
  deadlineRef.current = null;
}
