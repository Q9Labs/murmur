import { describe, expect, it } from "vitest";

import {
  directionForLocale,
  intlLocaleTag,
  isUiLocale,
  isUiLocalePreference,
  matchUiLocale,
  resolveUiLocale,
  uiLocales,
} from "./types";

const device = (languageTag: string, languageCode: string | null = languageTag.split("-")[0]) => ({
  languageCode,
  languageTag,
});

describe("UI locale detection", () => {
  it("matches the first shipped device language by its language subtag", () => {
    expect(matchUiLocale([device("de-AT")])).toBe("de");
    expect(matchUiLocale([device("sv-SE"), device("ja-JP")])).toBe("ja");
    expect(matchUiLocale([device("ur-PK")])).toBe("ur");
    expect(matchUiLocale([device("hi-IN")])).toBe("hi");
  });

  it("maps every Portuguese region to Brazilian Portuguese", () => {
    expect(matchUiLocale([device("pt-PT")])).toBe("pt-BR");
    expect(matchUiLocale([device("pt-BR")])).toBe("pt-BR");
  });

  it("falls back to English for unsupported or missing device languages", () => {
    expect(matchUiLocale([])).toBe("en");
    expect(matchUiLocale([device("ko-KR"), device("zh-Hans-CN")])).toBe("en");
    expect(matchUiLocale([device("ES-mx", null)])).toBe("es");
  });

  it("resolves the stored preference against the device", () => {
    expect(resolveUiLocale("system", [device("fr-CA")])).toBe("fr");
    expect(resolveUiLocale("tr", [device("fr-CA")])).toBe("tr");
  });

  it("flags only Arabic and Urdu as right-to-left", () => {
    expect(uiLocales.filter((locale) => directionForLocale(locale) === "rtl")).toEqual(["ar", "ur"]);
    expect(() => directionForLocale("he" as never)).toThrow("Unsupported UI locale");
  });

  it("validates exact locale and preference values", () => {
    expect(isUiLocale("pt-BR")).toBe(true);
    expect(isUiLocale("pt")).toBe(false);
    expect(isUiLocale("ar-SA")).toBe(false);
    expect(isUiLocalePreference("system")).toBe(true);
    expect(isUiLocalePreference("System")).toBe(false);
    expect(intlLocaleTag("ar")).toBe("ar-u-nu-arab");
    expect(intlLocaleTag("pt-BR")).toBe("pt-BR");
  });
});
