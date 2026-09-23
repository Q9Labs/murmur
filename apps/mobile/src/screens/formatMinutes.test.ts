import { describe, expect, it } from "vitest";

import { formatMinutes } from "./formatMinutes";
import { en, uiText } from "./__tests__/uiText";

const ar = uiText("ar");

describe("minute formatting", () => {
  it("formats minutes and hours, rounding up", () => {
    expect(formatMinutes(0, en)).toBe("0 min");
    expect(formatMinutes(20_000, en)).toBe("1 min");
    expect(formatMinutes(120 * 60_000, en)).toBe("2 hr");
    expect(formatMinutes(97 * 60_000, en)).toBe("1 hr 37 min");
  });

  it("uses the UI language's digits", () => {
    expect(formatMinutes(12 * 60_000, ar)).toContain("١٢");
  });
});
