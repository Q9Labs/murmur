import { describe, expect, it } from "vitest";

import {
  appendRollingMemorySpan,
  applySummaryResult,
  createContinuousMemoryState,
  selectSpansForSummary,
  shouldScheduleSummary,
  trimRollingMemoryForPrompt,
} from "./continuousMemory";

describe("continuous memory", () => {
  it("schedules summaries from source character pressure only", () => {
    let memory = createContinuousMemoryState();
    memory = appendRollingMemorySpan(memory, {
      committed_at_ms: 1,
      revision: 1,
      source_caption: "hello",
      span_id: "span_1",
      translated_caption: "مرحبا",
    });

    expect(shouldScheduleSummary(memory, 10)).toBe(false);

    memory = appendRollingMemorySpan(memory, {
      committed_at_ms: 2,
      revision: 1,
      source_caption: "this is a longer source caption",
      span_id: "span_2",
      translated_caption: "target",
    });

    expect(shouldScheduleSummary(memory, 10)).toBe(true);
  });

  it("keeps the newest exact spans when selecting summary input", () => {
    const spans = [
      span("span_1", 10),
      span("span_2", 10),
      span("span_3", 10),
      span("span_4", 10),
    ];

    const selection = selectSpansForSummary(spans, 20);

    expect(selection.spans_to_summarize.map((item) => item.span_id)).toEqual(["span_1", "span_2"]);
    expect(selection.keep_recent_from_span_id).toBe("span_3");
    expect(selection.summarized_through_span_id).toBe("span_2");
  });

  it("chunks summary input so large backlogs can recover", () => {
    const spans = [
      span("span_1", 10),
      span("span_2", 10),
      span("span_3", 10),
      span("span_4", 10),
    ];

    const selection = selectSpansForSummary(spans, 10, 20);

    expect(selection.spans_to_summarize.map((item) => item.span_id)).toEqual(["span_1", "span_2"]);
    expect(selection.keep_recent_from_span_id).toBe("span_4");
    expect(selection.summarized_through_span_id).toBe("span_2");
  });

  it("rejects stale summary results with compare-and-swap", () => {
    const memory = appendRollingMemorySpan(createContinuousMemoryState(), {
      committed_at_ms: 1,
      revision: 1,
      source_caption: "hello",
      span_id: "span_1",
      translated_caption: "target",
    });

    const stale = applySummaryResult({
      current: memory,
      input_memory_version: memory.memory_version - 1,
      summarized_through_span_id: "span_1",
      summary: {
        memory_version: memory.memory_version - 1,
        source_char_count_summarized: 5,
        text: "stale",
        updated_at_ms: 2,
        updated_through_span_id: "span_1",
      },
    });

    expect(stale.summary.text).toBe("");
    expect(stale.rolling_memory).toHaveLength(1);
    expect(stale.summary_job_running).toBe(false);
  });

  it("applies valid summaries and removes only summarized rolling memory", () => {
    const base = createContinuousMemoryState();
    const memory = {
      ...base,
      memory_version: 3,
      rolling_memory: [span("span_1", 5), span("span_2", 5)],
      summary_job_running: true,
      summary: { ...base.summary, memory_version: 3 },
    };

    const applied = applySummaryResult({
      current: memory,
      input_memory_version: 3,
      summarized_through_span_id: "span_1",
      summary: {
        memory_version: 3,
        source_char_count_summarized: 5,
        text: "compact context",
        updated_at_ms: 4,
        updated_through_span_id: "span_1",
      },
    });

    expect(applied.summary.text).toBe("compact context");
    expect(applied.rolling_memory.map((item) => item.span_id)).toEqual(["span_2"]);
    expect(applied.summary_job_running).toBe(false);
  });

  it("trims prompt context from the oldest exact spans", () => {
    const summary = createContinuousMemoryState().summary;
    const result = trimRollingMemoryForPrompt(
      { ...summary, text: "summary" },
      [span("span_1", 20), span("span_2", 20), span("span_3", 20)],
      10,
      60,
    );

    expect(result.map((item) => item.span_id)).toEqual(["span_3"]);
  });
});

function span(spanId: string, chars: number) {
  return {
    committed_at_ms: 1,
    revision: 1,
    source_caption: "x".repeat(chars),
    source_char_count: chars,
    span_id: spanId,
    translated_caption: "y".repeat(chars),
  };
}
