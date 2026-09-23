import { describe, expect, it } from "vitest";

import { firstProGrantMs } from "./allowanceUpgrade";

describe("Free to Pro upgrade", () => {
  it("keeps the first Pro cycle at a 120-minute total cap", () => {
    expect(firstProGrantMs(3 * 60_000)).toBe(117 * 60_000);
  });

  it("grants the full Pro value when no Free time was used", () => {
    expect(firstProGrantMs(0)).toBe(120 * 60_000);
  });

  it("respects the active product's monthly allowance", () => {
    expect(firstProGrantMs(3 * 60_000, 90 * 60_000)).toBe(87 * 60_000);
    expect(firstProGrantMs(3 * 60_000, 400 * 60_000)).toBe(397 * 60_000);
  });
});
