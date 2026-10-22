import { describe, expect, it } from "vitest";

import { mergedFreeRemainingMs } from "./accountMerge";
import { defaultFreeAllowanceMs } from "./catalog";

describe("guest account merge", () => {
  it("keeps one free cap instead of stacking untouched grants", () => {
    expect(mergedFreeRemainingMs({
      destinationOriginalMs: defaultFreeAllowanceMs,
      destinationRemainingMs: defaultFreeAllowanceMs,
      sourceOriginalMs: defaultFreeAllowanceMs,
      sourceRemainingMs: defaultFreeAllowanceMs,
    })).toBe(defaultFreeAllowanceMs);
  });

  it("combines free usage from both customers", () => {
    expect(mergedFreeRemainingMs({
      destinationOriginalMs: defaultFreeAllowanceMs,
      destinationRemainingMs: 4 * 60_000,
      sourceOriginalMs: defaultFreeAllowanceMs,
      sourceRemainingMs: 3 * 60_000,
    })).toBe(2 * 60_000);
  });

  it("floors the merged free balance at zero", () => {
    expect(mergedFreeRemainingMs({
      destinationOriginalMs: defaultFreeAllowanceMs,
      destinationRemainingMs: 1 * 60_000,
      sourceOriginalMs: defaultFreeAllowanceMs,
      sourceRemainingMs: 2 * 60_000,
    })).toBe(0);
  });
});
