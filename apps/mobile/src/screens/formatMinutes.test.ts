import { describe, expect, it } from "vitest";

import { formatMinutes } from "./formatMinutes";

describe("minute formatting", () => {
  it("formats minutes and hours, rounding up", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(20_000)).toBe("1 min");
    expect(formatMinutes(120 * 60_000)).toBe("2 hr");
    expect(formatMinutes(97 * 60_000)).toBe("1 hr 37 min");
  });
});
