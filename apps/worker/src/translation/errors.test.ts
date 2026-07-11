import { describe, expect, it } from "vitest";

import type { TranslationRequest } from "@murmur/protocol/transport/types";
import { getTranslationErrorCode, validateTranslatedCaption } from "./errors";

function makeRequest(overrides: Partial<TranslationRequest> = {}): TranslationRequest {
  return {
    app_session_id: "session_1",
    connection_id: "connection_1",
    context_spans: [],
    event_seq: 1,
    revision: 1,
    session_epoch: 1,
    source_caption: "Hello world",
    source_language: "en",
    span_id: "span_1",
    target_language: "ar",
    translation_attempt: 1,
    ...overrides,
  };
}

describe("translation errors", () => {
  it("maps known provider failures to stable client error codes", () => {
    expect(getTranslationErrorCode(new Error("openrouter_http_429"))).toBe("openrouter_http_429");
    expect(getTranslationErrorCode(new Error("groq_timeout"))).toBe("groq_timeout");
    expect(getTranslationErrorCode(new Error("missing_openrouter_api_key"))).toBe("missing_openrouter_api_key");
    expect(getTranslationErrorCode(new Error("unexpected"))).toBe("translation_failed");
    expect(getTranslationErrorCode("not an error")).toBe("translation_failed");
  });

  it("rejects empty or suspiciously short provider translations", () => {
    expect(validateTranslatedCaption(makeRequest(), "  مرحبا  ")).toBe("  مرحبا  ");

    expect(() => validateTranslatedCaption(makeRequest(), "   ", "groq")).toThrow(
      "groq_empty_translation",
    );
    expect(() =>
      validateTranslatedCaption(
        makeRequest({ source_caption: "x".repeat(80) }),
        "ok",
        "openrouter",
      ),
    ).toThrow("openrouter_suspiciously_short_translation");
  });
});
