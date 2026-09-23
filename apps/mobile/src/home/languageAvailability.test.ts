import { describe, expect, it } from "vitest";

import { isLanguagePairEnabled, isLanguagePairReady, normalizeLanguagePair } from "./languageAvailability";

describe("language availability", () => {
  it("leaves the pair alone when every language is enabled", () => {
    expect(normalizeLanguagePair({ source: "en", target: "ar" }, null)).toEqual({ source: "en", target: "ar" });
    expect(isLanguagePairEnabled({ source: "en", target: "ar" }, null)).toBe(true);
  });

  it("moves a disabled target and source onto enabled languages", () => {
    expect(normalizeLanguagePair({ source: "en", target: "ar" }, ["en", "es"])).toEqual({ source: "en", target: "es" });
    expect(normalizeLanguagePair({ source: "ar", target: "en" }, ["en", "es"])).toEqual({ source: "es", target: "en" });
    expect(normalizeLanguagePair({ source: "ar", target: "fr" }, ["en", "es"])).toEqual({ source: "es", target: "en" });
  });

  it("switches to auto-detect when a single allowed language would be both sides", () => {
    expect(normalizeLanguagePair({ source: "en", target: "ar" }, ["en"])).toEqual({ source: "auto", target: "en" });
    expect(normalizeLanguagePair({ source: "ar", target: "en" }, ["en"])).toEqual({ source: "auto", target: "en" });
    expect(normalizeLanguagePair({ source: "auto", target: "ar" }, ["en"])).toEqual({ source: "auto", target: "en" });
    expect(isLanguagePairEnabled({ source: "auto", target: "en" }, ["en"])).toBe(true);
  });

  it("keeps Listen off until the server config has loaded or fallen back", () => {
    const pair = { source: "en", target: "ar" } as const;
    expect(isLanguagePairReady({ configLoaded: false, enabledLanguages: null, pair })).toBe(false);
    expect(isLanguagePairReady({ configLoaded: true, enabledLanguages: null, pair })).toBe(true);
    expect(isLanguagePairReady({ configLoaded: true, enabledLanguages: ["en"], pair })).toBe(false);
  });

  it("blocks a pair when nothing is enabled", () => {
    expect(normalizeLanguagePair({ source: "en", target: "ar" }, [])).toEqual({ source: "en", target: "ar" });
    expect(isLanguagePairEnabled({ source: "en", target: "ar" }, [])).toBe(false);
    expect(isLanguagePairEnabled({ source: "ar", target: "en" }, ["en"])).toBe(false);
  });
});
