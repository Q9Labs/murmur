import { describe, expect, it } from "vitest";

import {
  getDeepgramApiKey,
  getGroqApiKey,
  getMissingRequiredProviderKeys,
  getOpenRouterApiKey,
} from "./credentials";

describe("provider credentials", () => {
  it("reports missing required provider keys without exposing values", () => {
    expect(getMissingRequiredProviderKeys({})).toEqual([
      "DEEPGRAM_API_KEY",
      "OPENROUTER_API_KEY",
    ]);
    expect(
      getMissingRequiredProviderKeys({
        DEEPGRAM_API_KEY: "deepgram_key",
        OPENROUTER_API_KEY: "openrouter_key",
      }),
    ).toEqual([]);
  });

  it("centralizes raw provider key access", () => {
    const env = {
      DEEPGRAM_API_KEY: "deepgram_key",
      GROQ_API_KEY: "groq_key",
      OPENROUTER_API_KEY: "openrouter_key",
    };

    expect(getDeepgramApiKey(env)).toBe("deepgram_key");
    expect(getGroqApiKey(env)).toBe("groq_key");
    expect(getOpenRouterApiKey(env)).toBe("openrouter_key");
  });
});
