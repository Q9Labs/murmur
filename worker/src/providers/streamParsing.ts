import type { TranslationProviderMetadata } from "./types";

export function parseOpenRouterChunk(payload: string): {
  delta: string | null;
  provider_metadata: Partial<TranslationProviderMetadata>;
} {
  return parseProviderChunk(payload, "openrouter");
}

export function parseProviderChunk(payload: string, errorPrefix: "groq" | "openrouter"): {
  delta: string | null;
  provider_metadata: Partial<TranslationProviderMetadata>;
} {
  const parsed = JSON.parse(payload) as {
    choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
    error?: { message?: string };
    id?: string;
    model?: string;
    provider?: string;
  };
  if (parsed.error) {
    throw new Error(`${errorPrefix}_stream_error`);
  }
  return {
    delta: parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? null,
    provider_metadata: {
      upstream_id: parsed.id,
      upstream_model: parsed.model,
      upstream_provider: parsed.provider,
    },
  };
}

export function mergeProviderMetadata(
  target: Partial<TranslationProviderMetadata>,
  source: Partial<TranslationProviderMetadata>,
): void {
  if (typeof source.upstream_id === "string") {
    target.upstream_id = source.upstream_id;
  }
  if (typeof source.upstream_model === "string") {
    target.upstream_model = source.upstream_model;
  }
  if (typeof source.upstream_provider === "string") {
    target.upstream_provider = source.upstream_provider;
  }
}
