import { describe, expect, it } from "vitest";

import {
  createTranslator,
  formatUiNumber,
  uiContentDirectionStyle,
  uiTextDirectionStyle,
} from "./runtime";
import { directionForLocale, isUiLocale } from "./types";

describe("UI locale runtime", () => {
  it("rejects unknown keys and missing interpolation values clearly", () => {
    const translate = createTranslator("en");
    expect(translate("home.reportReceived", { receiptId: "abc123" })).toBe("Report received: abc123");
    expect(() => translate("home.reportReceived")).toThrow("Missing interpolation value");
    expect(() => translate("not-a-key" as never)).toThrow("Unknown i18n message key");
  });

  it("uses exact locale values and explicit direction styles", () => {
    expect(isUiLocale("ar")).toBe(true);
    expect(isUiLocale("ar-SA")).toBe(false);
    expect(directionForLocale("ar")).toBe("rtl");
    expect(uiContentDirectionStyle("ar")).toEqual({ direction: "rtl" });
    expect(uiTextDirectionStyle("rtl")).toEqual({ textAlign: "right", writingDirection: "rtl" });
  });

  it("formats counts without grouping and uses Eastern Arabic-Indic digits", () => {
    expect(formatUiNumber(123456, "en")).toBe("123456");
    expect(formatUiNumber(123456, "ar")).toBe("١٢٣٤٥٦");
    expect(formatUiNumber(123456, "ar", { grouping: true })).toContain("١٢٣");
  });
});
