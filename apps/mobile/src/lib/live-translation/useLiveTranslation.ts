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
import { useEffect, useMemo, useRef, useState } from "react";

import MurmurAudioModule, {
  type AudioFrameEvent,
} from "../../../modules/murmur-audio";
import { getOrCreateInstallId } from "../installIdentity";
import {
  type DebugLogEntry,
  type LatencySample,
  summarizeLatency,
} from "../latency";
import {
  createRealtimeTranslationClient,
  type RealtimeTranslationClient,
  type RealtimeTranslationClientEvent,
} from "../providers/realtimeTranslation";
import type {
  LiveTranslationController,
  LiveTranslationParams,
} from "./types";
import {
  closeWorkerSession,
  collectDeviceIntegrity,
  createWorkerSession,
  reportTranslation,
  requestMicrophonePermission,
} from "./workerApi";

const maxDebugEntries = 200;
const sessionCloseTimeoutMs = 5_000;

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
  const sessionRef = useRef(session);
  const spanRef = useRef<TranslationSpan | null>(null);
  const clientRef = useRef<RealtimeTranslationClient | null>(null);
  const captureStartedAtRef = useRef<number | null>(null);
  const firstSourceReceivedRef = useRef(false);
  const firstTranslationReceivedRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishingRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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
        if (sessionRef.current.state === "live") {
          clientRef.current?.sendAudio(frame.data);
        }
      },
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => () => {
    clearCloseTimer(closeTimerRef);
    clearCloseTimer(sessionTimerRef);
    clientRef.current?.close("hook_unmount");
    void MurmurAudioModule.stopCapture("hook_unmount");
    void MurmurAudioModule.clearPlayback("hook_unmount");
  }, []);

  function transition(state: SessionState): void {
    setSession((current) => {
      const next = { ...current, state };
      sessionRef.current = next;
      return next;
    });
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
    setError(null);
    setReportError(null);
    setReportReceiptId(null);
    setSpans([]);
    finishingRef.current = false;
    spanRef.current = null;
    firstSourceReceivedRef.current = false;
    firstTranslationReceivedRef.current = false;
    transition("requesting_mic_permission");
    if (!(await requestMicrophonePermission())) {
      setError("microphone_permission_denied");
      transition("failed");
      return;
    }

    transition("creating_session");
    const appInstallId = await getOrCreateInstallId();
    const deviceIntegrity = await collectDeviceIntegrity({
      appInstallId,
      sourceLanguage: params.source_language,
      targetLanguage: params.target_language,
    });
    const response = await createWorkerSession({
      app_install_id: appInstallId,
      device_integrity: deviceIntegrity,
      source_language: params.source_language,
      target_language: params.target_language,
    });
    if ("error" in response) {
      setError(response.error);
      transition("failed");
      return;
    }

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
      url: response.realtime_ws_url,
    });
    clientRef.current = client;
    sessionTimerRef.current = setTimeout(() => {
      if (sessionRef.current.state === "live") {
        void stop();
      } else {
        void finishSession("failed");
      }
    }, response.limits.max_session_seconds * 1_000);
    client.connect();
    recordDebug("realtime.connecting", "Connecting to live translation");
  }

  async function receiveRealtimeEvent(
    event: RealtimeTranslationClientEvent,
  ): Promise<void> {
    if (event.kind === "session_opened") {
      updateSpan((span) => ({
        ...span,
        provider_metadata: event.provider_metadata,
        updated_at_ms: Date.now(),
      }));
      captureStartedAtRef.current = Date.now();
      try {
        await MurmurAudioModule.startCapture();
      } catch {
        setError("microphone_start_failed");
        await finishSession("failed");
        return;
      }
      transition("live");
      recordDebug("realtime.opened", "Live translation connected");
      return;
    }
    if (event.kind === "source_delta") {
      recordFirstLatency("first_source_transcript", firstSourceReceivedRef);
      applyTranscriptDelta(event);
      return;
    }
    if (event.kind === "translation_delta") {
      recordFirstLatency("first_translated_transcript", firstTranslationReceivedRef);
      applyTranscriptDelta(event);
      return;
    }
    if (event.kind === "session_closed") {
      await finishSession("ended");
      return;
    }
    if (event.kind === "session_error") {
      setError(`realtime_${event.code}`);
      recordDebug("realtime.error", "Live translation failed", "error");
      await finishSession("failed");
      return;
    }
    if (event.kind === "transport_error") {
      setError("realtime_transport_error");
      transition("network_degraded");
      return;
    }
    if (
      event.kind === "transport_closed" &&
      sessionRef.current.state !== "ended" &&
      sessionRef.current.state !== "failed"
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

  async function stop(): Promise<void> {
    if (sessionRef.current.state !== "live") {
      return;
    }
    transition("stopping");
    await MurmurAudioModule.stopCapture("user_stop");
    clientRef.current?.finish();
    clearCloseTimer(closeTimerRef);
    clearCloseTimer(sessionTimerRef);
    closeTimerRef.current = setTimeout(() => {
      void finishSession("ended");
    }, sessionCloseTimeoutMs);
  }

  async function cancel(): Promise<void> {
    clearCloseTimer(closeTimerRef);
    clearCloseTimer(sessionTimerRef);
    transition("cancelling");
    const appSessionId = sessionRef.current.identity.app_session_id;
    clientRef.current?.close("user_cancel");
    clientRef.current = null;
    await Promise.all([
      MurmurAudioModule.stopCapture("user_cancel"),
      MurmurAudioModule.clearPlayback("user_cancel"),
      closeWorkerSession(appSessionId, "cancel"),
    ]);
    spanRef.current = null;
    setSpans([]);
    transition("ended");
  }

  async function finishSession(state: "ended" | "failed"): Promise<void> {
    if (finishingRef.current) {
      return;
    }
    finishingRef.current = true;
    clearCloseTimer(closeTimerRef);
    clearCloseTimer(sessionTimerRef);
    const appSessionId = sessionRef.current.identity.app_session_id;
    clientRef.current?.close("session_complete");
    clientRef.current = null;
    await MurmurAudioModule.stopCapture("session_complete");
    if (state === "failed") {
      await MurmurAudioModule.clearPlayback("session_failed");
    }
    if (spanRef.current) {
      updateSpan((span) => ({
        ...span,
        committed_translated_caption: span.translated_caption || null,
        partial_translated_caption: null,
        status: state === "failed" ? "failed" : "committed",
        updated_at_ms: Date.now(),
      }));
    }
    await closeWorkerSession(appSessionId, state);
    transition(state);
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

  const diagnosticsSnapshot = useMemo(() => {
    const span = spans[0];
    return {
      runtime: {
        realtime_socket_open: session.state === "live" || session.state === "stopping",
        source_char_count: span?.source_caption.length ?? 0,
        translated_char_count: span?.translated_caption.length ?? 0,
      },
    };
  }, [session.state, spans]);

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
