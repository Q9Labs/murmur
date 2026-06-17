import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({
  getWorkerBaseUrl: () => "https://worker.example.test",
}));

import { reportTranslation } from "./reportTranslation";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reportTranslation", () => {
  it("posts the report to the Worker report endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ receipt_id: "receipt_1" }))),
    );

    await expect(
      reportTranslation({
        app_session_id: "session_1",
        error_category: "inaccurate",
        optional_source_text_snapshot: "hello",
        optional_translated_text_snapshot: "hola",
        revision: 1,
        source_language: "en",
        span_id: "span_1",
        target_language: "es",
      }),
    ).resolves.toEqual({ receipt_id: "receipt_1" });

    expect(fetch).toHaveBeenCalledWith("https://worker.example.test/v1/report", {
      body: expect.any(String),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });

  it("normalizes HTTP and Worker error payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "bad_report" }), { status: 400 })),
    );

    await expect(
      reportTranslation({
        app_session_id: "session_1",
        error_category: "offensive_harmful",
        optional_source_text_snapshot: "hello",
        revision: 1,
        source_language: "en",
        span_id: "span_1",
        target_language: "es",
      }),
    ).resolves.toEqual({ error: "report_http_400" });
  });
});
