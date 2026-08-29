import { describe, expect, it } from "vitest";

import { isNewerSubscriptionCursor } from "./subscriptionCursor";

describe("subscription lifecycle ordering", () => {
  it("rejects an older terminal event after a newer renewal", () => {
    expect(isNewerSubscriptionCursor(
      { eventId: "expiration", lifecycleRank: 40, occurredAtMs: 1_000 },
      { eventId: "renewal", lifecycleRank: 10, occurredAtMs: 2_000 },
    )).toBe(false);
  });

  it("uses lifecycle precedence and stable event id at the same effective time", () => {
    expect(isNewerSubscriptionCursor(
      { eventId: "billing", lifecycleRank: 30, occurredAtMs: 2_000 },
      { eventId: "renewal", lifecycleRank: 10, occurredAtMs: 2_000 },
    )).toBe(true);
    expect(isNewerSubscriptionCursor(
      { eventId: "event-b", lifecycleRank: 10, occurredAtMs: 2_000 },
      { eventId: "event-a", lifecycleRank: 10, occurredAtMs: 2_000 },
    )).toBe(true);
  });
});
