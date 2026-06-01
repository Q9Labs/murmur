import { describe, expect, it } from "vitest";

import { normalizeSummaryResponse } from "./summaryResponse";

describe("summary response normalization", () => {
  it("preserves retryable summary limit errors from non-OK Worker responses", () => {
    expect(
      normalizeSummaryResponse(
        { ok: false, status: 429 },
        { error: "summaries_per_minute_limit", retryable: true },
      ),
    ).toEqual({ error: "summaries_per_minute_limit", retryable: true });
  });

  it("treats bodyless 429 summary responses as retryable fallbacks", () => {
    expect(normalizeSummaryResponse({ ok: false, status: 429 }, null)).toEqual({
      error: "summary_http_429",
      retryable: true,
    });
  });

  it("falls back to non-retryable client errors without a Worker error payload", () => {
    expect(normalizeSummaryResponse({ ok: false, status: 400 }, null)).toEqual({
      error: "summary_http_400",
      retryable: false,
    });
  });
});
