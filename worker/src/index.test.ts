import { describe, expect, it, vi } from "vitest";

const appAttestMocks = vi.hoisted(() => {
  class MockAttestationError extends Error {
    readonly name = "AttestationError";
    constructor(readonly code: string) {
      super(code);
    }
  }
  class MockAssertionError extends Error {
    readonly name = "AssertionError";
    constructor(readonly code: string) {
      super(code);
    }
  }
  return {
    AssertionError: MockAssertionError,
    AttestationError: MockAttestationError,
    verifyAssertion: vi.fn(),
    verifyAttestation: vi.fn(),
  };
});

vi.mock("@bradford-tech/supabase-integrity-attest", () => appAttestMocks);

import worker, {
  buildGroqChatPayload,
  buildOpenRouterChatPayload,
  buildOpenRouterProviderPreferences,
  getReadiness,
  getTranslationErrorCode,
  handleSocketMessage,
  parseOpenRouterChunk,
  validateTranslationRequest,
} from "./index";
import type { SummaryRequest, TranslationRequest } from "../../lib/transport/types";
import { defaultRateLimits } from "./limits";
import {
  beginSummaryDurable,
  beginTranslationDurable,
  closeSessionDurable,
  createSessionRecordDurable,
  endSummaryDurable,
  endTranslationDurable,
} from "./rateLimitDurableObject";

const WEBSOCKET_OPEN = 1;

vi.stubGlobal("WebSocket", { CONNECTING: 0, OPEN: WEBSOCKET_OPEN });

function makeSummaryRequestBody(appSessionId: string): SummaryRequest {
  const sourceCaption = "We are discussing Murmur release readiness.";
  return {
    app_session_id: appSessionId,
    input_memory_version: 4,
    previous_summary: {
      memory_version: 4,
      source_char_count_summarized: 0,
      text: "",
      updated_at_ms: 1,
      updated_through_span_id: null,
    },
    session_epoch: 1,
    source_language: "en",
    spans_to_summarize: [
      {
        committed_at_ms: 2,
        revision: 1,
        source_caption: sourceCaption,
        source_char_count: sourceCaption.length,
        span_id: "span_1",
        translated_caption: "target",
      },
    ],
    summary_job_id: "summary_job_123",
    target_language: "ar",
  };
}

describe("worker routes", () => {
  it("serves the marketing homepage at root", async () => {
    const response = await worker.fetch(new Request("https://worker.example/"), {
      MURMUR_ENV: "production",
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(body).toContain("Murmur");
    expect(body).toContain("translated captions appear in real time");
    expect(body).toContain("Accountless Live Speech Translation App");
    expect(body).toContain('rel="canonical" href="https://murmur.q9labs.ai/"');
    expect(body).toContain('href="/favicon.svg"');
    expect(body).toContain("application/ld+json");
    expect(body).toContain("Listen");
    expect(body).toContain('href="/privacy"');
    expect(body).toContain('href="/terms"');
    expect(body).toContain('href="/support"');
    expect(body).toContain("hero-section");
    expect(body).toContain("privacy-panel");
  });

  it("serves SEO discovery assets", async () => {
    const faviconResponse = await worker.fetch(new Request("https://worker.example/favicon.svg"), {
      MURMUR_ENV: "production",
    });
    const favicon = await faviconResponse.text();
    expect(faviconResponse.status).toBe(200);
    expect(faviconResponse.headers.get("Content-Type")).toContain("image/svg+xml");
    expect(favicon).toContain("<svg");
    expect(favicon).toContain("#FF6B4A");

    const robotsResponse = await worker.fetch(new Request("https://worker.example/robots.txt"), {
      MURMUR_ENV: "production",
    });
    const robots = await robotsResponse.text();
    expect(robotsResponse.status).toBe(200);
    expect(robotsResponse.headers.get("Content-Type")).toContain("text/plain");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("https://murmur.q9labs.ai/sitemap.xml");

    const sitemapResponse = await worker.fetch(new Request("https://worker.example/sitemap.xml"), {
      MURMUR_ENV: "production",
    });
    const sitemap = await sitemapResponse.text();
    expect(sitemapResponse.status).toBe(200);
    expect(sitemapResponse.headers.get("Content-Type")).toContain("application/xml");
    expect(sitemap).toContain("https://murmur.q9labs.ai/");
    expect(sitemap).toContain("https://murmur.q9labs.ai/privacy");
    expect(sitemap).toContain("https://murmur.q9labs.ai/terms");
    expect(sitemap).toContain("https://murmur.q9labs.ai/support");
  });

  it("serves public legal and support pages", async () => {
    for (const path of ["/privacy", "/terms", "/support"]) {
      const response = await worker.fetch(new Request(`https://worker.example${path}`), {
        MURMUR_ENV: "production",
      });
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(body).toContain("Murmur");
      expect(body).toContain("q9labs.ai@gmail.com");
      expect(body).toMatch(/\btap Listen\b/i);
      expect(body).not.toMatch(/\btap Start\b|\bStart a session\b|\bstart a live session\b/);
    }
  });

  it("reports non-secret Worker readiness for missing provider configuration", async () => {
    const payload = getReadiness({ MURMUR_ENV: "production" });

    expect(payload).toEqual({
      env: "production",
      missing: {
        optional: [
          "CARTESIA_API_KEY",
          "CARTESIA_DEFAULT_VOICE_ID_OR_CARTESIA_VOICE_ID_BY_LANGUAGE",
          "REPORT_WEBHOOK_URL_OR_REPORT_ADMIN_TOKEN",
        ],
        required: ["DEEPGRAM_API_KEY", "OPENROUTER_API_KEY", "SESSION_HASH_SALT"],
      },
      ok: false,
      providers: {
        cartesia_speech: "missing_optional",
        deepgram_stt: "missing_required",
        openrouter_translation: "missing_required",
        report_webhook: "missing_optional",
      },
    });

    const response = await worker.fetch(new Request("https://worker.example/ready"), {
      MURMUR_ENV: "production",
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("reports ready when required providers are configured", async () => {
    const payload = getReadiness({
      CARTESIA_API_KEY: "cartesia_key",
      CARTESIA_DEFAULT_VOICE_ID: "voice_id",
      DEEPGRAM_API_KEY: "deepgram_key",
      MURMUR_ENV: "production",
      OPENROUTER_API_KEY: "openrouter_key",
      REPORT_WEBHOOK_URL: "https://example.test/webhook",
      SESSION_HASH_SALT: "salt",
    });

    expect(payload).toEqual({
      env: "production",
      missing: {
        optional: [],
        required: [],
      },
      ok: true,
      providers: {
        cartesia_speech: "configured",
        deepgram_stt: "configured",
        openrouter_translation: "configured",
        report_webhook: "configured",
      },
    });

    const response = await worker.fetch(new Request("https://worker.example/ready"), {
      DEEPGRAM_API_KEY: "deepgram_key",
      MURMUR_ENV: "production",
      OPENROUTER_API_KEY: "openrouter_key",
      SESSION_HASH_SALT: "salt",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      missing: {
        required: [],
      },
      ok: true,
    });
  });

  it("disables Cartesia readiness requirements only when speech is explicitly disabled", () => {
    expect(getReadiness({
      DEEPGRAM_API_KEY: "deepgram_key",
      MURMUR_ENABLE_SPEECH: "false",
      MURMUR_ENV: "production",
      OPENROUTER_API_KEY: "openrouter_key",
      REPORT_ADMIN_TOKEN: "report_admin_token",
      SESSION_HASH_SALT: "salt",
    })).toMatchObject({
      missing: {
        optional: [],
        required: [],
      },
      ok: true,
      providers: {
        cartesia_speech: "disabled",
      },
    });
  });

  it("treats the report admin inbox token as report triage readiness", () => {
    expect(
      getReadiness({
        DEEPGRAM_API_KEY: "deepgram_key",
        MURMUR_ENV: "production",
        OPENROUTER_API_KEY: "openrouter_key",
        REPORT_ADMIN_TOKEN: "admin_token",
        SESSION_HASH_SALT: "salt",
      }),
    ).toMatchObject({
      missing: {
        required: [],
      },
      providers: {
        report_webhook: "configured",
      },
    });
  });

  it("sanitizes translation provider error codes", () => {
    expect(getTranslationErrorCode(new Error("openrouter_http_429"))).toBe("openrouter_http_429");
    expect(getTranslationErrorCode(new Error("openrouter_timeout"))).toBe("openrouter_timeout");
    expect(getTranslationErrorCode(new Error("openrouter_stream_incomplete"))).toBe("openrouter_stream_incomplete");
    expect(getTranslationErrorCode(new Error("openrouter_empty_translation"))).toBe("openrouter_empty_translation");
    expect(getTranslationErrorCode(new Error("groq_http_429"))).toBe("groq_http_429");
    expect(getTranslationErrorCode(new Error("groq_timeout"))).toBe("groq_timeout");
    expect(getTranslationErrorCode(new Error("missing_groq_api_key"))).toBe("missing_groq_api_key");
    expect(getTranslationErrorCode(new Error("provider leaked prompt text"))).toBe("translation_failed");
  });

  it("parses OpenRouter stream chunks and captures upstream metadata", () => {
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

    expect(parseOpenRouterChunk(JSON.stringify({ choices: [{ delta: {} }] }))).toEqual({
      delta: null,
      provider_metadata: {
        upstream_id: undefined,
        upstream_model: undefined,
        upstream_provider: undefined,
      },
    });

    expect(() => {
      parseOpenRouterChunk(JSON.stringify({ error: { message: "provider failed" } }));
    }).toThrow("openrouter_stream_error");
  });

  it("pins OpenRouter provider routing and privacy preferences", () => {
    expect(buildOpenRouterProviderPreferences({})).toEqual({
      allow_fallbacks: true,
      data_collection: "deny",
      order: ["deepinfra/fp8", "cloudflare", "google-vertex/global"],
      require_parameters: true,
      sort: "latency",
    });

    expect(
      buildOpenRouterProviderPreferences({
        OPENROUTER_PROVIDER_ALLOW_FALLBACKS: "false",
        OPENROUTER_PROVIDER_DATA_COLLECTION: "allow",
        OPENROUTER_PROVIDER_IGNORE: "venice",
        OPENROUTER_PROVIDER_ONLY: "deepinfra/fp8,cloudflare",
        OPENROUTER_PROVIDER_ORDER: "cloudflare,deepinfra/fp8",
        OPENROUTER_PROVIDER_REQUIRE_PARAMETERS: "false",
        OPENROUTER_PROVIDER_SORT: "throughput",
        OPENROUTER_PROVIDER_ZDR: "true",
      }),
    ).toEqual({
      allow_fallbacks: false,
      data_collection: "allow",
      ignore: ["venice"],
      only: ["deepinfra/fp8", "cloudflare"],
      order: ["cloudflare", "deepinfra/fp8"],
      require_parameters: false,
      sort: "throughput",
      zdr: true,
    });

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
    const payload = buildOpenRouterChatPayload(
      {
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
      },
      {
        OPENROUTER_MODEL: "google/gemma-4-26b-a4b-it",
        OPENROUTER_PROVIDER_ONLY: "deepinfra/fp8",
      },
    );

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

  it("builds dev GPT-OSS payloads for Groq and OpenRouter Cerebras", () => {
    const baseRequest: TranslationRequest = {
      app_session_id: "session_1",
      connection_id: "connection_1",
      context_spans: [],
      event_seq: 1,
      revision: 1,
      session_epoch: 1,
      source_caption: "Hello",
      source_language: "en",
      span_id: "span_current",
      target_language: "ar",
      translation_attempt: 1,
    };

    expect(buildGroqChatPayload(baseRequest)).toMatchObject({
      include_reasoning: false,
      max_tokens: 300,
      model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
      stream: true,
      temperature: 0.1,
    });

    expect(
      buildOpenRouterChatPayload(
        { ...baseRequest, translation_model_route: "openrouter_gpt_oss_120b_cerebras" },
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

  it("builds translation prompts for auto-detected source language", () => {
    const payload = buildOpenRouterChatPayload(
      {
        app_session_id: "session_1",
        connection_id: "connection_1",
        context_spans: [],
        event_seq: 1,
        revision: 1,
        session_epoch: 1,
        source_caption: "Bonjour",
        source_language: "auto",
        span_id: "span_current",
        target_language: "en",
        translation_attempt: 1,
      },
      {},
    );

    expect(payload.messages[0]?.content).toContain("detected source language to English");
    expect(payload.messages[1]?.content).toContain("Bonjour");
  });

  it("generates compact summaries for live sessions", async () => {
    const appSessionId = `session_summary_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: `install_summary_${Date.now()}`,
      now_ms: Date.now(),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        messages?: Array<{ content: string; role: string }>;
        stream?: boolean;
      };
      expect(body.stream).toBe(false);
      expect(body.messages?.[1]?.content).toContain("Previous compact summary");
      expect(body.messages?.[1]?.content).toContain("Murmur release");
      return Response.json({
        choices: [
          {
            message: {
              content: "Talk about Murmur release readiness. Preserve Phrase Mode and Continuous Mode terms.",
            },
          },
        ],
      });
    };

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makeSummaryRequestBody(appSessionId)),
        }),
        {
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        summary?: { text?: string; updated_through_span_id?: string };
      };

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.summary?.updated_through_span_id).toBe("span_1");
      expect(body.summary?.text).toContain("Continuous Mode");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects summary generation for unknown sessions before OpenRouter", async () => {
    let upstreamCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      upstreamCalled = true;
      return Response.json({ choices: [{ message: { content: "should not run" } }] });
    };

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            makeSummaryRequestBody(`session_unknown_summary_${Date.now()}`),
          ),
        }),
        {
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "session_closed",
        retryable: false,
      });
      expect(upstreamCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects summary generation for closed sessions before OpenRouter", async () => {
    const appSessionId = `session_closed_summary_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: `install_closed_summary_${Date.now()}`,
      now_ms: Date.now(),
    });
    await closeSessionDurable({
      app_session_id: appSessionId,
      now_ms: Date.now(),
    });
    let upstreamCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      upstreamCalled = true;
      return Response.json({ choices: [{ message: { content: "should not run" } }] });
    };

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makeSummaryRequestBody(appSessionId)),
        }),
        {
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "session_closed",
        retryable: false,
      });
      expect(upstreamCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not consume summary quota when OpenRouter is unconfigured", async () => {
    const appSessionId = `session_summary_unconfigured_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: `install_summary_unconfigured_${Date.now()}`,
      now_ms: Date.now(),
    });

    for (let index = 0; index < defaultRateLimits.summariesPerMinute + 1; index += 1) {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makeSummaryRequestBody(appSessionId)),
        }),
        {},
      );

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "missing_openrouter_api_key",
        retryable: true,
      });
    }

    let upstreamCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      upstreamCalled = true;
      return Response.json({ choices: [{ message: { content: "quota still available" } }] });
    };

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makeSummaryRequestBody(appSessionId)),
        }),
        {
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );

      expect(response.status).toBe(200);
      expect(upstreamCalled).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects mismatched summary source character counts before OpenRouter", async () => {
    let upstreamCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      upstreamCalled = true;
      return Response.json({ choices: [{ message: { content: "should not run" } }] });
    };

    const body = makeSummaryRequestBody(`session_summary_bad_chars_${Date.now()}`);
    body.spans_to_summarize[0] = {
      ...body.spans_to_summarize[0],
      source_char_count: body.spans_to_summarize[0].source_char_count - 1,
    };

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        {
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "invalid_summary_spans",
        retryable: false,
      });
      expect(upstreamCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects oversized summary inputs before OpenRouter", async () => {
    let upstreamCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      upstreamCalled = true;
      return Response.json({ choices: [{ message: { content: "should not run" } }] });
    };

    const longCaption = "x".repeat(5001);
    const body = makeSummaryRequestBody(`session_summary_oversized_${Date.now()}`);
    body.spans_to_summarize = [
      {
        ...body.spans_to_summarize[0],
        source_caption: longCaption,
        source_char_count: longCaption.length,
      },
    ];

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        {
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "summary_spans_too_large",
        retryable: false,
      });
      expect(upstreamCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rate limits summary generation before OpenRouter", async () => {
    const appSessionId = `session_limited_summary_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: `install_limited_summary_${Date.now()}`,
      now_ms: Date.now(),
    });
    for (let index = 0; index < defaultRateLimits.summariesPerMinute; index += 1) {
      await expect(
        beginSummaryDurable({
          app_session_id: appSessionId,
          now_ms: Date.now(),
        }),
      ).resolves.toEqual({ ok: true });
      await endSummaryDurable({
        app_session_id: appSessionId,
      });
    }

    let upstreamCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      upstreamCalled = true;
      return Response.json({ choices: [{ message: { content: "should not run" } }] });
    };

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makeSummaryRequestBody(appSessionId)),
        }),
        {
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );

      expect(response.status).toBe(429);
      await expect(response.json()).resolves.toEqual({
        error: "summaries_per_minute_limit",
        retryable: true,
      });
      expect(upstreamCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps summary work out of live translation concurrency", async () => {
    const appSessionId = `session_summary_separate_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: `install_summary_separate_${Date.now()}`,
      now_ms: Date.now(),
    });

    await expect(
      beginSummaryDurable({
        app_session_id: appSessionId,
        now_ms: Date.now(),
      }),
    ).resolves.toEqual({ ok: true });

    for (let index = 0; index < defaultRateLimits.concurrentTranslationsPerSession; index += 1) {
      await expect(
        beginTranslationDurable({
          app_session_id: appSessionId,
          now_ms: Date.now(),
          source_caption: `foreground caption ${index}`,
        }),
      ).resolves.toEqual({ ok: true });
    }

    await expect(
      beginTranslationDurable({
        app_session_id: appSessionId,
        now_ms: Date.now(),
        source_caption: "one more foreground caption",
      }),
    ).resolves.toEqual({ ok: false, code: "concurrent_translation_limit" });

    await endSummaryDurable({ app_session_id: appSessionId });
    for (let index = 0; index < defaultRateLimits.concurrentTranslationsPerSession; index += 1) {
      await endTranslationDurable({ app_session_id: appSessionId });
    }
  });

  it("validates translation WebSocket requests before provider work", () => {
    const request: TranslationRequest = {
      app_session_id: "session_valid_123",
      connection_id: "connection_valid_123",
      context_spans: [],
      event_seq: 1,
      revision: 1,
      session_epoch: 1,
      source_caption: "Hello",
      source_language: "en",
      span_id: "span_valid",
      target_language: "ar",
      translation_attempt: 1,
    };

    expect(validateTranslationRequest(request)).toBeNull();
    expect(validateTranslationRequest({ ...request, source_language: "auto" })).toBeNull();
    expect(
      validateTranslationRequest({ ...request, source_language: "zz" } as unknown as TranslationRequest),
    ).toBe("invalid_source_language");
    expect(validateTranslationRequest({ ...request, target_language: "en" })).toBe(
      "same_language_pair",
    );
    expect(validateTranslationRequest({ ...request, source_caption: " " })).toBe(
      "empty_source_caption",
    );
    expect(
      validateTranslationRequest({
        ...request,
        translation_model_route: "not_a_route",
      } as unknown as TranslationRequest),
    ).toBe("invalid_translation_model_route");
    expect(
      validateTranslationRequest({
        ...request,
        context_spans: Array.from({ length: 11 }, (_, index) => ({
          source_caption: `source ${index}`,
          span_id: `span_${index}`,
          translated_caption: `target ${index}`,
        })),
      }),
    ).toBe("invalid_context_spans");
  });

  it("streams OpenRouter translation deltas and done events for a valid message", async () => {
    const originalFetch = globalThis.fetch;
    const appSessionId = `session_translate_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: `install_translate_${Date.now()}`,
      now_ms: Date.now(),
    });
    const encoder = new TextEncoder();
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      const body = JSON.parse(String(init?.body)) as { provider?: { data_collection?: string } };
      expect(body.provider?.data_collection).toBe("deny");
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                [
                  'data: {"id":"gen_1","model":"google/gemma-4-26b-a4b-it","provider":"DeepInfra","choices":[{"delta":{"content":"مرحبا"}}]}',
                  "",
                  'data: {"choices":[{"delta":{"content":"!"}}]}',
                  "",
                  "data: [DONE]",
                  "",
                ].join("\n"),
              ),
            );
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    };

    try {
      const sent: unknown[] = [];
      const socket = {
        close: vi.fn(),
        readyState: WEBSOCKET_OPEN,
        send: (payload: string) => sent.push(JSON.parse(payload)),
      } as unknown as Parameters<typeof handleSocketMessage>[1];
      await handleSocketMessage(
        JSON.stringify({
          app_session_id: appSessionId,
          connection_id: "connection_translate",
          context_spans: [],
          event_seq: 1,
          kind: "translate",
          revision: 1,
          session_epoch: 1,
          source_caption: "Hello",
          source_language: "en",
          span_id: "span_translate",
          target_language: "ar",
          translation_attempt: 1,
        }),
        socket,
        {
          OPENROUTER_API_KEY: "openrouter_key",
          OPENROUTER_MODEL: "google/gemma-4-26b-a4b-it",
        },
        new Map(),
      );

      expect(sent).toHaveLength(3);
      expect(sent[0]).toMatchObject({
        delta: "مرحبا",
        kind: "translation_delta",
        span_id: "span_translate",
      });
      expect(sent[1]).toMatchObject({
        delta: "!",
        kind: "translation_delta",
        span_id: "span_translate",
      });
      expect(sent[2]).toMatchObject({
        kind: "translation_done",
        provider_metadata: {
          upstream_id: "gen_1",
          upstream_model: "google/gemma-4-26b-a4b-it",
          upstream_provider: "DeepInfra",
        },
        translated_caption: "مرحبا!",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects dev translation model routes on production translation sockets", async () => {
    const sent: unknown[] = [];
    const socket = {
      close: vi.fn(),
      readyState: WEBSOCKET_OPEN,
      send: (payload: string) => sent.push(JSON.parse(payload)),
    } as unknown as Parameters<typeof handleSocketMessage>[1];

    await handleSocketMessage(
      JSON.stringify({
        app_session_id: "session_translate_model_route",
        connection_id: "connection_translate_model_route",
        context_spans: [],
        event_seq: 1,
        kind: "translate",
        revision: 1,
        session_epoch: 1,
        source_caption: "Hello",
        source_language: "en",
        span_id: "span_translate_model_route",
        target_language: "ar",
        translation_attempt: 1,
        translation_model_route: "groq_gpt_oss_120b_low",
      }),
      socket,
      {
        MURMUR_ENV: "production",
      },
      new Map(),
    );

    expect(sent).toEqual([
      expect.objectContaining({
        error_code: "dev_translation_model_route_unavailable",
        kind: "translation_error",
        retryable: false,
      }),
    ]);
  });

  it("streams Groq GPT-OSS low reasoning translations for dev routes", async () => {
    const originalFetch = globalThis.fetch;
    const appSessionId = `session_groq_translate_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: `install_groq_translate_${Date.now()}`,
      now_ms: Date.now(),
    });
    const encoder = new TextEncoder();
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
      const body = JSON.parse(String(init?.body)) as {
        include_reasoning?: boolean;
        model?: string;
        reasoning_effort?: string;
      };
      expect(body.model).toBe("openai/gpt-oss-120b");
      expect(body.reasoning_effort).toBe("low");
      expect(body.include_reasoning).toBe(false);
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                [
                  'data: {"id":"groq_1","model":"openai/gpt-oss-120b","choices":[{"delta":{"content":"مرحبا"}}]}',
                  "",
                  "data: [DONE]",
                  "",
                ].join("\n"),
              ),
            );
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    };

    try {
      const sent: unknown[] = [];
      const socket = {
        close: vi.fn(),
        readyState: WEBSOCKET_OPEN,
        send: (payload: string) => sent.push(JSON.parse(payload)),
      } as unknown as Parameters<typeof handleSocketMessage>[1];
      await handleSocketMessage(
        JSON.stringify({
          app_session_id: appSessionId,
          connection_id: "connection_groq_translate",
          context_spans: [],
          event_seq: 1,
          kind: "translate",
          revision: 1,
          session_epoch: 1,
          source_caption: "Hello",
          source_language: "en",
          span_id: "span_groq_translate",
          target_language: "ar",
          translation_attempt: 1,
          translation_model_route: "groq_gpt_oss_120b_low",
        }),
        socket,
        {
          GROQ_API_KEY: "groq_key",
          MURMUR_ENV: "development",
        },
        new Map(),
      );

      expect(sent).toHaveLength(2);
      expect(sent[0]).toMatchObject({
        delta: "مرحبا",
        kind: "translation_delta",
      });
      expect(sent[1]).toMatchObject({
        kind: "translation_done",
        provider_metadata: {
          model: "openai/gpt-oss-120b",
          provider: "groq",
          reasoning_effort: "low",
          route_id: "groq_gpt_oss_120b_low",
          upstream_id: "groq_1",
          upstream_model: "openai/gpt-oss-120b",
        },
        translated_caption: "مرحبا",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects OpenRouter streams that end before DONE", async () => {
    const originalFetch = globalThis.fetch;
    const appSessionId = `session_incomplete_stream_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: `install_incomplete_stream_${Date.now()}`,
      now_ms: Date.now(),
    });
    const encoder = new TextEncoder();
    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),
            );
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );

    try {
      const sent: unknown[] = [];
      const socket = {
        close: vi.fn(),
        readyState: WEBSOCKET_OPEN,
        send: (payload: string) => sent.push(JSON.parse(payload)),
      } as unknown as Parameters<typeof handleSocketMessage>[1];
      await handleSocketMessage(
        JSON.stringify({
          app_session_id: appSessionId,
          connection_id: "connection_translate",
          context_spans: [],
          event_seq: 1,
          kind: "translate",
          revision: 1,
          session_epoch: 1,
          source_caption: "Hello",
          source_language: "en",
          span_id: "span_incomplete_stream",
          target_language: "ar",
          translation_attempt: 1,
        }),
        socket,
        {
          OPENROUTER_API_KEY: "openrouter_key",
        },
        new Map(),
      );

      expect(sent).toHaveLength(2);
      expect(sent[0]).toMatchObject({
        delta: "partial",
        kind: "translation_delta",
      });
      expect(sent[1]).toMatchObject({
        error_code: "openrouter_stream_incomplete",
        kind: "translation_error",
        retryable: true,
      });
      expect(sent).not.toContainEqual(expect.objectContaining({ kind: "translation_done" }));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects empty OpenRouter translations at DONE", async () => {
    const originalFetch = globalThis.fetch;
    const appSessionId = `session_empty_stream_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: `install_empty_stream_${Date.now()}`,
      now_ms: Date.now(),
    });
    const encoder = new TextEncoder();
    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );

    try {
      const sent: unknown[] = [];
      const socket = {
        close: vi.fn(),
        readyState: WEBSOCKET_OPEN,
        send: (payload: string) => sent.push(JSON.parse(payload)),
      } as unknown as Parameters<typeof handleSocketMessage>[1];
      await handleSocketMessage(
        JSON.stringify({
          app_session_id: appSessionId,
          connection_id: "connection_translate",
          context_spans: [],
          event_seq: 1,
          kind: "translate",
          revision: 1,
          session_epoch: 1,
          source_caption: "Hello",
          source_language: "en",
          span_id: "span_empty_stream",
          target_language: "ar",
          translation_attempt: 1,
        }),
        socket,
        {
          OPENROUTER_API_KEY: "openrouter_key",
        },
        new Map(),
      );

      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({
        error_code: "openrouter_empty_translation",
        kind: "translation_error",
        retryable: true,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("requires POST for session stop", async () => {
    const getResponse = await worker.fetch(
      new Request("https://murmur.test/v1/session/session_123/stop", { method: "GET" }),
      {},
    );
    expect(getResponse.status).toBe(404);

    const postResponse = await worker.fetch(
      new Request("https://murmur.test/v1/session/session_123/stop", { method: "POST" }),
      {},
    );
    expect(postResponse.status).toBe(200);
    await expect(postResponse.json()).resolves.toEqual({ ok: true });
  });

  it("returns clean validation errors for invalid session languages", async () => {
    const invalidSourceResponse = await worker.fetch(
      new Request("https://murmur.test/v1/session", {
        body: JSON.stringify({
          app_install_id: "install_language_test",
          source_language: "zz",
          target_language: "ar",
        }),
        method: "POST",
      }),
      {},
    );
    expect(invalidSourceResponse.status).toBe(400);
    await expect(invalidSourceResponse.json()).resolves.toEqual({
      error: "invalid_source_language",
    });

    const samePairResponse = await worker.fetch(
      new Request("https://murmur.test/v1/session", {
        body: JSON.stringify({
          app_install_id: "install_language_test",
          source_language: "en",
          target_language: "en",
        }),
        method: "POST",
      }),
      {},
    );
    expect(samePairResponse.status).toBe(400);
    await expect(samePairResponse.json()).resolves.toEqual({
      error: "same_language_pair",
    });
  });

  it("rejects dev translation model routes in production sessions", async () => {
    const response = await worker.fetch(
      new Request("https://murmur.test/v1/session", {
        body: JSON.stringify({
          app_install_id: "install_model_route_test",
          source_language: "en",
          target_language: "ar",
          translation_model_route: "groq_gpt_oss_120b_low",
        }),
        method: "POST",
      }),
      { MURMUR_ENV: "production" },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "dev_translation_model_route_unavailable",
    });
  });

  it("can require device integrity before minting provider tokens", async () => {
    const response = await worker.fetch(
      new Request("https://murmur.test/v1/session", {
        body: JSON.stringify({
          app_install_id: "install_test_123",
          device_integrity: {
            available: false,
            platform: "android",
            provider: "play_integrity",
            reason: "play_services_unavailable",
          },
          source_language: "en",
          target_language: "ar",
        }),
        method: "POST",
      }),
      { MURMUR_REQUIRE_DEVICE_INTEGRITY: "true" },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "device_integrity_required" });
  });

  it("does not mint provider tokens when required integrity verification is unconfigured", async () => {
    const response = await worker.fetch(
      new Request("https://murmur.test/v1/session", {
        body: JSON.stringify({
          app_install_id: "install_integrity_unconfigured",
          device_integrity: {
            available: true,
            nonce: "nonce_integrity_unconfigured",
            platform: "android",
            provider: "play_integrity",
            token: "integrity_token_long_enough_for_worker_contract",
          },
          source_language: "en",
          target_language: "ar",
        }),
        method: "POST",
      }),
      { MURMUR_REQUIRE_DEVICE_INTEGRITY: "true" },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "device_integrity_verifier_unconfigured",
    });
  });

  it("verifies Play Integrity before returning a session when enforcement is enabled", async () => {
    const originalFetch = globalThis.fetch;
    const nonce = "nonce_integrity_verified";
    globalThis.fetch = async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("playintegrity.googleapis.com")) {
        return Response.json({
          tokenPayloadExternal: {
            appIntegrity: {
              appRecognitionVerdict: "PLAY_RECOGNIZED",
              packageName: "com.q9labsai.murmur",
            },
            deviceIntegrity: {
              deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"],
            },
            requestDetails: {
              nonce,
              requestPackageName: "com.q9labsai.murmur",
            },
          },
        });
      }
      if (url.includes("deepgram.com")) {
        return Response.json({ access_token: "deepgram_token" });
      }
      if (url.includes("cartesia.ai")) {
        return Response.json({ token: "cartesia_token" });
      }
      return Response.json({});
    };

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/session", {
          body: JSON.stringify({
            app_install_id: `install_integrity_${Date.now()}`,
            device_integrity: {
              available: true,
              nonce,
              platform: "android",
              provider: "play_integrity",
              token: "integrity_token_long_enough_for_worker_contract",
            },
            source_language: "en",
            target_language: "ar",
          }),
          method: "POST",
        }),
        {
          CARTESIA_API_KEY: "cartesia_key",
          DEEPGRAM_API_KEY: "deepgram_key",
          GOOGLE_PLAY_INTEGRITY_ACCESS_TOKEN: "google_access_token",
          GOOGLE_PLAY_PACKAGE_NAME: "com.q9labsai.murmur",
          MURMUR_REQUIRE_DEVICE_INTEGRITY: "true",
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { app_session_id?: string };
      expect(body.app_session_id).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects stale Play Integrity tokens when Google returns a signed timestamp", async () => {
    const originalFetch = globalThis.fetch;
    const nonce = "nonce_integrity_stale";
    globalThis.fetch = async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("playintegrity.googleapis.com")) {
        return Response.json({
          tokenPayloadExternal: {
            appIntegrity: {
              appRecognitionVerdict: "PLAY_RECOGNIZED",
              packageName: "com.q9labsai.murmur",
            },
            deviceIntegrity: {
              deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"],
            },
            requestDetails: {
              nonce,
              requestPackageName: "com.q9labsai.murmur",
              timestampMillis: "1",
            },
          },
        });
      }
      return Response.json({});
    };

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/session", {
          body: JSON.stringify({
            app_install_id: `install_integrity_stale_${Date.now()}`,
            device_integrity: {
              available: true,
              nonce,
              platform: "android",
              provider: "play_integrity",
              token: "integrity_token_long_enough_for_worker_contract",
            },
            source_language: "en",
            target_language: "ar",
          }),
          method: "POST",
        }),
        {
          GOOGLE_PLAY_INTEGRITY_ACCESS_TOKEN: "google_access_token",
          GOOGLE_PLAY_PACKAGE_NAME: "com.q9labsai.murmur",
          MURMUR_REQUIRE_DEVICE_INTEGRITY: "true",
        },
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: "play_integrity_token_expired",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not mint provider tokens for iOS App Attest when server verification is unconfigured", async () => {
    const response = await worker.fetch(
      new Request("https://murmur.test/v1/session", {
        body: JSON.stringify({
          app_install_id: "install_app_attest_unconfigured",
          device_integrity: {
            available: true,
            key_id: "app_attest_key",
            kind: "attestation",
            nonce: "nonce_app_attest_unconfigured",
            platform: "ios",
            provider: "app_attest",
            token: "app_attest_payload_long_enough_for_worker_contract",
          },
          source_language: "en",
          target_language: "ar",
        }),
        method: "POST",
      }),
      {
        MURMUR_REQUIRE_DEVICE_INTEGRITY: "true",
      },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "app_attest_verifier_unconfigured",
    });
  });

  it("verifies iOS App Attest attestation and assertion when enforcement is enabled", async () => {
    const originalFetch = globalThis.fetch;
    const installId = `install_app_attest_${Date.now()}`;
    appAttestMocks.verifyAttestation.mockResolvedValueOnce({
      publicKeyPem: "-----BEGIN PUBLIC KEY-----\nmock\n-----END PUBLIC KEY-----",
      receipt: new Uint8Array([1, 2, 3]),
      signCount: 0,
    });
    appAttestMocks.verifyAssertion.mockResolvedValueOnce({ signCount: 1 });
    globalThis.fetch = async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("deepgram.com")) {
        return Response.json({ access_token: "deepgram_token" });
      }
      if (url.includes("cartesia.ai")) {
        return Response.json({ token: "cartesia_token" });
      }
      return Response.json({});
    };

    try {
      const createResponse = await worker.fetch(
        new Request("https://murmur.test/v1/session", {
          body: JSON.stringify({
            app_install_id: installId,
            device_integrity: {
              available: true,
              key_id: "app_attest_key_verified",
              kind: "attestation",
              nonce: "nonce_app_attest_verified",
              platform: "ios",
              provider: "app_attest",
              token: "app_attest_payload_long_enough_for_worker_contract",
            },
            source_language: "en",
            target_language: "ar",
          }),
          method: "POST",
        }),
        {
          APPLE_APP_ATTEST_APP_ID: "TEAMID.com.q9labsai.murmur",
          APPLE_APP_ATTEST_ENVIRONMENT: "production",
          CARTESIA_API_KEY: "cartesia_key",
          DEEPGRAM_API_KEY: "deepgram_key",
          MURMUR_REQUIRE_DEVICE_INTEGRITY: "true",
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );
      expect(createResponse.status).toBe(200);
      const createBody = (await createResponse.json()) as { app_session_id: string };

      const refreshResponse = await worker.fetch(
        new Request(`https://murmur.test/v1/session/${createBody.app_session_id}/tokens`, {
          body: JSON.stringify({
            app_install_id: installId,
            app_session_id: createBody.app_session_id,
            device_integrity: {
              available: true,
              key_id: "app_attest_key_verified",
              kind: "assertion",
              nonce: "nonce_app_attest_asserted",
              platform: "ios",
              provider: "app_attest",
              token: "app_attest_assertion_payload_long_enough_for_worker_contract",
            },
            session_epoch: 1,
            source_language: "en",
            target_language: "ar",
          }),
          method: "POST",
        }),
        {
          APPLE_APP_ATTEST_APP_ID: "TEAMID.com.q9labsai.murmur",
          APPLE_APP_ATTEST_ENVIRONMENT: "production",
          CARTESIA_API_KEY: "cartesia_key",
          DEEPGRAM_API_KEY: "deepgram_key",
          MURMUR_REQUIRE_DEVICE_INTEGRITY: "true",
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );

      expect(refreshResponse.status).toBe(200);
      await expect(refreshResponse.json()).resolves.toMatchObject({
        app_session_id: createBody.app_session_id,
        session_epoch: 2,
      });
      expect(appAttestMocks.verifyAttestation).toHaveBeenCalledWith(
        { appId: "TEAMID.com.q9labsai.murmur", developmentEnv: false },
        "app_attest_key_verified",
        expect.any(Uint8Array),
        "app_attest_payload_long_enough_for_worker_contract",
      );
      expect(appAttestMocks.verifyAssertion).toHaveBeenCalledWith(
        { appId: "TEAMID.com.q9labsai.murmur" },
        "app_attest_assertion_payload_long_enough_for_worker_contract",
        "nonce_app_attest_asserted",
        "-----BEGIN PUBLIC KEY-----\nmock\n-----END PUBLIC KEY-----",
        0,
      );
    } finally {
      globalThis.fetch = originalFetch;
      appAttestMocks.verifyAttestation.mockReset();
      appAttestMocks.verifyAssertion.mockReset();
    }
  });

  it("selects a Cartesia voice by target language when configured", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("deepgram.com")) {
        return Response.json({ access_token: "deepgram_token" });
      }
      if (url.includes("cartesia.ai")) {
        return Response.json({ token: "cartesia_token" });
      }
      return Response.json({});
    };

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/session", {
          body: JSON.stringify({
            app_install_id: `install_voice_${Date.now()}`,
            device_integrity: {
              available: true,
              platform: "android",
              provider: "play_integrity",
              token: "integrity_token_long_enough_for_worker_contract",
            },
            source_language: "en",
            target_language: "ar",
          }),
          method: "POST",
        }),
        {
          CARTESIA_API_KEY: "cartesia_key",
          CARTESIA_DEFAULT_VOICE_ID: "voice_default",
          CARTESIA_VOICE_ID_BY_LANGUAGE: JSON.stringify({ ar: "voice_ar", nl: "voice_nl" }),
          DEEPGRAM_API_KEY: "deepgram_key",
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { speech?: { default_voice_id?: string } };
      expect(body.speech?.default_voice_id).toBe("voice_ar");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refreshes provider tokens for an existing session without creating a new session", async () => {
    const originalFetch = globalThis.fetch;
    let cartesiaTokensMinted = 0;
    globalThis.fetch = async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("cartesia.ai")) {
        cartesiaTokensMinted += 1;
        return Response.json({ token: `cartesia_token_${cartesiaTokensMinted}` });
      }
      return Response.json({});
    };

    try {
      const env = {
        CARTESIA_API_KEY: "cartesia_key",
        CARTESIA_DEFAULT_VOICE_ID: "voice_default",
        DEEPGRAM_API_KEY: "deepgram_key",
        OPENROUTER_API_KEY: "openrouter_key",
      };
      const appInstallId = `install_refresh_${Date.now()}`;
      const createResponse = await worker.fetch(
        new Request("https://murmur.test/v1/session", {
          body: JSON.stringify({
            app_install_id: appInstallId,
            source_language: "en",
            target_language: "ar",
          }),
          method: "POST",
        }),
        env,
      );
      expect(createResponse.status).toBe(200);
      const created = (await createResponse.json()) as {
        app_session_id: string;
        deepgram_ws_url: string;
        session_epoch: number;
        tokens: { deepgram_token: string | null; token_bundle_id: string };
      };
      expect(created.deepgram_ws_url).toContain("/v1/deepgram");
      expect(created.tokens.deepgram_token).toBeNull();

      const refreshResponse = await worker.fetch(
        new Request(`https://murmur.test/v1/session/${created.app_session_id}/tokens`, {
          body: JSON.stringify({
            app_install_id: appInstallId,
            app_session_id: created.app_session_id,
            session_epoch: created.session_epoch,
            source_language: "en",
            target_language: "ar",
          }),
          method: "POST",
        }),
        env,
      );

      expect(refreshResponse.status).toBe(200);
      const refreshed = (await refreshResponse.json()) as {
        app_session_id: string;
        deepgram_ws_url?: string;
        session_epoch: number;
        tokens: { deepgram_token: string | null; token_bundle_id: string };
      };
      expect(refreshed.app_session_id).toBe(created.app_session_id);
      expect(refreshed.deepgram_ws_url).toContain("/v1/deepgram");
      expect(refreshed.session_epoch).toBe(created.session_epoch + 1);
      expect(refreshed.tokens.deepgram_token).toBeNull();
      expect(refreshed.tokens.token_bundle_id).not.toBe(created.tokens.token_bundle_id);
      expect(cartesiaTokensMinted).toBe(2);

      const mismatchResponse = await worker.fetch(
        new Request(`https://murmur.test/v1/session/${created.app_session_id}/tokens`, {
          body: JSON.stringify({
            app_install_id: appInstallId,
            app_session_id: "different_session",
            session_epoch: refreshed.session_epoch,
            source_language: "en",
            target_language: "ar",
          }),
          method: "POST",
        }),
        env,
      );
      expect(mismatchResponse.status).toBe(400);
      await expect(mismatchResponse.json()).resolves.toEqual({ error: "session_id_mismatch" });

      const invalidEpochResponse = await worker.fetch(
        new Request(`https://murmur.test/v1/session/${created.app_session_id}/tokens`, {
          body: JSON.stringify({
            app_install_id: appInstallId,
            app_session_id: created.app_session_id,
            session_epoch: 0,
            source_language: "en",
            target_language: "ar",
          }),
          method: "POST",
        }),
        env,
      );
      expect(invalidEpochResponse.status).toBe(400);
      await expect(invalidEpochResponse.json()).resolves.toEqual({ error: "invalid_session_epoch" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("creates a session with a Worker-proxied Deepgram URL instead of minting a Deepgram token", async () => {
    const originalFetch = globalThis.fetch;
    let deepgramRequests = 0;
    globalThis.fetch = async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("deepgram.com")) {
        deepgramRequests += 1;
      }
      return Response.json({});
    };

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/session", {
          body: JSON.stringify({
            app_install_id: `install_deepgram_proxy_${Date.now()}`,
            device_integrity: {
              available: true,
              platform: "android",
              provider: "play_integrity",
              token: "integrity_token_long_enough_for_worker_contract",
            },
            source_language: "en",
            target_language: "ar",
          }),
          method: "POST",
        }),
        {
          DEEPGRAM_API_KEY: "deepgram_key",
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        deepgram_ws_url?: string;
        tokens?: { deepgram_token?: string | null };
      };
      expect(body.deepgram_ws_url).toContain("/v1/deepgram");
      expect(body.deepgram_ws_url).toContain("source_language=en");
      expect(body.tokens?.deepgram_token).toBeNull();
      expect(deepgramRequests).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("creates auto-source sessions with a multilingual Deepgram proxy URL", async () => {
    const response = await worker.fetch(
      new Request("https://murmur.test/v1/session", {
        body: JSON.stringify({
          app_install_id: `install_auto_source_${Date.now()}`,
          source_language: "auto",
          target_language: "ar",
        }),
        method: "POST",
      }),
      {
        DEEPGRAM_API_KEY: "deepgram_key",
        OPENROUTER_API_KEY: "openrouter_key",
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { deepgram_ws_url?: string };
    expect(body.deepgram_ws_url).toContain("source_language=auto");
  });

  it("keeps captions available when Cartesia token minting fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("cartesia.ai")) {
        return Response.json({ error: "voice_service_down" }, { status: 503 });
      }
      return Response.json({});
    };

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/session", {
          body: JSON.stringify({
            app_install_id: `install_cartesia_fail_${Date.now()}`,
            device_integrity: {
              available: true,
              platform: "android",
              provider: "play_integrity",
              token: "integrity_token_long_enough_for_worker_contract",
            },
            source_language: "en",
            target_language: "ar",
          }),
          method: "POST",
        }),
        {
          CARTESIA_API_KEY: "cartesia_key",
          CARTESIA_DEFAULT_VOICE_ID: "voice_default",
          DEEPGRAM_API_KEY: "deepgram_key",
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        speech?: { enabled?: boolean };
        tokens?: { cartesia_access_token?: string | null; deepgram_token?: string | null };
      };
      expect(body.tokens?.deepgram_token).toBeNull();
      expect(body.tokens?.cartesia_access_token).toBeNull();
      expect(body.speech?.enabled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rate limits repeated report submissions through the report route", async () => {
    const appSessionId = `session_report_route_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: `install_report_route_${Date.now()}`,
      now_ms: Date.now(),
    });
    const reportBody = {
      app_session_id: appSessionId,
      error_category: "inaccurate",
      revision: 1,
      source_language: "en",
      span_id: "span_report_route",
      target_language: "ar",
    };

    for (let index = 0; index < 10; index += 1) {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/report", {
          body: JSON.stringify(reportBody),
          method: "POST",
        }),
        {},
      );
      expect(response.status).toBe(202);
    }

    const limitedResponse = await worker.fetch(
      new Request("https://murmur.test/v1/report", {
        body: JSON.stringify(reportBody),
        method: "POST",
      }),
      {},
    );
    expect(limitedResponse.status).toBe(429);
    await expect(limitedResponse.json()).resolves.toEqual({ error: "report_rate_limited" });
  });

  it("rejects report submissions for unknown sessions", async () => {
    const response = await worker.fetch(
      new Request("https://murmur.test/v1/report", {
        body: JSON.stringify({
          app_session_id: `session_unknown_route_${Date.now()}`,
          error_category: "inaccurate",
          revision: 1,
          source_language: "en",
          span_id: "span_unknown_route",
          target_language: "ar",
        }),
        method: "POST",
      }),
      {},
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "session_closed" });
  });

  it("stores report receipts in an admin-protected inbox", async () => {
    const appSessionId = `session_report_inbox_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: `install_report_inbox_${Date.now()}`,
      now_ms: Date.now(),
    });

    const reportResponse = await worker.fetch(
      new Request("https://murmur.test/v1/report", {
        body: JSON.stringify({
          app_session_id: appSessionId,
          error_category: "wrong_language",
          optional_source_text_snapshot: "do not store source",
          optional_translated_text_snapshot: "do not store translation",
          optional_user_note: "do not store note",
          provider_metadata: { upstream_provider: "test" },
          revision: 1,
          source_language: "en",
          span_id: "span_report_inbox",
          target_language: "ar",
        }),
        method: "POST",
      }),
      {},
    );
    expect(reportResponse.status).toBe(202);
    const receipt = (await reportResponse.json()) as { report_id: string };

    const unauthorizedResponse = await worker.fetch(
      new Request("https://murmur.test/v1/reports"),
      { REPORT_ADMIN_TOKEN: "admin_token" },
    );
    expect(unauthorizedResponse.status).toBe(401);

    const inboxResponse = await worker.fetch(
      new Request("https://murmur.test/v1/reports?limit=25", {
        headers: { Authorization: "Bearer admin_token" },
      }),
      { REPORT_ADMIN_TOKEN: "admin_token" },
    );
    expect(inboxResponse.status).toBe(200);
    const inbox = (await inboxResponse.json()) as {
      reports: Array<Record<string, unknown>>;
    };
    const stored = inbox.reports.find((report) => report.report_id === receipt.report_id);

    expect(stored).toMatchObject({
      app_session_id: appSessionId,
      error_category: "wrong_language",
      provider_metadata: { upstream_provider: "test" },
      retained_text_snapshot: true,
      source_language: "en",
      span_id: "span_report_inbox",
      target_language: "ar",
    });
    expect(JSON.stringify(stored)).not.toContain("do not store");
  });

  it("deletes report inbox records through the admin endpoint", async () => {
    const appSessionId = `session_report_delete_${Date.now()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: `install_report_delete_${Date.now()}`,
      now_ms: Date.now(),
    });

    const reportResponse = await worker.fetch(
      new Request("https://murmur.test/v1/report", {
        body: JSON.stringify({
          app_session_id: appSessionId,
          error_category: "other",
          revision: 1,
          source_language: "en",
          span_id: "span_report_delete",
          target_language: "ar",
        }),
        method: "POST",
      }),
      {},
    );
    const receipt = (await reportResponse.json()) as { report_id: string };

    const unauthorizedDelete = await worker.fetch(
      new Request(`https://murmur.test/v1/reports/${receipt.report_id}`, {
        method: "DELETE",
      }),
      { REPORT_ADMIN_TOKEN: "admin_token" },
    );
    expect(unauthorizedDelete.status).toBe(401);

    const deleteResponse = await worker.fetch(
      new Request(`https://murmur.test/v1/reports/${receipt.report_id}`, {
        headers: { Authorization: "Bearer admin_token" },
        method: "DELETE",
      }),
      { REPORT_ADMIN_TOKEN: "admin_token" },
    );
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({ deleted: true });

    const inboxResponse = await worker.fetch(
      new Request("https://murmur.test/v1/reports?limit=50", {
        headers: { Authorization: "Bearer admin_token" },
      }),
      { REPORT_ADMIN_TOKEN: "admin_token" },
    );
    const inbox = (await inboxResponse.json()) as {
      reports: Array<Record<string, unknown>>;
    };
    expect(inbox.reports.some((report) => report.report_id === receipt.report_id)).toBe(false);
  });
});
