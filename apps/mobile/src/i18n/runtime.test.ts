import { describe, expect, it, vi } from "vitest";

import {
  createTranslator,
  formatUiDate,
  formatUiNumber,
  translatorForCatalog,
  uiContentDirectionStyle,
  uiMirrorStyle,
  uiTextDirectionStyle,
} from "./runtime";

describe("UI locale runtime", () => {
  it("rejects unknown keys and missing interpolation values clearly", () => {
    const translate = createTranslator("en");
    expect(translate("home.reportReceived", { receiptId: "abc123" })).toBe("Report received: abc123");
    expect(() => translate("home.reportReceived")).toThrow("Missing interpolation value");
    expect(() => translate("not-a-key" as never)).toThrow("Unknown i18n message key");
  });

  it("falls back to English when a locale is missing a key", () => {
    const translate = translatorForCatalog({ "home.stop": "Detener" });
    expect(translate("home.stop")).toBe("Detener");
    expect(translate("home.listen")).toBe("Listen");
    expect(translate("home.reportReceived", { receiptId: "r1" })).toBe("Report received: r1");
  });

  it("translates through the shipped catalogs", () => {
    expect(createTranslator("ar")("home.stop")).not.toBe("Stop");
    expect(() => createTranslator("xx" as never)).toThrow("Unsupported UI locale");
  });

  it("uses explicit direction styles and mirrors directional icons only in RTL", () => {
    expect(uiContentDirectionStyle("ar")).toEqual({ direction: "rtl" });
    expect(uiContentDirectionStyle("ur")).toEqual({ direction: "rtl" });
    expect(uiContentDirectionStyle("ja")).toEqual({ direction: "ltr" });
    expect(uiTextDirectionStyle("rtl")).toEqual({ textAlign: "right", writingDirection: "rtl" });
    expect(uiTextDirectionStyle("de")).toEqual({ textAlign: "left", writingDirection: "ltr" });
    expect(uiMirrorStyle("rtl")).toEqual({ transform: [{ scaleX: -1 }] });
    expect(uiMirrorStyle("ltr")).toBeUndefined();
    expect(() => uiTextDirectionStyle("up" as never)).toThrow("Unsupported UI direction");
  });

  it("keeps text alignment physical on the web and relative to the layout on native", () => {
    expect(uiTextDirectionStyle("ltr", "rtl")).toEqual({ textAlign: "left", writingDirection: "ltr" });
    vi.stubEnv("EXPO_OS", "ios");
    try {
      expect(uiTextDirectionStyle("ar")).toEqual({ textAlign: "left", writingDirection: "rtl" });
      expect(uiTextDirectionStyle("ltr", "rtl")).toEqual({ textAlign: "right", writingDirection: "ltr" });
      expect(uiTextDirectionStyle("rtl", "ltr")).toEqual({ textAlign: "right", writingDirection: "rtl" });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("formats counts without grouping and uses Eastern Arabic-Indic digits", () => {
    expect(formatUiNumber(123456, "en")).toBe("123456");
    expect(formatUiNumber(123456, "ar")).toBe("١٢٣٤٥٦");
    expect(formatUiNumber(123456, "ar", { grouping: true })).toContain("١٢٣");
    expect(formatUiNumber(1234.5, "de", { grouping: true })).toBe("1.234,5");
    expect(() => formatUiNumber(Number.NaN, "en")).toThrow("finite number");
  });

  it("formats dates with the UI locale", () => {
    const date = Date.UTC(2026, 8, 23, 12);
    expect(formatUiDate(date, "en", { day: "numeric", month: "long", timeZone: "UTC" })).toBe("September 23");
    expect(formatUiDate(date, "de", { day: "numeric", month: "long", timeZone: "UTC" })).toBe("23. September");
    expect(formatUiDate(date, "ja", { day: "numeric", month: "long", timeZone: "UTC" })).toBe("9月23日");
  });
});
