import { getLanguage } from "@murmur/protocol/languages";
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
import type { MobileFailureStage } from "@murmur/protocol/telemetry";
import * as Network from "expo-network";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import MurmurAudioModule, {
  type AudioFrameEvent,
  type AudioStateEvent,
} from "../../../modules/murmur-audio";
import { getOrCreateInstallId } from "../installIdentity";
import { getInsightsConsent } from "../insightsConsent";
import { saveConversation } from "../conversationHistory";
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
import { captureMobileFailure } from "../observability/sentry";
import { captureMobileTelemetry } from "../telemetry";
import { recordCompletedSession, type SessionRatingDecision } from "../ratings/ratings";
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
  hasSourceTranscript,
  requestCapturePermission,
  requestMicrophonePermission,
} from "./workerApi";
import { createAudioCaptureDiagnosticsTracker } from "./audioDiagnostics";
import { getDevicePlaybackCaptureError } from "./captureLifecycle";
import {
  preserveFirstLiveError,
  shouldIgnoreLateTransportEvent,
} from "./errorState";
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
const meaningfulAudioRmsThreshold = 0.01;
const sessionCloseTimeoutMs = 5_000;
const silenceTimeoutMs = 120_000;

type LocalStopCleanup = {
  capture: Promise<void>;
  playback: Promise<void>;
};

export function useLiveTranslation(
  params: LiveTranslationParams,
): LiveTranslationController {
  const [session, setSession] = useState(() => createSession(params));
  const [ratingDecision, setRatingDecision] = useState<SessionRatingDecision | null>(null);
  const [spans, setSpans] = useState<TranslationSpan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sourceTranscriptEnabled, setSourceTranscriptEnabled] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportReceiptId, setReportReceiptId] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<DebugLogEntry[]>([]);
  const [latencySamples, setLatencySamples] = useState<LatencySample[]>([]);
  const [preparationStatus, setPreparationStatus] =
    useState<SessionPreparationStatus>("idle");
  const sessionRef = useRef(session);
  const spanRef = useRef<TranslationSpan | null>(null);
  const clientRef = useRef<RealtimeTranslationClient | null>(null);
  const activeRealtimeSessionTokenRef = useRef<string | null>(null);
  const captureStartedAtRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionBackgroundedRef = useRef(false);
  const errorRef = useRef<string | null>(null);
  const firstSourceReceivedRef = useRef(false);
  const firstTranslationReceivedRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectDeadlineRef = useRef<(() => void) | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxSessionSecondsRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMeaningfulAudioAtRef = useRef<number | null>(null);
  const finishingRef = useRef(false);
  const terminatedAtRef = useRef<number | null>(null);
  const permissionFlowRef = useRef(false);
  const completionPromiseRef = useRef<Promise<LiveTranslationCompletion | undefined> | null>(null);
  const completionResolveRef = useRef<((completion: LiveTranslationCompletion | undefined) => void) | null>(null);
  const captureDiagnosticsRef = useRef(createAudioCaptureDiagnosticsTracker());
  const lastTransportDiagnosticsRef = useRef<RealtimeTransportDiagnostics>(
    createEmptyRealtimeTransportDiagnostics(),
  );
  const playbackActiveRef = useRef(false);
  const playbackEnabledRef = useRef(params.playback_enabled);
  const historyCustomerIdRef = useRef(params.history_customer_id);
  historyCustomerIdRef.current = params.history_customer_id;
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
    clientRef.current?.setPlaybackEnabled(params.playback_enabled);
    if (!params.playback_enabled) {
      observeBackgroundOperation(
        MurmurAudioModule.clearPlayback("playback_disabled"),
        "clear_disabled_playback",
      );
    }
  }, [params.playback_enabled]);

  useEffect(() => {
    if (!canStartSession(sessionRef.current.state)) {
      return;
    }
    const next = createSession(params);
    sessionRef.current = next;
    setSession(next);
    setLiveError(null);
  }, [params.capture_source, params.source_language, params.target_language]);

  useEffect(() => {
    const subscription = MurmurAudioModule.addListener(
      "onAudioFrame",
      (frame: AudioFrameEvent) => {
        captureDiagnosticsRef.current.recordFrame(frame, playbackActiveRef.current);
        if (sessionRef.current.state === "live") {
          if (frame.rms >= meaningfulAudioRmsThreshold) {
            resetSilenceDeadline();
          }
          clientRef.current?.sendAudio(frame.data);
        }
      },
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = Network.addNetworkStateListener((networkState) => {
      if (
        finishingRef.current ||
        (networkState.isConnected !== false && networkState.isInternetReachable !== false)
      ) {
        return;
      }
      const state = sessionRef.current.state;
      if (canStartSession(state) || state === "cancelling" || state === "stopping") {
        return;
      }
      setLiveError("realtime_transport_error");
      playbackSuppressedRef.current = true;
      observeBackgroundOperation(
        finishSession("failed"),
        "finish_session_after_network_loss",
      );
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus): void => {
      if (nextState !== "active" && sessionRef.current.state === "live") {
        sessionBackgroundedRef.current = true;
      }
    };
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = MurmurAudioModule.addListener(
      "onAudioState",
      handleAudioState,
    );
    return () => subscription.remove();
  }, []);

  function handleAudioState(state: AudioStateEvent): void {
    recordLatestAudioState(state);
    if (state.reason === "notification_stop" && sessionRef.current.state === "live") {
      observeBackgroundOperation(stop(), "stop_capture_from_notification");
      return;
    }
    handleDevicePlaybackState(state);
  }

  function recordLatestAudioState(state: AudioStateEvent): void {
    const current = lastAudioStateRef.current;
    const generationOrder = current
      ? Math.sign(state.audio_generation_id - current.audio_generation_id)
      : 1;
    const eventOrder = current ? Math.sign(state.event_seq - current.event_seq) : 1;
    if ((generationOrder || eventOrder) >= 0) {
      lastAudioStateRef.current = state;
      playbackActiveRef.current = state.playback_active;
    }
  }

  function handleDevicePlaybackState(state: AudioStateEvent): void {
    if (
      state.capture_source !== "device_playback" ||
      sessionRef.current.state !== "live"
    ) {
      return;
    }
    const captureError = getDevicePlaybackCaptureError(state.reason);
    if (!captureError) {
      return;
    }
    setLiveError(captureError);
    observeBackgroundOperation(
      finishSession("failed"),
      "finish_stopped_device_capture",
    );
  }

  useEffect(() => () => {
    clearCloseTimer(closeTimerRef);
    clearCloseTimer(sessionTimerRef);
    clearCloseTimer(silenceTimerRef);
    clearConnectionDeadline(connectDeadlineRef);
    activeRealtimeSessionTokenRef.current = null;
    preparationRef.current?.dispose();
    const client = clientRef.current;
    clientRef.current = null;
    observeBackgroundOperation(
      Promise.all([
        client?.close("hook_unmount"),
        MurmurAudioModule.stopCapture("hook_unmount"),
        closeWorkerSession(sessionRef.current.identity.app_session_id, "hook_unmount"),
      ]).then(() => MurmurAudioModule.clearPlayback("hook_unmount")),
      "stop_audio_on_unmount",
    );
  }, []);

  function transition(state: SessionState): void {
    setSession((current) => {
      const next = { ...current, state };
      sessionRef.current = next;
      return next;
    });
  }

  function setLiveError(nextError: string | null): void {
    const resolvedError = nextError === null
      ? null
      : preserveFirstLiveError(errorRef.current, nextError);
    errorRef.current = resolvedError;
    setError(resolvedError);
  }

  function observeBackgroundOperation(promise: Promise<unknown>, operation: string): void {
    void promise.catch((failure: unknown) => {
      captureMobileFailure(failure, {
        app_session_id: sessionRef.current.identity.app_session_id,
        operation,
        stage: "session_runtime",
      });
    });
  }

  function resetSilenceDeadline(): void {
    if (finishingRef.current || sessionRef.current.state !== "live") {
      return;
    }
    lastMeaningfulAudioAtRef.current = Date.now();
    if (silenceTimerRef.current) {
      return;
    }
    const checkSilenceDeadline = (): void => {
      silenceTimerRef.current = null;
      if (finishingRef.current || sessionRef.current.state !== "live") {
        return;
      }
      const lastMeaningfulAudioAtMs = lastMeaningfulAudioAtRef.current ?? Date.now();
      const remainingMs = silenceTimeoutMs - (Date.now() - lastMeaningfulAudioAtMs);
      if (remainingMs > 0) {
        silenceTimerRef.current = setTimeout(checkSilenceDeadline, remainingMs);
        return;
      }
      setLiveError("session_silence_timeout");
      playbackSuppressedRef.current = true;
      observeBackgroundOperation(
        finishSession("failed"),
        "finish_session_after_silence",
      );
    };
    silenceTimerRef.current = setTimeout(checkSilenceDeadline, silenceTimeoutMs);
  }

  function isActiveRealtimeSession(realtimeSessionToken: string): boolean {
    if (
      finishingRef.current ||
      activeRealtimeSessionTokenRef.current !== realtimeSessionToken
    ) {
      return false;
    }
    return true;
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
    captureMobileTelemetry({
      event: "mobile_listen_tapped",
      network_type: params.network_type,
      playback_enabled: params.playback_enabled,
      source_language: params.source_language,
      target_language: params.target_language,
    });
    timingRef.current!.beginListen(listenTappedAtMs);
    const freshSession = createSession(params);
    setRatingDecision(null);
    const realtimeSessionToken = freshSession.identity.connection_id;
    sessionRef.current = freshSession;
    setSession(freshSession);
    activeRealtimeSessionTokenRef.current = realtimeSessionToken;
    sessionStartedAtRef.current = listenTappedAtMs;
    sessionBackgroundedRef.current = false;
    captureStartedAtRef.current = null;
    setLiveError(null);
    setReportError(null);
    setReportReceiptId(null);
    setSpans([]);
    finishingRef.current = false;
    terminatedAtRef.current = null;
    clearCloseTimer(silenceTimerRef);
    lastMeaningfulAudioAtRef.current = null;
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
    transition(
      params.capture_source === "microphone"
        ? "requesting_mic_permission"
        : "requesting_audio_permission",
    );
    const appInstallId = await prepareAudioInput(realtimeSessionToken, listenTappedAtMs);
    if (!appInstallId) {
      return;
    }

    transition("checking_device");
    const deviceIntegrity = await collectDeviceIntegrity({
      appInstallId,
      sourceLanguage: params.source_language,
      targetLanguage: params.target_language,
    });
    if (!isActiveRealtimeSession(realtimeSessionToken)) {
      return;
    }
    recordListenTiming("integrity_ready");
    transition("creating_session");
    const response = await createWorkerSession({
      acquisition: params.acquisition,
      analytics_enabled: params.analytics_enabled,
      insights_consent: (await getInsightsConsent()) === true,
      app_install_id: appInstallId,
      capture_source: params.capture_source,
      device_integrity: deviceIntegrity,
      playback_enabled: params.playback_enabled,
      source_language: params.source_language,
      target_language: params.target_language,
    });
    if (!isActiveRealtimeSession(realtimeSessionToken)) {
      if (!("error" in response)) {
        observeBackgroundOperation(
          closeWorkerSession(response.app_session_id, "inactive_during_session_creation"),
          "close_inactive_worker_session",
        );
      }
      return;
    }
    if ("error" in response) {
      failBeforeWorkerSession(response.error, "session_creation", listenTappedAtMs);
      return;
    }
    recordListenTiming("worker_session_ready");
    maxSessionSecondsRef.current = response.limits.max_session_seconds;
    setSourceTranscriptEnabled(hasSourceTranscript(response));

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
      onEvent: (event) => receiveRealtimeEventIfActive(realtimeSessionToken, event),
      shouldPlayAudio: () =>
        playbackEnabledRef.current && !playbackSuppressedRef.current,
      url: response.realtime_ws_url,
    });
    clientRef.current = client;
    client.setPlaybackEnabled(playbackEnabledRef.current);
    connectDeadlineRef.current = scheduleRealtimeConnectionDeadline(() => {
      if (sessionRef.current.state !== "connecting_realtime") {
        return;
      }
      setLiveError("realtime_connect_timeout");
      recordDebug("realtime.timeout", "Live translation connection timed out", "error");
      observeBackgroundOperation(
        finishSession("failed"),
        "finish_session_after_connection_timeout",
      );
    });
    const gracefulStopDelayMs = getGracefulSessionStopDelay(
      response.limits.expires_at_ms,
      Date.now(),
    );
    sessionTimerRef.current = setTimeout(() => {
      if (sessionRef.current.state === "live") {
        observeBackgroundOperation(stop(), "stop_expired_session");
      } else {
        observeBackgroundOperation(finishSession("failed"), "finish_expired_session");
      }
    }, gracefulStopDelayMs);
    client.connect();
    recordDebug("realtime.connecting", "Connecting to live translation");
  }

  async function prepareAudioInput(
    realtimeSessionToken: string,
    listenTappedAtMs: number,
  ): Promise<string | null> {
    permissionFlowRef.current = true;
    const preparation = await preparationRef.current!.prepare().finally(() => {
      permissionFlowRef.current = false;
    });
    if (!isActiveRealtimeSession(realtimeSessionToken)) {
      return null;
    }
    if (preparation.microphone_granted) {
      recordListenTiming("microphone_ready", preparation.microphone_ready_at_ms);
    }
    if (preparation.identity_ready_at_ms !== null) {
      recordListenTiming("identity_ready", preparation.identity_ready_at_ms);
    }
    if (!preparation.microphone_granted) {
      failBeforeWorkerSession(
        params.capture_source === "microphone"
          ? "microphone_permission_denied"
          : "device_playback_permission_denied",
        "microphone_permission",
        listenTappedAtMs,
      );
      return null;
    }
    if (!preparation.app_install_id) {
      failBeforeWorkerSession("install_identity_failed", "identity", listenTappedAtMs);
      return null;
    }
    if (params.capture_source === "device_playback") {
      permissionFlowRef.current = true;
      const capturePermissionGranted = await requestCapturePermission(params.capture_source)
        .finally(() => {
          permissionFlowRef.current = false;
        });
      if (!isActiveRealtimeSession(realtimeSessionToken)) {
        return null;
      }
      if (!capturePermissionGranted) {
        failBeforeWorkerSession(
          "device_playback_permission_denied",
          "microphone_permission",
          listenTappedAtMs,
        );
        return null;
      }
    }
    return preparation.app_install_id;
  }

  function receiveRealtimeEventIfActive(
    realtimeSessionToken: string,
    event: RealtimeTranslationClientEvent,
  ): void {
    const state = sessionRef.current.state;
    const isTransportTerminalEvent =
      event.kind === "transport_error" || event.kind === "transport_closed";
    if (
      finishingRef.current ||
      activeRealtimeSessionTokenRef.current !== realtimeSessionToken ||
      (isTransportTerminalEvent && shouldIgnoreLateTransportEvent(errorRef.current, state))
    ) {
      return;
    }
    observeBackgroundOperation(receiveRealtimeEvent(event), "handle_realtime_event");
  }

  // This existing dispatcher mirrors the closed realtime event protocol in one place.
  // fallow-ignore-next-line complexity
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
        await MurmurAudioModule.startCapture(params.capture_source, maxSessionSecondsRef.current);
      } catch (failure) {
        captureMobileFailure(failure, {
          app_session_id: sessionRef.current.identity.app_session_id,
          operation: params.capture_source === "microphone"
            ? "start_microphone_capture"
            : "start_device_playback_capture",
          stage: "audio_capture",
        });
        setLiveError(
          params.capture_source === "microphone"
            ? "microphone_start_failed"
            : "device_playback_start_failed",
        );
        await finishSession("failed");
        return;
      }
      if (finishingRef.current) {
        await MurmurAudioModule.stopCapture("session_terminated_during_capture_start");
        return;
      }
      captureStartedAtRef.current = Date.now();
      recordListenTiming("capture_started", captureStartedAtRef.current);
      transition("live");
      resetSilenceDeadline();
      captureMobileTelemetry({
        app_session_id: sessionRef.current.identity.app_session_id,
        event: "mobile_session_live",
        source_language: sessionRef.current.source_language,
        startup_latency_ms: Math.max(
          0,
          Date.now() - (sessionStartedAtRef.current ?? Date.now()),
        ),
        target_language: sessionRef.current.target_language,
      });
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
      const isFirstTranslation = !firstTranslationReceivedRef.current;
      recordListenTiming("first_translation");
      recordFirstLatency("first_translated_transcript", firstTranslationReceivedRef);
      if (isFirstTranslation) {
        captureMobileTelemetry({
          app_session_id: sessionRef.current.identity.app_session_id,
          event: "mobile_first_translation",
          first_translation_latency_ms: Math.max(
            0,
            Date.now() - (captureStartedAtRef.current ?? Date.now()),
          ),
          provider_elapsed_ms: event.provider_elapsed_ms ?? null,
        });
      }
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
      playbackSuppressedRef.current = true;
      await finishSession("failed");
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
      if (params.capture_source === "device_playback") {
        observeBackgroundOperation(
          MurmurAudioModule.updateOverlayCaption(
            translatedCaption,
            getLanguage(params.target_language).rtl,
          ),
          "update_device_audio_overlay_caption",
        );
      }
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
    terminatedAtRef.current ??= Date.now();
    playbackSuppressedRef.current = true;
    transition("stopping");
    const localCleanup = startLocalStopCleanup("user_stop");
    try {
      clientRef.current?.finish();
    } catch (failure) {
      captureMobileFailure(failure, {
        app_session_id: sessionRef.current.identity.app_session_id,
        operation: "request_provider_finish",
        stage: "session_runtime",
      });
      recordDebug("realtime.finish_error", "Could not request a clean provider finish", "error");
    }
    recordStopTiming("close_requested");
    void startWorkerSessionClose("user_stop");
    clearCloseTimer(closeTimerRef);
    clearCloseTimer(sessionTimerRef);
    clearCloseTimer(silenceTimerRef);
    clearConnectionDeadline(connectDeadlineRef);
    closeTimerRef.current = setTimeout(() => {
      observeBackgroundOperation(finishSession("ended"), "finish_session_after_close_timeout");
    }, sessionCloseTimeoutMs);
    observeBackgroundOperation(
      Promise.all([localCleanup.capture, localCleanup.playback]),
      "stop_local_audio",
    );
    return completionPromise;
  }

  async function cancel(): Promise<void> {
    clearCloseTimer(closeTimerRef);
    clearCloseTimer(sessionTimerRef);
    clearCloseTimer(silenceTimerRef);
    clearConnectionDeadline(connectDeadlineRef);
    finishingRef.current = true;
    activeRealtimeSessionTokenRef.current = null;
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

  // fallow-ignore-next-line complexity
  async function finishSession(state: "ended" | "failed"): Promise<LiveTranslationCompletion> {
    if (finishingRef.current) {
      return getCompletionPromise() as Promise<LiveTranslationCompletion>;
    }
    finishingRef.current = true;
    terminatedAtRef.current ??= Date.now();
    const terminatedAtMs = terminatedAtRef.current;
    activeRealtimeSessionTokenRef.current = null;
    clearCloseTimer(closeTimerRef);
    clearCloseTimer(sessionTimerRef);
    clearCloseTimer(silenceTimerRef);
    clearConnectionDeadline(connectDeadlineRef);
    playbackSuppressedRef.current = true;
    const client = clientRef.current;
    clientRef.current = null;
    const localCleanup = localStopCleanupRef.current ?? startLocalStopCleanup("session_complete");
    const providerClose = settleCleanup(
      "realtime.client_close_failed",
      "Could not confirm the realtime transport closed",
      () => client?.close("session_complete") ?? Promise.resolve(),
    );
    const workerClose = workerClosePromiseRef.current ?? startWorkerSessionClose(state);
    await Promise.all([
      providerClose,
      localCleanup.capture,
      localCleanup.playback,
      workerClose,
    ]);
    preserveClientDiagnostics(client);
    recordStopTiming("provider_client_closed");
    await settleCleanup(
      "audio.final_clear_failed",
      "Could not confirm translated audio was cleared",
      () => MurmurAudioModule.clearPlayback(
        state === "failed" ? "session_failed" : "session_complete",
      ),
    );
    const finalizedSpan = finalizeCurrentSpan(state);
    if (historyCustomerIdRef.current && finalizedSpan?.committed_translated_caption) {
      try {
        saveConversation({
          customer_id: historyCustomerIdRef.current,
          id: sessionRef.current.identity.app_session_id,
          source_language: sessionRef.current.source_language,
          target_language: sessionRef.current.target_language,
          started_at_ms: sessionStartedAtRef.current ?? sessionRef.current.created_at_ms,
          duration_ms: Math.max(0, terminatedAtMs - (sessionStartedAtRef.current ?? sessionRef.current.created_at_ms)),
          translation_text: finalizedSpan.committed_translated_caption,
        });
      } catch (failure) {
        captureMobileFailure(failure, {
          app_session_id: sessionRef.current.identity.app_session_id,
          operation: "save_conversation_history",
          stage: "session_runtime",
        });
      }
    }
    transition(state);
    recordStopTiming("ui_ended_start_enabled");
    const completion: LiveTranslationCompletion = createLiveTranslationCompletion({
      completed_at_ms: terminatedAtMs,
      error: errorRef.current,
      span: finalizedSpan,
      started_at_ms: sessionStartedAtRef.current ?? sessionRef.current.created_at_ms,
      state,
    });
    const diagnostics = getDiagnosticsSnapshot();
    captureMobileTelemetry({
      app_session_id: sessionRef.current.identity.app_session_id,
      committed_translation: completion.committed_caption_count > 0,
      backgrounded: sessionBackgroundedRef.current,
      capture_source: params.capture_source,
      duration_ms: completion.duration_ms,
      error_code: completion.error,
      event: "mobile_session_completed",
      input_audio_bytes: diagnostics.transport.input_bytes_received,
      input_audio_frames: diagnostics.transport.input_frames_received,
      network_type: params.network_type,
      outcome: state === "ended" ? "completed" : "failed",
      playback_enabled: playbackEnabledRef.current,
      source_char_count: diagnostics.runtime.source_char_count,
      source_language: sessionRef.current.source_language,
      target_language: sessionRef.current.target_language,
      translated_char_count: diagnostics.runtime.translated_char_count,
    });
    const decision = await recordCompletedSession(completion).catch((failure: unknown) => {
      captureMobileFailure(failure, { operation: "record_completed_session_rating" });
      return null;
    });
    setRatingDecision(decision);
    resolveCompletion(completion);
    return completion;
  }

  function finalizeCurrentSpan(state: "ended" | "failed"): TranslationSpan | null {
    const current = spanRef.current;
    if (!current) {
      return null;
    }
    const finalized = {
      ...current,
      committed_translated_caption: current.translated_caption || null,
      partial_translated_caption: null,
      status: state === "failed" ? "failed" as const : "committed" as const,
      updated_at_ms: Date.now(),
    };
    spanRef.current = finalized;
    setSpans([finalized]);
    return finalized;
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
      .then((outcome) => {
        if (outcome === "network_unavailable") {
          recordDebug(
            "worker.session_close_unavailable",
            "Worker session close could not reach the network",
            "warn",
          );
        }
      })
      .catch((failure: unknown) => {
        captureMobileFailure(failure, {
          app_session_id: sessionRef.current.identity.app_session_id,
          operation: "close_worker_session",
          stage: "session_runtime",
        });
      })
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
    } catch (failure) {
      captureMobileFailure(failure, {
        app_session_id: sessionRef.current.identity.app_session_id,
        operation: debugName,
        stage: "session_runtime",
      });
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
    captureMobileTelemetry({
      app_session_id: sessionRef.current.identity.app_session_id,
      error_category: category,
      event: "mobile_translation_reported",
    });
  }

  function failBeforeWorkerSession(
    errorCode: string,
    failureStage: MobileFailureStage,
    startedAtMs: number,
  ): void {
    setLiveError(errorCode);
    transition("failed");
    captureMobileTelemetry({
      app_session_id: null,
      duration_ms: Math.max(0, Date.now() - startedAtMs),
      error_code: normalizeFailureCode(errorCode),
      event: "mobile_session_failed",
      failure_stage: failureStage,
      source_language: sessionRef.current.source_language,
      target_language: sessionRef.current.target_language,
    });
  }

  function getDiagnosticsSnapshot(): LiveTranslationController["diagnostics_snapshot"] {
    const currentSpan = spanRef.current;
    return {
      capture: captureDiagnosticsRef.current.snapshot(),
      runtime: {
        capture_source: params.capture_source,
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
    clearRatingDecision: () => setRatingDecision(null),
    debug_log: debugLog,
    diagnostics_snapshot: diagnosticsSnapshot,
    error,
    getDiagnosticsSnapshot,
    latency_report: summarizeLatency(latencySamples),
    latency_samples: latencySamples,
    invalidatePreparation,
    preparation_status: preparationStatus,
    rating_decision: ratingDecision,
    prepare,
    report_error: reportError,
    report_receipt_id: reportReceiptId,
    reportSpan,
    session,
    source_transcript_enabled: sourceTranscriptEnabled,
    spans,
    start,
    status: session.state,
    stop,
    tentative_source_caption: "",
  };
}

function normalizeFailureCode(errorCode: string): string {
  const normalized = errorCode.toLowerCase().replace(/[^a-z0-9_:,-]/g, "_");
  return normalized.slice(0, 160) || "unknown_failure";
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
