import { describe, expect, it } from "vitest";

import {
  autoSourceLanguageCode,
  getLanguage,
  isLanguageCode,
  isSourceLanguageCode,
  languageRegistry,
  type LanguageCode,
} from "./languages";

describe("language registry", () => {
  it("contains Arabic and marks it RTL", () => {
    expect(getLanguage("ar")).toMatchObject({
      app_code: "ar",
      rtl: true,
    });
  });

  it("contains the required launch languages", () => {
    const codes = new Set(languageRegistry.map((language) => language.app_code));
    const required: LanguageCode[] = [
      "ar",
      "de",
      "es",
      "fr",
      "hi",
      "it",
      "ja",
      "ko",
      "nl",
      "pt-BR",
      "ru",
      "zh-Hans",
    ];
    for (const code of required) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it("contains display metadata and smoke fixtures for every language", () => {
    for (const language of languageRegistry) {
      expect(language.script).toBeTruthy();
      expect(language.display_name).toBeTruthy();
      expect(language.native_name).toBeTruthy();
      expect(language.smoke_test_source_phrase).toBeTruthy();
      expect(language.expected_translation_notes).toBeTruthy();
      expect(language.dialect_or_variant_notes).toBeTruthy();
    }
  });

  it("validates language codes without throwing", () => {
    expect(isLanguageCode("ar")).toBe(true);
    expect(isLanguageCode("zz")).toBe(false);
  });

  it("rejects unsupported registry lookups", () => {
    expect(() => getLanguage("zz" as LanguageCode)).toThrow("Unsupported language: zz");
  });

  it("allows auto-detect only for source languages", () => {
    expect(autoSourceLanguageCode).toBe("auto");
    expect(isLanguageCode(autoSourceLanguageCode)).toBe(false);
    expect(isSourceLanguageCode(autoSourceLanguageCode)).toBe(true);
  });

  it("documents required Arabic and Dutch smoke fixtures", () => {
    expect(getLanguage("ar").script).toBe("Arab");
    expect(getLanguage("ar").smoke_test_source_phrase).toContain("؟");
    expect(getLanguage("nl")).toMatchObject({
      app_code: "nl",
      script: "Latn",
    });
  });
});
