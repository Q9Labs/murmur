import type { SessionState } from "@murmur/protocol/session";

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
