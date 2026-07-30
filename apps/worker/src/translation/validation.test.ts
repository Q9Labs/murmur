import { describe, expect, it } from "vitest";

import { parseLanguagePair } from "./validation";

describe("translation session validation", () => {
  it("accepts supported language pairs and automatic source detection", () => {
    expect(parseLanguagePair("en", "ar")).toEqual({
      sourceLanguage: "en",
      targetLanguage: "ar",
    });
    expect(parseLanguagePair("auto", "es")).toEqual({
      sourceLanguage: "auto",
      targetLanguage: "es",
    });
  });

  it("rejects unsupported and identical explicit languages", () => {
    expect(parseLanguagePair("xx", "ar")).toEqual({
      error: "unsupported_source_language",
    });
    expect(parseLanguagePair("en", "xx")).toEqual({
      error: "unsupported_target_language",
    });
    expect(parseLanguagePair("en", "en")).toEqual({
      error: "source_target_must_differ",
    });
  });
});
