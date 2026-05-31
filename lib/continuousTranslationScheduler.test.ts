import { describe, expect, it } from "vitest";

import { ContinuousTranslationScheduler } from "./continuousTranslationScheduler";
import type { TranslationRequest } from "./transport/types";

function makeRequest(spanId: string, attempt = 1): TranslationRequest {
  return {
    app_session_id: "session_1",
    connection_id: "connection_1",
    context_spans: [],
    event_seq: 1,
    revision: 1,
    session_epoch: 1,
    source_caption: `source ${spanId}`,
    source_language: "en",
    span_id: spanId,
    target_language: "ar",
    translation_attempt: attempt,
    translation_mode: "continuous",
  };
}

describe("ContinuousTranslationScheduler", () => {
  it("limits in-flight translations and preserves queue order", () => {
    const scheduler = new ContinuousTranslationScheduler({ max_in_flight: 2 });

    scheduler.enqueue(makeRequest("span_1"), "span_1:1", 1000);
    scheduler.enqueue(makeRequest("span_2"), "span_2:1", 1000);
    scheduler.enqueue(makeRequest("span_3"), "span_3:1", 1000);

    expect(scheduler.nextReady(1200)?.request.span_id).toBe("span_1");
    expect(scheduler.nextReady(1200)?.request.span_id).toBe("span_2");
    expect(scheduler.nextReady(1200)).toBeNull();

    scheduler.complete("span_1:1");
    expect(scheduler.nextReady(1300)?.request.span_id).toBe("span_3");
  });

  it("retries retryable failures after backoff and stops at the attempt cap", () => {
    const scheduler = new ContinuousTranslationScheduler({
      max_attempts: 2,
      retry_delays_ms: [750],
    });

    scheduler.enqueue(makeRequest("span_1"), "span_1:1", 1000);
    expect(scheduler.nextReady(1000)?.request.translation_attempt).toBe(1);

    const retry = scheduler.fail("span_1:1", true, 1200);
    expect(retry.exhausted).toBe(false);
    if (!retry.exhausted) {
      expect(retry.retry_delay_ms).toBe(750);
    }
    expect(scheduler.nextReady(1800)).toBeNull();
    expect(scheduler.nextReady(1950)?.request.translation_attempt).toBe(2);

    expect(scheduler.fail("span_1:1", true, 2000)).toMatchObject({
      exhausted: true,
    });
  });

  it("requeues active requests when the transport reconnects", () => {
    const scheduler = new ContinuousTranslationScheduler();

    scheduler.enqueue(makeRequest("span_1"), "span_1:1", 1000);
    scheduler.enqueue(makeRequest("span_2"), "span_2:1", 1000);
    expect(scheduler.nextReady(1000)?.request.span_id).toBe("span_1");
    expect(scheduler.nextReady(1000)?.request.span_id).toBe("span_2");

    const requeued = scheduler.requeueInFlight(1500);

    expect(requeued.map((item) => item.request.span_id)).toEqual(["span_1", "span_2"]);
    expect(scheduler.nextReady(1500)?.request.translation_attempt).toBe(2);
    expect(scheduler.nextReady(1500)?.request.translation_attempt).toBe(2);
  });
});
