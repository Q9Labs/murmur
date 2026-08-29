import { describe, expect, it } from "vitest";

import { firstProGrantMs } from "./allowanceUpgrade";

describe("Free to Pro upgrade", () => {
  it("keeps the first Pro cycle at a three-hour total cap", () => {
    expect(firstProGrantMs(3 * 60_000)).toBe(177 * 60_000);
  });

  it("grants the full Pro value when no Free time was used", () => {
    expect(firstProGrantMs(0)).toBe(180 * 60_000);
  });
});
