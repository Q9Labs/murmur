import { describe, expect, it } from "vitest";

import { didReconciliationAdvance } from "./reconciliation";

describe("didReconciliationAdvance", () => {
  it("requires a newly observed purchase or subscription", () => {
    expect(didReconciliationAdvance(null, { purchaseCount: 1, subscriptionCount: 0 }))
      .toBe(false);
    expect(didReconciliationAdvance(
      { purchaseCount: 1, subscriptionCount: 1 },
      { purchaseCount: 1, subscriptionCount: 1 },
    )).toBe(false);
    expect(didReconciliationAdvance(
      { purchaseCount: 1, subscriptionCount: 1 },
      { purchaseCount: 2, subscriptionCount: 1 },
    )).toBe(true);
    expect(didReconciliationAdvance(
      { purchaseCount: 1, subscriptionCount: 1 },
      { purchaseCount: 1, subscriptionCount: 2 },
    )).toBe(true);
  });
});
