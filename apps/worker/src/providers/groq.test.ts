import { describe, expect, it } from "vitest";

import type { TranslationRequest } from "@murmur/protocol/transport/types";
import {
  buildGroqChatPayload,
  buildGroqPreviewChatPayload,
} from "./groq";

function makeTranslationRequest(overrides: Partial<TranslationRequest> = {}): TranslationRequest {
  return {
    app_session_id: "session_1",
    connection_id: "connection_1",
    context_spans: [],
    event_seq: 1,
    revision: 1,
    session_epoch: 1,
    source_caption: "Hello",
    source_language: "en",
    span_id: "span_current",
    target_language: "ar",
    translation_attempt: 1,
    ...overrides,
  };
}

describe("Groq provider payloads", () => {
  it("builds GPT-OSS payloads for phrase and continuous routes", () => {
    expect(buildGroqChatPayload(makeTranslationRequest())).toMatchObject({
      include_reasoning: false,
      max_tokens: 300,
      model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
      stream: true,
      temperature: 0.1,
    });

    const continuousPayload = buildGroqChatPayload(
      makeTranslationRequest({
        source_status: "stable",
        translation_mode: "continuous",
      }),
    );

    expect(continuousPayload.temperature).toBe(0);
    expect(continuousPayload.messages[0]?.content).toContain("Return exactly one action");
    expect(continuousPayload.messages[1]?.content).toContain("source_status: stable");
  });

  it("builds preview W/C payloads for the Groq preview experiment", () => {
    const previewPayload = buildGroqPreviewChatPayload(
      makeTranslationRequest({
        source_status: "stable",
        translation_model_route: "experiment_groq_preview_gemma",
        translation_mode: "continuous",
      }),
    );

    expect(previewPayload).toMatchObject({
      include_reasoning: false,
      max_tokens: 96,
      model: "openai/gpt-oss-20b",
      reasoning_effort: "low",
      stream: true,
      temperature: 0,
    });
    expect(previewPayload.messages[0]?.content).toContain("Return exactly one action");
    expect(previewPayload.messages[0]?.content).toContain("W");
    expect(previewPayload.messages[0]?.content).toContain("C\\n");
    expect(previewPayload.messages[1]?.content).toContain("source_status: stable");
  });
});
