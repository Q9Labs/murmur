import { describe, expect, it } from "vitest";

import { defaultTargetLanguage } from "./defaultTargetLanguage";

const locale = (languageCode: string | null, languageTag = languageCode ?? "und") => ({
  languageCode,
  languageTag,
});

describe("first-run translation target", () => {
  it("defaults to the device language when Murmur translates into it", () => {
    expect(defaultTargetLanguage([locale("fr", "fr-FR")])).toBe("fr");
    expect(defaultTargetLanguage([locale("nl", "nl-NL")])).toBe("nl");
    expect(defaultTargetLanguage([locale("ar", "ar-SA")])).toBe("ar");
  });

  it("keeps the Arabic fallback for English devices so en→en never pairs", () => {
    expect(defaultTargetLanguage([locale("en", "en-US")])).toBe("ar");
    expect(defaultTargetLanguage([locale("en", "en-GB"), locale("fr", "fr-FR")])).toBe("fr");
  });

  it("maps any Portuguese device to the pt-BR target", () => {
    expect(defaultTargetLanguage([locale("pt", "pt-PT")])).toBe("pt-BR");
  });

  it("falls back when the device language is unsupported or unknown", () => {
    expect(defaultTargetLanguage([locale("ur", "ur-PK")])).toBe("ar");
    expect(defaultTargetLanguage([locale("tr", "tr-TR")])).toBe("ar");
    expect(defaultTargetLanguage([locale(null, "")])).toBe("ar");
    expect(defaultTargetLanguage([])).toBe("ar");
    expect(defaultTargetLanguage([locale("ur", "ur-PK"), locale("ko", "ko-KR")])).toBe("ko");
    expect(defaultTargetLanguage([locale("ur", "ur-PK")], "ja")).toBe("ja");
  });
});
