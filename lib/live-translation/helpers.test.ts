import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContinuousMemoryState } from "../continuousMemory";
import type { TranslationSpan } from "../session";
import type { TranslationRequest } from "../transport/types";
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

function ref<T>(current: T): { current: T } {
  return { current };
}

function makeTranslationRequest(overrides: Partial<TranslationRequest> = {}): TranslationRequest {
  return {
    app_session_id: "session_1",
    connection_id: "connection_1",
    context_spans: [],
    event_seq: 1,
    revision: 2,
    session_epoch: 1,
    source_caption: "  hello   world  ",
    source_language: "en",
    span_id: "span_1",
    target_language: "ar",
    translation_attempt: 3,
    ...overrides,
  };
}

function makeSpan(overrides: Partial<TranslationSpan> = {}): TranslationSpan {
  return {
    committed_translated_caption: "committed",
    created_at_ms: 100,
    partial_translated_caption: "draft",
    provider_metadata: null,
    revision: 2,
    source_caption: "hello",
    source_status: "stable",
    span_id: "span_1",
    speech_attempt: 0,
    speech_request_id: null,
    speech_status: "idle",
    status: "failed",
    supersedes_span_ids: [],
    translated_caption: "old draft",
    translation_attempt: 2,
    translation_client_request_id: "old_client_request",
    translation_request_id: "server_request",
    updated_at_ms: 100,
    ...overrides,
  };
}

describe("live translation extracted helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("builds diagnostics snapshots without leaking hook state shape", () => {
    const continuousMemory: ContinuousMemoryState = {
      memory_version: 7,
      rolling_memory: [
        {
          committed_at_ms: 100,
          revision: 1,
          source_caption: "hello",
          source_char_count: 5,
          span_id: "span_a",
          translated_caption: "مرحبا",
        },
        {
          committed_at_ms: 200,
          revision: 1,
          source_caption: "world",
          source_char_count: 8,
          span_id: "span_b",
          translated_caption: "العالم",
        },
      ],
      summary: {
        memory_version: 7,
        source_char_count_summarized: 20,
        text: "prior trip context",
        updated_at_ms: 300,
        updated_through_span_id: "span_a",
      },
      summary_job_running: true,
    };

    expect(
      buildLiveTranslationDiagnosticsSnapshot({
        continuousMemory,
        lastCommittedSourceCaption: "last committed",
        pendingWaitPrefix: "pending",
        scheduler: {
          counts: { in_flight: 1, queued: 2 },
          in_flight: [],
          queued: [],
        },
        tentativeSourceCaption: "tentative",
        translationSocketOpen: true,
      }),
    ).toMatchObject({
      continuous_memory: {
        memory_version: 7,
        rolling_source_char_count: 13,
        rolling_span_count: 2,
        summary_job_running: true,
        summary_length: "prior trip context".length,
        summary_updated_through_span_id: "span_a",
      },
      runtime: {
        last_committed_source_caption: "last committed",
        pending_wait_prefix: "pending",
        tentative_source_caption: "tentative",
        translation_socket_open: true,
      },
      translation_scheduler: {
        counts: { in_flight: 1, queued: 2 },
      },
    });
  });

  it("normalizes span text and refreshes retry identity", () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);
    vi.spyOn(Math, "random").mockReturnValue(0.123456);

    expect(normalizeCaption("  Hello   WORLD  ")).toBe("hello world");
    expect(joinSourceCaptions("  wait   for ", " this  ")).toBe("wait for this");
    expect(spanKey("span_1", 2)).toBe("span_1:2");

    const clientRequestId = createTranslationClientRequestId("span_1", 2, 3);
    expect(clientRequestId).toMatch(/^ctr_span_1_2_3_[a-z0-9]+_[a-z0-9]+$/);
    expect(createSummaryJobId()).toMatch(/^summary_[a-z0-9]+_[a-z0-9]+$/);

    const request = withRetryClientRequestId(makeTranslationRequest());
    expect(request.client_request_id).toMatch(/^ctr_span_1_2_3_/);

    expect(resetSpanForContinuousRetry(makeSpan(), request)).toMatchObject({
      partial_translated_caption: null,
      status: "translating",
      translated_caption: "committed",
      translation_attempt: 3,
      translation_client_request_id: request.client_request_id,
      translation_request_id: null,
      updated_at_ms: 123456,
    });
  });

  it("records and resets speech timing refs", () => {
    vi.spyOn(Date, "now").mockReturnValue(250);
    const recordLatency = vi.fn();

    recordElapsedLatency("deepgram_final", 125, recordLatency);
    recordElapsedLatency(undefined, 125, recordLatency);
    recordElapsedLatency("missing_start", undefined, recordLatency);

    expect(recordLatency).toHaveBeenCalledTimes(1);
    expect(recordLatency).toHaveBeenCalledWith("deepgram_final", 125);

    const speechStartedAtRef = ref<number | null>(null);
    const localSpeechStartedAtRef = ref<number | null>(175);
    expect(getCurrentSttStartedAt(speechStartedAtRef, localSpeechStartedAtRef)).toBe(175);

    speechStartedAtRef.current = 150;
    expect(getCurrentSttStartedAt(speechStartedAtRef, localSpeechStartedAtRef)).toBe(150);

    resetCurrentSttTiming(speechStartedAtRef, localSpeechStartedAtRef);
    expect(getCurrentSttStartedAt(speechStartedAtRef, localSpeechStartedAtRef)).toBeUndefined();
  });

  it("gates echo, VAD frames, silence finalization, and keepalive timers", () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(1_000);

    expect(roundMetric(1.23456)).toBe(1.235);
    expect(nextEchoGateUntilMs(25)).toBe(1_000 + 1_000 + echoGatePostRollMs);
    expect(nextEchoGateUntilMs(20_000)).toBe(1_000 + 12_000 + echoGatePostRollMs);

    vi.mocked(Date.now).mockReturnValue(2_000);
    expect(shouldGateMicFrameForEcho(2_500)).toBe(true);
    expect(shouldGateMicFrameForEcho(1_999)).toBe(false);

    const vadUntilMsRef = ref(0);
    expect(shouldSendUltravoxFrame({ rms: 0.007 } as any, true, vadUntilMsRef)).toBe(true);
    expect(vadUntilMsRef.current).toBe(2_480);
    vi.mocked(Date.now).mockReturnValue(2_100);
    expect(shouldSendUltravoxFrame({ rms: 0.001 } as any, true, vadUntilMsRef)).toBe(true);
    vi.mocked(Date.now).mockReturnValue(2_600);
    expect(shouldSendUltravoxFrame({ rms: 0.001 } as any, true, vadUntilMsRef)).toBe(false);
    expect(shouldSendUltravoxFrame({ rms: 0 } as any, false, vadUntilMsRef)).toBe(true);

    const finalize = vi.fn();
    const deepgramRef = ref({ finalize, keepAlive: vi.fn() } as any);
    const hasSpeechSinceFinalizeRef = ref(false);
    const silenceTimeoutRef = ref<ReturnType<typeof setTimeout> | null>(null);

    scheduleSilenceFinalize({
      deepgramRef,
      frame: { rms: speechRmsThreshold } as any,
      hasSpeechSinceFinalizeRef,
      timeoutRef: silenceTimeoutRef,
    });
    expect(hasSpeechSinceFinalizeRef.current).toBe(true);

    scheduleSilenceFinalize({
      deepgramRef,
      frame: { rms: 0.001 } as any,
      hasSpeechSinceFinalizeRef,
      timeoutRef: silenceTimeoutRef,
    });
    expect(silenceTimeoutRef.current).not.toBeNull();
    vi.advanceTimersByTime(799);
    expect(finalize).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(hasSpeechSinceFinalizeRef.current).toBe(false);
    expect(silenceTimeoutRef.current).toBeNull();

    scheduleSilenceFinalize({
      deepgramRef,
      frame: { rms: speechRmsThreshold } as any,
      hasSpeechSinceFinalizeRef,
      timeoutRef: silenceTimeoutRef,
    });
    scheduleSilenceFinalize({
      deepgramRef,
      frame: { rms: 0.001 } as any,
      hasSpeechSinceFinalizeRef,
      timeoutRef: silenceTimeoutRef,
    });
    clearSilenceFinalize(silenceTimeoutRef);
    expect(silenceTimeoutRef.current).toBeNull();

    const keepAliveIntervalRef = ref<ReturnType<typeof setInterval> | null>(null);
    startDeepgramKeepAlive(deepgramRef, keepAliveIntervalRef);
    vi.advanceTimersByTime(8_000);
    expect(deepgramRef.current?.keepAlive).toHaveBeenCalledTimes(1);
    clearDeepgramKeepAlive(keepAliveIntervalRef);
    vi.advanceTimersByTime(8_000);
    expect(deepgramRef.current?.keepAlive).toHaveBeenCalledTimes(1);
  });

  it("schedules token refreshes and bounded retries", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(100_000);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const timeoutRef = ref<ReturnType<typeof setTimeout> | null>(null);

    expect(nextTokenRefreshRetryDelayMs(0)).toBe(5_000);
    expect(nextTokenRefreshRetryDelayMs(1)).toBe(10_000);
    expect(nextTokenRefreshRetryDelayMs(2)).toBe(20_000);
    expect(nextTokenRefreshRetryDelayMs(3)).toBeNull();

    scheduleTokenRefresh({
      expiresAtMs: 140_000,
      refresh,
      timeoutRef,
    });
    vi.advanceTimersByTime(9_999);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);

    scheduleTokenRefreshRetry({
      refresh,
      retryInMs: 5_000,
      timeoutRef,
    });
    clearTokenRefresh(timeoutRef);
    vi.advanceTimersByTime(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
