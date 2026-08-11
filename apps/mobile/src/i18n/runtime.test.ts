import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, View: "div" }));

import {
  createTranslator,
  directionForLocale,
  formatUiNumber,
  isUiLocale,
  uiContentDirectionStyle,
  uiTextDirectionStyle,
} from "./index";

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
