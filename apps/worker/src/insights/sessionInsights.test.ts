import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildInsightTelemetryPayload,
  createInsightCollector,
  parseInsightResponse,
  requestSessionInsight,
} from "./sessionInsights";

const validInsight = {
  setting: "lecture",
  event_name: null,
  topic: "Climate policy",
  domain_terms: ["emissions"],
  speakers_estimate: "1",
  user_intent: "Follow a lecture",
  translation_quality: 4,
  confusions: [],
  sentiment: "neutral",
  summary: "A speaker discussed climate policy.",
  product_signals: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("session insights", () => {
  it("requires at least 30 seconds of translation and drops accumulated text after finishing", () => {
    const collector = createInsightCollector();
    collector.add("Private translated words", 1_000);
    expect(collector.finish(30_999)).toBeNull();
    expect(collector.finish(31_000)).toEqual({
      durationMs: 30_000,
      text: "Private translated words",
    });
    expect(collector.finish(40_000)).toBeNull();
  });

  it("requests strict JSON from the configured model with a mocked OpenRouter call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(validInsight) } }],
    })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestSessionInsight("test-only-key", "openai/gpt-6-luna", "Sensitive transcript"))
      .resolves.toEqual(validInsight);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("openai/gpt-6-luna");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.messages[1].content).toBe("Sensitive transcript");
  });

  it("rejects malformed model output rather than storing it", () => {
    const envelope = { choices: [{ message: { content: JSON.stringify({
      ...validInsight,
      topic: "one two three four five six seven eight nine",
    }) } }] };
    expect(parseInsightResponse(envelope)).toBeNull();
  });

  it("suppresses opted-out insight analytics and includes no free text when enabled", () => {
    const insight = parseInsightResponse({ choices: [{ message: { content: JSON.stringify(validInsight) } }] });
    if (!insight) throw new Error("test_insight_invalid");
    const session = {
      appSessionId: "session_12345678",
      customerId: "customer_1",
      hashedInstallId: "hash_12345678",
      sourceLanguage: "en",
      targetLanguage: "ar",
      createdAt: "2026-09-23T00:00:00Z",
    };
    expect(buildInsightTelemetryPayload(false, insight, session, 30_000)).toBeNull();
    expect(buildInsightTelemetryPayload(true, insight, session, 30_000)).toEqual({
      event: "session_insight",
      setting: "lecture",
      speakers_estimate: "1",
      translation_quality: 4,
      sentiment: "neutral",
      duration_ms: 30_000,
      source_language: "en",
      target_language: "ar",
    });
  });
});
