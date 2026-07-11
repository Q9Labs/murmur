import { describe, expect, it } from "vitest";

import type { SummaryRequest, TranslationRequest } from "@murmur/protocol/transport/types";
import {
  sessionSummaryCharLimit,
  validateSummaryRequest,
  validateTranslationModelRouteForEnv,
  validateTranslationRequest,
} from "./validation";

function makeTranslationRequest(overrides: Partial<TranslationRequest> = {}): TranslationRequest {
  return {
    app_session_id: "session_valid_123",
    connection_id: "connection_valid_123",
    context_spans: [],
    event_seq: 1,
    revision: 1,
    session_epoch: 1,
    source_caption: "Hello",
    source_language: "en",
    span_id: "span_valid",
    target_language: "ar",
    translation_attempt: 1,
    ...overrides,
  };
}

function makeSummaryRequest(overrides: Partial<SummaryRequest> = {}): SummaryRequest {
  const sourceCaption = "We are discussing Murmur release readiness.";
  return {
    app_session_id: "session_summary_valid",
    input_memory_version: 4,
    previous_summary: {
      memory_version: 4,
      source_char_count_summarized: 0,
      text: "",
      updated_at_ms: 1,
      updated_through_span_id: null,
    },
    session_epoch: 1,
    source_language: "en",
    spans_to_summarize: [
      {
        committed_at_ms: 2,
        revision: 1,
        source_caption: sourceCaption,
        source_char_count: sourceCaption.length,
        span_id: "span_1",
        translated_caption: "target",
      },
    ],
    summary_job_id: "summary_job_123",
    target_language: "ar",
    ...overrides,
  };
}

describe("worker translation validation", () => {
  it("validates translation WebSocket request fields", () => {
    const request = makeTranslationRequest();

    expect(validateTranslationRequest(request)).toBeNull();
    expect(validateTranslationRequest({ ...request, source_language: "auto" })).toBeNull();
    expect(
      validateTranslationRequest({ ...request, source_language: "zz" } as unknown as TranslationRequest),
    ).toBe("invalid_source_language");
    expect(
      validateTranslationRequest({ ...request, source_status: "draft" } as unknown as TranslationRequest),
    ).toBe("invalid_source_status");
    expect(validateTranslationRequest({ ...request, target_language: "en" })).toBe("same_language_pair");
    expect(validateTranslationRequest({ ...request, source_caption: " " })).toBe("empty_source_caption");
    expect(
      validateTranslationRequest({
        ...request,
        translation_model_route: "not_a_route",
      } as unknown as TranslationRequest),
    ).toBe("invalid_translation_model_route");
    expect(
      validateTranslationRequest({
        ...request,
        context_spans: Array.from({ length: 11 }, (_, index) => ({
          source_caption: `source ${index}`,
          span_id: `span_${index}`,
          translated_caption: `target ${index}`,
        })),
      }),
    ).toBe("invalid_context_spans");
  });

  it("validates summary requests and summary size limits", () => {
    expect(validateSummaryRequest(makeSummaryRequest())).toBeNull();
    expect(validateSummaryRequest(null)).toBe("invalid_json");
    expect(
      validateSummaryRequest(
        makeSummaryRequest({
          previous_summary: {
            ...makeSummaryRequest().previous_summary,
            text: "x".repeat(sessionSummaryCharLimit + 1),
          },
        }),
      ),
    ).toBe("invalid_previous_summary");

    const longCaption = "x".repeat(5001);
    expect(
      validateSummaryRequest(
        makeSummaryRequest({
          spans_to_summarize: [
            {
              committed_at_ms: 2,
              revision: 1,
              source_caption: longCaption,
              source_char_count: longCaption.length,
              span_id: "span_long",
              translated_caption: "target",
            },
          ],
        }),
      ),
    ).toBe("summary_spans_too_large");
  });

  it("rejects development model routes only in production", () => {
    expect(validateTranslationModelRouteForEnv("groq_gpt_oss_120b_low", {})).toBeNull();
    expect(
      validateTranslationModelRouteForEnv("groq_gpt_oss_120b_low", {
        MURMUR_ENV: "production",
      }),
    ).toBe("dev_translation_model_route_unavailable");
  });
});
