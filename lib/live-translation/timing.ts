import type { MutableRefObject } from "react";

export function recordElapsedLatency(
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

export function getCurrentSttStartedAt(
  speechStartedAtRef: MutableRefObject<number | null>,
  localSpeechStartedAtRef: MutableRefObject<number | null>,
): number | undefined {
  return speechStartedAtRef.current ?? localSpeechStartedAtRef.current ?? undefined;
}

export function resetCurrentSttTiming(
  speechStartedAtRef: MutableRefObject<number | null>,
  localSpeechStartedAtRef: MutableRefObject<number | null>,
): void {
  speechStartedAtRef.current = null;
  localSpeechStartedAtRef.current = null;
}
