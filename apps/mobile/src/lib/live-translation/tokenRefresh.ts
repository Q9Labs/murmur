import type { MutableRefObject } from "react";

const tokenRefreshRetryDelaysMs = [5_000, 10_000, 20_000];

export function scheduleTokenRefresh(params: {
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

export function scheduleTokenRefreshRetry(params: {
  refresh: () => Promise<void>;
  retryInMs: number;
  timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}): void {
  clearTokenRefresh(params.timeoutRef);
  params.timeoutRef.current = setTimeout(() => {
    void params.refresh();
  }, params.retryInMs);
}

export function nextTokenRefreshRetryDelayMs(retryCount: number): number | null {
  return tokenRefreshRetryDelaysMs[retryCount] ?? null;
}

export function clearTokenRefresh(
  timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
): void {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}
