import { describe, expect, it } from "vitest";

import { mergedFreeRemainingMs } from "./accountMerge";
import { freeAllowanceMs } from "./catalog";

describe("guest account merge", () => {
  it("keeps one free cap instead of stacking untouched grants", () => {
    expect(mergedFreeRemainingMs({
      destinationOriginalMs: freeAllowanceMs,
      destinationRemainingMs: freeAllowanceMs,
      sourceOriginalMs: freeAllowanceMs,
      sourceRemainingMs: freeAllowanceMs,
    })).toBe(freeAllowanceMs);
  });

  it("combines free usage from both customers", () => {
    expect(mergedFreeRemainingMs({
      destinationOriginalMs: freeAllowanceMs,
      destinationRemainingMs: 4 * 60_000,
      sourceOriginalMs: freeAllowanceMs,
      sourceRemainingMs: 3 * 60_000,
    })).toBe(2 * 60_000);
  });

  it("floors the merged free balance at zero", () => {
    expect(mergedFreeRemainingMs({
      destinationOriginalMs: freeAllowanceMs,
      destinationRemainingMs: 1 * 60_000,
      sourceOriginalMs: freeAllowanceMs,
      sourceRemainingMs: 2 * 60_000,
    })).toBe(0);
  });
});
