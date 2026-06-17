import { describe, expect, it } from "vitest";

import type { SummaryRequest, TranslationRequest } from "../../../lib/transport/types";
import {
  buildInterpreterSystemPrompt,
  buildInterpreterUserPrompt,
  buildPreviewGateSystemPrompt,
  buildPreviewGateUserPrompt,
  buildSummaryPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  shouldUseTargetActionProtocol,
} from "./prompts";

function makeTranslationRequest(overrides: Partial<TranslationRequest> = {}): TranslationRequest {
  return {
    app_session_id: "session_1",
    connection_id: "connection_1",
    context_spans: [
      {
        source_caption: "Good morning.",
        span_id: "span_previous",
        translated_caption: "صباح الخير.",
      },
    ],
    context_summary: "hotel booking",
    event_seq: 1,
    revision: 1,
    session_epoch: 1,
    source_caption: "I need to book",
    source_language: "en",
    source_status: "stable",
    span_id: "span_current",
    target_language: "ar",
    translation_attempt: 1,
    ...overrides,
  };
}

function makeSummaryRequest(): SummaryRequest {
  return {
    app_session_id: "session_summary_valid",
    input_memory_version: 4,
    previous_summary: {
      memory_version: 4,
      source_char_count_summarized: 0,
      text: "travel planning",
      updated_at_ms: 1,
      updated_through_span_id: null,
    },
    session_epoch: 1,
    source_language: "en",
    spans_to_summarize: [
      {
        committed_at_ms: 2,
        revision: 1,
        source_caption: "We need a late checkout.",
        source_char_count: "We need a late checkout.".length,
        span_id: "span_1",
        translated_caption: "target",
      },
    ],
    summary_job_id: "summary_job_123",
    target_language: "ar",
  };
}

describe("worker prompt builders", () => {
  it("builds phrase translation prompts with context and current source", () => {
    expect(buildSystemPrompt("English", "Arabic")).toContain("professional translator from English to Arabic");

    const prompt = buildUserPrompt(makeTranslationRequest());

    expect(prompt).toContain("Untrusted session summary");
    expect(prompt).toContain("hotel booking");
    expect(prompt).toContain("Previous stable spans");
    expect(prompt).toContain("Good morning.");
    expect(prompt).toContain("I need to book");
  });

  it("builds target-action prompts for continuous interpretation", () => {
    expect(buildInterpreterSystemPrompt("English", "Arabic")).toContain("Return exactly one action");
    expect(buildInterpreterSystemPrompt("English", "Arabic")).toContain("COMMIT\\nArabic translation");

    const prompt = buildInterpreterUserPrompt(makeTranslationRequest());

    expect(prompt).toContain("source_status: stable");
    expect(prompt).toContain("Current live source prefix:");
    expect(prompt).toContain("Return only WAIT or COMMIT");
    expect(shouldUseTargetActionProtocol(makeTranslationRequest({ translation_mode: "continuous" }))).toBe(true);
  });

  it("builds preview-gate prompts with W/C actions", () => {
    expect(buildPreviewGateSystemPrompt("English", "Arabic")).toContain("C\\nArabic draft translation");

    const prompt = buildPreviewGateUserPrompt(makeTranslationRequest());

    expect(prompt).toContain("Return only W or C");
    expect(prompt).toContain("source_status: stable");
  });

  it("builds compact summary prompts from previous summary and committed spans", () => {
    const prompt = buildSummaryPrompt(makeSummaryRequest());

    expect(prompt).toContain("Previous compact summary:");
    expect(prompt).toContain("travel planning");
    expect(prompt).toContain("New committed spans");
    expect(prompt).toContain("We need a late checkout.");
  });
});
