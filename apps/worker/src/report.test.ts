import { describe, expect, it } from "vitest";

import { canAcceptReportDurable, createSessionRecordDurable } from "./rateLimitDurableObject";
import { forwardReport, parseTranslationReport } from "./report";

describe("translation reports", () => {
  it("validates report categories and required fields", () => {
    expect(
      parseTranslationReport({
        app_session_id: "session",
        error_category: "inaccurate",
        revision: 1,
        source_language: "en",
        span_id: "span",
        target_language: "ar",
      }),
    ).toMatchObject({
      app_session_id: "session",
      error_category: "inaccurate",
      span_id: "span",
    });

    expect(
      parseTranslationReport({
        app_session_id: "session",
        error_category: "bad_kind",
        revision: 1,
        source_language: "en",
        span_id: "span",
        target_language: "ar",
      }),
    ).toEqual({ error: "invalid_report_category" });

    expect(
      parseTranslationReport({
        app_session_id: "session",
        error_category: "inaccurate",
        revision: 1,
        source_language: "auto",
        span_id: "span",
        target_language: "ar",
      }),
    ).toMatchObject({
      source_language: "auto",
      target_language: "ar",
    });

    expect(
      parseTranslationReport({
        app_session_id: "session",
        error_category: "inaccurate",
        revision: 1,
        source_language: "zz",
        span_id: "span",
        target_language: "ar",
      }),
    ).toEqual({ error: "invalid_source_language" });

    expect(
      parseTranslationReport({
        app_session_id: "session",
        error_category: "inaccurate",
        revision: 1,
        source_language: "en",
        span_id: "span",
        target_language: "en",
      }),
    ).toEqual({ error: "same_language_pair" });

    expect(
      parseTranslationReport({
        app_session_id: "session",
        error_category: "inaccurate",
        revision: 0,
        source_language: "en",
        span_id: "span",
        target_language: "ar",
      }),
    ).toEqual({ error: "invalid_revision" });
  });

  it("rate limits repeated reports per session", async () => {
    const sessionId = `session_report_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: sessionId,
      hashed_install_id: `install_report_${Date.now()}`,
      now_ms: Date.now(),
    });
    for (let index = 0; index < 10; index += 1) {
      await expect(
        canAcceptReportDurable({
          app_session_id: sessionId,
          now_ms: Date.now(),
        }),
      ).resolves.toEqual({ ok: true });
    }
    await expect(
      canAcceptReportDurable({
        app_session_id: sessionId,
        now_ms: Date.now(),
      }),
    ).resolves.toEqual({ ok: false, code: "report_rate_limited" });
  });

  it("rejects reports for unknown sessions", async () => {
    await expect(
      canAcceptReportDurable({
        app_session_id: `session_unknown_report_${Date.now()}`,
        now_ms: Date.now(),
      }),
    ).resolves.toEqual({ ok: false, code: "session_closed" });
  });

  it("does not fail report receipt creation when the webhook is unavailable", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("offline");
    };

    try {
      await expect(
        forwardReport({
          report: {
            app_session_id: "session",
            error_category: "other",
            revision: 1,
            source_language: "en",
            span_id: "span",
            target_language: "ar",
          },
          reportWebhookUrl: "https://example.invalid/report",
          receipt: {
            created_at_ms: Date.now(),
            report_id: "report",
            retained_text_snapshot: false,
          },
        }),
      ).resolves.toEqual({ ok: false, reason: "webhook_network_error" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
