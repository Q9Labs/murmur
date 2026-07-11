import { describe, expect, it } from "vitest";

import {
  createUltravoxCall,
  mintProviderTokens,
  selectCartesiaVoiceId,
} from "./tokens";

describe("provider token helpers", () => {
  it("reports missing required provider configuration before minting", async () => {
    await expect(mintProviderTokens({}, 120)).resolves.toEqual({
      missing: ["DEEPGRAM_API_KEY", "OPENROUTER_API_KEY"],
      ok: false,
    });
  });

  it("selects language-specific Cartesia voices with a default fallback", () => {
    expect(
      selectCartesiaVoiceId(
        {
          CARTESIA_DEFAULT_VOICE_ID: "voice_default",
          CARTESIA_VOICE_ID_BY_LANGUAGE: JSON.stringify({
            ar: "voice_ar",
            zz: "ignored_unknown_language",
          }),
        },
        "ar",
      ),
    ).toBe("voice_ar");

    expect(
      selectCartesiaVoiceId(
        {
          CARTESIA_DEFAULT_VOICE_ID: "voice_default",
          CARTESIA_VOICE_ID_BY_LANGUAGE: "{bad json",
        },
        "nl",
      ),
    ).toBe("voice_default");
  });

  it("mints optional Cartesia speech tokens without Deepgram session tokens", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ token: "cartesia_token" });

    try {
      await expect(
        mintProviderTokens(
          {
            CARTESIA_API_KEY: "cartesia_key",
            DEEPGRAM_API_KEY: "deepgram_key",
            OPENROUTER_API_KEY: "openrouter_key",
          },
          120,
          { includeCartesia: true },
        ),
      ).resolves.toEqual({
        cartesiaAccessToken: "cartesia_token",
        deepgramToken: null,
        ok: true,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("requires an Ultravox API key before creating calls", async () => {
    await expect(
      createUltravoxCall({
        env: {},
        source_language: "en",
        target_language: "ar",
        vad_enabled: true,
      }),
    ).rejects.toThrow("missing_ultravox_api_key");
  });
});
