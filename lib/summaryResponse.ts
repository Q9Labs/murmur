import type { SummaryResponse } from "./transport/types";

type SummaryHttpStatus = {
  ok: boolean;
  status: number;
};

export function normalizeSummaryResponse(
  response: SummaryHttpStatus,
  payload: unknown,
): SummaryResponse {
  const errorPayload = parseSummaryErrorPayload(payload);
  if (errorPayload) {
    return errorPayload;
  }
  if (!response.ok || !payload) {
    return {
      error: `summary_http_${response.status}`,
      retryable: response.status === 429 || response.status >= 500,
    };
  }
  return payload as SummaryResponse;
}

function parseSummaryErrorPayload(payload: unknown): Extract<SummaryResponse, { error: string }> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const maybePayload = payload as { error?: unknown; retryable?: unknown };
  if (typeof maybePayload.error !== "string" || typeof maybePayload.retryable !== "boolean") {
    return null;
  }
  return {
    error: maybePayload.error,
    retryable: maybePayload.retryable,
  };
}
