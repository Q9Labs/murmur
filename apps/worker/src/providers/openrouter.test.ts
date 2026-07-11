import { describe, expect, it } from "vitest";

import type { TranslationRequest } from "@murmur/protocol/transport/types";
import {
  buildOpenRouterChatPayload,
  buildOpenRouterProviderPreferences,
} from "./openrouter";

function makeTranslationRequest(overrides: Partial<TranslationRequest> = {}): TranslationRequest {
  return {
    app_session_id: "session_1",
    connection_id: "connection_1",
    context_spans: [
      {
        source_caption: "Hello",
        span_id: "span_previous",
        translated_caption: "مرحبا",
      },
    ],
    event_seq: 1,
    revision: 1,
    session_epoch: 1,
    source_caption: "How are you?",
    source_language: "en",
    span_id: "span_current",
    target_language: "ar",
    translation_attempt: 1,
    ...overrides,
  };
}

describe("OpenRouter provider payloads", () => {
  it("builds provider preferences with privacy-first defaults and explicit overrides", () => {
    expect(buildOpenRouterProviderPreferences({})).toEqual({
      allow_fallbacks: false,
      data_collection: "deny",
      order: ["deepinfra/fp8"],
      require_parameters: true,
      sort: "latency",
    });

    expect(
      buildOpenRouterProviderPreferences({
        OPENROUTER_PROVIDER_ALLOW_FALLBACKS: "true",
        OPENROUTER_PROVIDER_DATA_COLLECTION: "allow",
        OPENROUTER_PROVIDER_IGNORE: "provider-a, provider-b",
        OPENROUTER_PROVIDER_ONLY: "deepinfra/fp8",
        OPENROUTER_PROVIDER_ORDER: "deepinfra/fp8,cerebras",
        OPENROUTER_PROVIDER_REQUIRE_PARAMETERS: "false",
        OPENROUTER_PROVIDER_SORT: "price",
        OPENROUTER_PROVIDER_ZDR: "true",
      }),
    ).toEqual({
      allow_fallbacks: true,
      data_collection: "allow",
      ignore: ["provider-a", "provider-b"],
      only: ["deepinfra/fp8"],
      order: ["deepinfra/fp8", "cerebras"],
      require_parameters: false,
      sort: "price",
      zdr: true,
    });
  });

  it("builds pinned provider preferences for explicit OpenRouter routes", () => {
    expect(buildOpenRouterProviderPreferences({}, "openrouter_gemma_deepinfra")).toEqual({
      allow_fallbacks: false,
      data_collection: "deny",
      only: ["deepinfra/fp8"],
      order: ["deepinfra/fp8"],
      require_parameters: true,
      sort: "latency",
    });
    expect(buildOpenRouterProviderPreferences({}, "openrouter_gpt_oss_120b_cerebras")).toEqual({
      allow_fallbacks: false,
      data_collection: "deny",
      only: ["cerebras"],
      order: ["cerebras"],
      require_parameters: true,
      sort: "latency",
    });
  });

  it("builds OpenRouter chat payloads without raw provider defaults", () => {
    const payload = buildOpenRouterChatPayload(makeTranslationRequest(), {
      OPENROUTER_MODEL: "google/gemma-4-26b-a4b-it",
      OPENROUTER_PROVIDER_ONLY: "deepinfra/fp8",
    });

    expect(payload).toMatchObject({
      max_tokens: 300,
      model: "google/gemma-4-26b-a4b-it",
      provider: {
        data_collection: "deny",
        only: ["deepinfra/fp8"],
        require_parameters: true,
        sort: "latency",
      },
      stream: true,
      temperature: 0.1,
    });
    expect(payload.messages[0]?.content).toContain("English to Arabic");
    expect(payload.messages[1]?.content).toContain("Previous stable spans");
    expect(payload.messages[1]?.content).toContain("How are you?");
  });

  it("builds auto-source and continuous target-action prompts", () => {
    const autoPayload = buildOpenRouterChatPayload(
      makeTranslationRequest({
        context_spans: [],
        source_caption: "Bonjour",
        source_language: "auto",
        target_language: "en",
      }),
      {},
    );

    expect(autoPayload.messages[0]?.content).toContain("detected source language to English");
    expect(autoPayload.messages[1]?.content).toContain("Bonjour");

    const continuousPayload = buildOpenRouterChatPayload(
      makeTranslationRequest({
        source_caption: "I need to book",
        source_status: "stable",
        translation_mode: "continuous",
      }),
      {},
    );

    expect(continuousPayload.temperature).toBe(0);
    expect(continuousPayload.messages[0]?.content).toContain("Return exactly one action");
    expect(continuousPayload.messages[0]?.content).toContain("WAIT");
    expect(continuousPayload.messages[0]?.content).toContain("COMMIT");
    expect(continuousPayload.messages[1]?.content).toContain("source_status: stable");
    expect(continuousPayload.messages[1]?.content).toContain("I need to book");
  });

  it("builds the Cerebras GPT-OSS OpenRouter payload", () => {
    expect(
      buildOpenRouterChatPayload(
        makeTranslationRequest({ translation_model_route: "openrouter_gpt_oss_120b_cerebras" }),
        {},
      ),
    ).toMatchObject({
      model: "openai/gpt-oss-120b",
      provider: {
        allow_fallbacks: false,
        only: ["cerebras"],
        order: ["cerebras"],
      },
    });
  });
});
