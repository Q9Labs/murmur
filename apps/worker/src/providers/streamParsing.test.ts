import { describe, expect, it } from "vitest";

import {
  mergeProviderMetadata,
  parseOpenRouterChunk,
  parseProviderChunk,
} from "./streamParsing";

describe("provider stream parsing", () => {
  it("parses provider deltas and upstream metadata", () => {
    expect(
      parseOpenRouterChunk(
        JSON.stringify({
          choices: [{ delta: { content: "مرحبا" } }],
          id: "gen_123",
          model: "google/gemma-4-26b-a4b-it",
          provider: "Google AI Studio",
        }),
      ),
    ).toEqual({
      delta: "مرحبا",
      provider_metadata: {
        upstream_id: "gen_123",
        upstream_model: "google/gemma-4-26b-a4b-it",
        upstream_provider: "Google AI Studio",
      },
    });

    expect(parseProviderChunk(JSON.stringify({ choices: [{ delta: {} }] }), "groq")).toEqual({
      delta: null,
      provider_metadata: {
        upstream_id: undefined,
        upstream_model: undefined,
        upstream_provider: undefined,
      },
    });
  });

  it("throws provider-specific stream errors", () => {
    expect(() => {
      parseOpenRouterChunk(JSON.stringify({ error: { message: "provider failed" } }));
    }).toThrow("openrouter_stream_error");

    expect(() => {
      parseProviderChunk(JSON.stringify({ error: { message: "provider failed" } }), "groq");
    }).toThrow("groq_stream_error");
  });

  it("merges only present upstream metadata fields", () => {
    const target = {
      model: "route-model",
      provider: "openrouter",
      upstream_id: "old_id",
    } as const;
    const merged = { ...target };

    mergeProviderMetadata(merged, {
      upstream_model: "new_model",
      upstream_provider: "new_provider",
    });

    expect(merged).toEqual({
      model: "route-model",
      provider: "openrouter",
      upstream_id: "old_id",
      upstream_model: "new_model",
      upstream_provider: "new_provider",
    });
  });
});
