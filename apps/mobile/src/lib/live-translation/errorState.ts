import type { SessionState } from "@murmur/protocol/session";

export function sessionErrorOutcome(code: string): "ended" | "failed" {
  return code === "session_expired" || code === "session_silence_timeout" ||
    code === "allowance_exhausted" || code === "phone_audio_gift_exhausted"
    ? "ended"
    : "failed";
}

export function preserveFirstLiveError(
  currentError: string | null,
  nextError: string,
): string {
  return currentError ?? nextError;
}

export function shouldIgnoreLateTransportEvent(
  currentError: string | null,
  state: SessionState,
): boolean {
  return currentError !== null ||
    state === "failed" ||
    state === "ended" ||
    state === "cancelling";
}
