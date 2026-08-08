export const realtimeConnectionTimeoutMs = 15_000;
const sessionExpirySafetyMs = 2_000;

export function getGracefulSessionStopDelay(
  expiresAtMs: number,
  nowMs: number,
): number {
  return Math.max(0, expiresAtMs - nowMs - sessionExpirySafetyMs);
}

export function scheduleRealtimeConnectionDeadline(
  onTimeout: () => void,
  delayMs = realtimeConnectionTimeoutMs,
): () => void {
  const timer = setTimeout(onTimeout, delayMs);
  return () => clearTimeout(timer);
}
