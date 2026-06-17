import type { MutableRefObject } from "react";

import type { AudioFrameEvent } from "../../modules/murmur-audio";
import type { DeepgramLiveClient } from "../providers/deepgram";

export const speechRmsThreshold = 0.012;
const silenceRmsThreshold = 0.006;
const silenceFinalizeDelayMs = 800;
const ultravoxVadPostSpeechHoldMs = 480;
export const echoGatePostRollMs = 450;
const echoGateFallbackMs = 1_000;
const maxEchoGateMs = 12_000;

export function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function shouldGateMicFrameForEcho(echoGateUntilMs: number): boolean {
  return Date.now() < echoGateUntilMs;
}

export function nextEchoGateUntilMs(playbackQueuedMs: number): number {
  const activePlaybackMs = Math.min(
    maxEchoGateMs,
    Math.max(echoGateFallbackMs, Number.isFinite(playbackQueuedMs) ? playbackQueuedMs : 0),
  );
  return Date.now() + activePlaybackMs + echoGatePostRollMs;
}

export function shouldSendUltravoxFrame(
  frame: AudioFrameEvent,
  vadEnabled: boolean,
  vadUntilMsRef: MutableRefObject<number>,
): boolean {
  if (!vadEnabled) {
    return true;
  }
  const now = Date.now();
  if (frame.rms >= silenceRmsThreshold) {
    vadUntilMsRef.current = now + ultravoxVadPostSpeechHoldMs;
    return true;
  }
  return now < vadUntilMsRef.current;
}

export function scheduleSilenceFinalize(params: {
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

export function clearSilenceFinalize(
  timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
): void {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

export function startDeepgramKeepAlive(
  deepgramRef: MutableRefObject<DeepgramLiveClient | null>,
  intervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>,
): void {
  clearDeepgramKeepAlive(intervalRef);
  intervalRef.current = setInterval(() => {
    deepgramRef.current?.keepAlive();
  }, 8000);
}

export function clearDeepgramKeepAlive(
  intervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>,
): void {
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
}
