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
  getTranslationErrorCode,
  handleSocketMessage,
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
const configuredProviderEnv = {
  CARTESIA_API_KEY: "cartesia_key",
  CARTESIA_DEFAULT_VOICE_ID: "voice_default",
  DEEPGRAM_API_KEY: "deepgram_key",
  OPENROUTER_API_KEY: "openrouter_key",
};

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

type SocketMessage = Parameters<typeof handleSocketMessage>[1];
type WorkerEnv = Parameters<typeof handleSocketMessage>[2];
type TranslationSocketRequest = TranslationRequest & { kind: "translate" };

function makeSseResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(lines.join("\n")));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

function makeSseLines(...events: string[]): string[] {
  return events.flatMap((event) => [event, ""]);
}

function makeCollectingSocket(): { sent: unknown[]; socket: SocketMessage } {
  const sent: unknown[] = [];
  const socket = {
    close: vi.fn(),
    readyState: WEBSOCKET_OPEN,
    send: (payload: string) => sent.push(JSON.parse(payload)),
  } as unknown as SocketMessage;
  return { sent, socket };
}

async function createTestSession(sessionPrefix: string, installPrefix: string): Promise<string> {
  const appSessionId = `${sessionPrefix}_${Date.now()}`;
  await createSessionRecordDurable({
    app_session_id: appSessionId,
    hashed_install_id: `${installPrefix}_${Date.now()}`,
    now_ms: Date.now(),
  });
  return appSessionId;
}

async function fetchProductionText(path: string): Promise<{ body: string; response: Response }> {
  const response = await worker.fetch(new Request(`https://worker.example${path}`), {
    MURMUR_ENV: "production",
  });
  return { body: await response.text(), response };
}

function makePlayIntegrityDeviceIntegrity(nonce: string): Record<string, unknown> {
  return {
    available: true,
    nonce,
    platform: "android",
    provider: "play_integrity",
    token: "integrity_token_long_enough_for_worker_contract",
  };
}

function makeAppAttestDeviceIntegrity(nonce: string, kind: "assertion" | "attestation"): Record<string, unknown> {
  return {
    available: true,
    key_id: "app_attest_key",
    kind,
    nonce,
    platform: "ios",
    provider: "app_attest",
    token: `${kind}_payload_long_enough_for_worker_contract`,
  };
}

function makeTranslateRequest(
  appSessionId: string,
  spanId: string,
  overrides: Partial<TranslationRequest> = {},
): TranslationSocketRequest {
  return {
    app_session_id: appSessionId,
    connection_id: "connection_translate",
    context_spans: [],
    event_seq: 1,
    kind: "translate",
    revision: 1,
    session_epoch: 1,
    source_caption: "Hello",
    source_language: "en",
    span_id: spanId,
    target_language: "ar",
    translation_attempt: 1,
    ...overrides,
  };
}

async function sendTranslateRequest(
  request: TranslationSocketRequest,
  env: WorkerEnv,
): Promise<unknown[]> {
  const { sent, socket } = makeCollectingSocket();
  await handleSocketMessage(JSON.stringify(request), socket, env, new Map());
  return sent;
}

function makeJsonPostRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function postSummary(body: SummaryRequest, env: WorkerEnv = { OPENROUTER_API_KEY: "openrouter_key" }): Promise<Response> {
  return worker.fetch(makeJsonPostRequest("https://murmur.test/v1/summary", body), env);
}

async function expectSummaryRejectedBeforeOpenRouter(
  body: SummaryRequest,
  status: number,
  expectedJson: unknown,
): Promise<void> {
  let upstreamCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    upstreamCalled = true;
    return Response.json({ choices: [{ message: { content: "should not run" } }] });
  };

  try {
    const response = await postSummary(body);
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(expectedJson);
    expect(upstreamCalled).toBe(false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function makeSessionBody(
  appInstallId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    app_install_id: appInstallId,
    source_language: "en",
    target_language: "ar",
    ...overrides,
  };
}

async function postSession(body: Record<string, unknown>, env: WorkerEnv = configuredProviderEnv): Promise<Response> {
  return worker.fetch(makeJsonPostRequest("https://murmur.test/v1/session", body), env);
}

async function refreshSessionTokensRequest(
  appSessionId: string,
  body: Record<string, unknown>,
  env: WorkerEnv = configuredProviderEnv,
): Promise<Response> {
  return worker.fetch(
    makeJsonPostRequest(`https://murmur.test/v1/session/${appSessionId}/tokens`, body),
    env,
  );
}

function stubProviderTokenFetch(
  options: { cartesiaStatus?: number; countCartesia?: () => void; countDeepgram?: () => void } = {},
): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("deepgram.com")) {
      options.countDeepgram?.();
      return Response.json({ access_token: "deepgram_token" });
    }
    if (url.includes("cartesia.ai")) {
      options.countCartesia?.();
      if (options.cartesiaStatus) {
        return Response.json({ error: "voice_service_down" }, { status: options.cartesiaStatus });
      }
      return Response.json({ token: "cartesia_token" });
    }
    return Response.json({});
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function stubCountingCartesiaFetch(): { cartesiaTokensMinted: () => number; restoreFetch: () => void } {
  let cartesiaTokensMinted = 0;
  const restoreFetch = stubProviderTokenFetch({
    countCartesia: () => {
      cartesiaTokensMinted += 1;
    },
  });
  return {
    cartesiaTokensMinted: () => cartesiaTokensMinted,
    restoreFetch,
  };
}

function stubPlayIntegrityFetch(
  nonce: string,
  options: { includeProviderTokens?: boolean; timestampMillis?: string } = {},
): () => void {
  const originalFetch = globalThis.fetch;
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
            ...(options.timestampMillis ? { timestampMillis: options.timestampMillis } : {}),
          },
        },
      });
    }
    if (options.includeProviderTokens && url.includes("deepgram.com")) {
      return Response.json({ access_token: "deepgram_token" });
    }
    if (options.includeProviderTokens && url.includes("cartesia.ai")) {
      return Response.json({ token: "cartesia_token" });
    }
    return Response.json({});
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

describe("worker routes", () => {
  it("serves the marketing homepage at root", async () => {
    const { body, response } = await fetchProductionText("/");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(body).toContain("Murmur");
    expect(body).toContain("Translated captions appear as each phrase is recognized.");
    expect(body).toContain("Accountless Live Speech Translation App");
    expect(body).toContain('rel="canonical" href="https://murmur.q9labs.ai/"');
    expect(body).toContain('href="/favicon.svg"');
    expect(body).toContain("application/ld+json");
    expect(body).toContain("Listen");
    expect(body).toContain('href="https://apps.apple.com/app/id6756962206"');
    expect(body).toContain(
      'href="https://play.google.com/store/apps/details?id=com.q9labsai.murmur"',
    );
    expect(body).toContain("<span>App Store</span>");
    expect(body).toContain("<span>Google Play</span>");
    expect(body).not.toContain("Store links will appear after review.");
    expect(body).toContain('href="/privacy"');
    expect(body).toContain('href="/terms"');
    expect(body).toContain('href="/support"');
    expect(body).toContain('<section class="hero">');
    expect(body).toContain('<section class="values">');
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
      const { body, response } = await fetchProductionText(path);

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
    const response = await worker.fetch(new Request("https://worker.example/ready"), {
      MURMUR_ENV: "production",
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("reports ready when required providers are configured", async () => {
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

});

describe("worker summary routes", () => {
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
    await expectSummaryRejectedBeforeOpenRouter(
      makeSummaryRequestBody(`session_unknown_summary_${Date.now()}`),
      409,
      {
        error: "session_closed",
        retryable: false,
      },
    );
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
    await expectSummaryRejectedBeforeOpenRouter(
      makeSummaryRequestBody(appSessionId),
      409,
      {
        error: "session_closed",
        retryable: false,
      },
    );
  });

  it("does not consume summary quota when OpenRouter is unconfigured", async () => {
    const appSessionId = await createTestSession(
      "session_summary_unconfigured",
      "install_summary_unconfigured",
    );

    for (let index = 0; index < defaultRateLimits.summariesPerMinute + 1; index += 1) {
      const response = await postSummary(makeSummaryRequestBody(appSessionId), {});

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
      const response = await postSummary(makeSummaryRequestBody(appSessionId));

      expect(response.status).toBe(200);
      expect(upstreamCalled).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects mismatched summary source character counts before OpenRouter", async () => {
    const body = makeSummaryRequestBody(`session_summary_bad_chars_${Date.now()}`);
    body.spans_to_summarize[0] = {
      ...body.spans_to_summarize[0],
      source_char_count: body.spans_to_summarize[0].source_char_count - 1,
    };

    await expectSummaryRejectedBeforeOpenRouter(
      body,
      400,
      {
        error: "invalid_summary_spans",
        retryable: false,
      },
    );
  });

  it("rejects oversized summary inputs before OpenRouter", async () => {
    const longCaption = "x".repeat(5001);
    const body = makeSummaryRequestBody(`session_summary_oversized_${Date.now()}`);
    body.spans_to_summarize = [
      {
        ...body.spans_to_summarize[0],
        source_caption: longCaption,
        source_char_count: longCaption.length,
      },
    ];

    await expectSummaryRejectedBeforeOpenRouter(
      body,
      400,
      {
        error: "summary_spans_too_large",
        retryable: false,
      },
    );
  });

  it("rate limits summary generation before OpenRouter", async () => {
    const appSessionId = await createTestSession("session_limited_summary", "install_limited_summary");
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

    await expectSummaryRejectedBeforeOpenRouter(
      makeSummaryRequestBody(appSessionId),
      429,
      {
        error: "summaries_per_minute_limit",
        retryable: true,
      },
    );
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

});

describe("worker translation sockets", () => {
  it("streams OpenRouter translation deltas and done events for a valid message", async () => {
    const originalFetch = globalThis.fetch;
    const appSessionId = await createTestSession("session_translate", "install_translate");
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      const body = JSON.parse(String(init?.body)) as { provider?: { data_collection?: string } };
      expect(body.provider?.data_collection).toBe("deny");
      return makeSseResponse(
        makeSseLines(
          'data: {"id":"gen_1","model":"google/gemma-4-26b-a4b-it","provider":"DeepInfra","choices":[{"delta":{"content":"مرحبا"}}]}',
          'data: {"choices":[{"delta":{"content":"!"}}]}',
          "data: [DONE]",
        ),
      );
    };

    try {
      const sent = await sendTranslateRequest(
        makeTranslateRequest(appSessionId, "span_translate", {
          client_request_id: "client_translate_1",
        }),
        {
          OPENROUTER_API_KEY: "openrouter_key",
          OPENROUTER_MODEL: "google/gemma-4-26b-a4b-it",
        },
      );

      expect(sent).toHaveLength(3);
      expect(sent[0]).toMatchObject({
        client_request_id: "client_translate_1",
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
        client_request_id: "client_translate_1",
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

  it("streams only target text for continuous COMMIT actions", async () => {
    const originalFetch = globalThis.fetch;
    const appSessionId = await createTestSession("session_interpreter_commit", "install_interpreter_commit");
    globalThis.fetch = async () =>
      makeSseResponse(
        makeSseLines(
          'data: {"choices":[{"delta":{"content":"COMMIT\\nمر"}}]}',
          'data: {"choices":[{"delta":{"content":"حبا"}}]}',
          "data: [DONE]",
        ),
      );

    try {
      const sent = await sendTranslateRequest(
        makeTranslateRequest(appSessionId, "span_interpreter_commit", {
          client_request_id: "client_interpreter_commit_1",
          source_status: "stable",
          translation_mode: "continuous",
        }),
        { OPENROUTER_API_KEY: "openrouter_key" },
      );

      expect(sent).toHaveLength(3);
      expect(sent[0]).toMatchObject({
        delta: "مر",
        draft_text: "مر",
        kind: "translation_delta",
      });
      expect(sent[1]).toMatchObject({
        delta: "حبا",
        draft_text: "مرحبا",
        kind: "translation_delta",
      });
      expect(sent[2]).toMatchObject({
        client_request_id: "client_interpreter_commit_1",
        kind: "translation_done",
        provider_metadata: {
          action_protocol: "interpreter_v1",
          target_action: "commit",
        },
        translated_caption: "مرحبا",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns translation_wait for continuous WAIT actions", async () => {
    const originalFetch = globalThis.fetch;
    const appSessionId = await createTestSession("session_interpreter_wait", "install_interpreter_wait");
    globalThis.fetch = async () =>
      makeSseResponse(
        makeSseLines(
          'data: {"choices":[{"delta":{"content":"WAIT: needs object"}}]}',
          "data: [DONE]",
        ),
      );

    try {
      const sent = await sendTranslateRequest(
        makeTranslateRequest(appSessionId, "span_interpreter_wait", {
          client_request_id: "client_interpreter_wait_1",
          source_caption: "I need to book",
          source_status: "stable",
          translation_mode: "continuous",
        }),
        { OPENROUTER_API_KEY: "openrouter_key" },
      );

      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({
        client_request_id: "client_interpreter_wait_1",
        kind: "translation_wait",
        reason: "needs object",
        span_id: "span_interpreter_wait",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects dev translation model routes on production translation sockets", async () => {
    const sent = await sendTranslateRequest(
      makeTranslateRequest("session_translate_model_route", "span_translate_model_route", {
        connection_id: "connection_translate_model_route",
        translation_model_route: "groq_gpt_oss_120b_low",
      }),
      {
        MURMUR_ENV: "production",
      },
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
    const appSessionId = await createTestSession("session_groq_translate", "install_groq_translate");
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
      return makeSseResponse(
        makeSseLines(
          'data: {"id":"groq_1","model":"openai/gpt-oss-120b","choices":[{"delta":{"content":"مرحبا"}}]}',
          "data: [DONE]",
        ),
      );
    };

    try {
      const sent = await sendTranslateRequest(
        makeTranslateRequest(appSessionId, "span_groq_translate", {
          connection_id: "connection_groq_translate",
          translation_model_route: "groq_gpt_oss_120b_low",
        }),
        {
          GROQ_API_KEY: "groq_key",
          MURMUR_ENV: "development",
        },
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

  it("streams Groq preview drafts before Gemma final captions for the preview experiment", async () => {
    const originalFetch = globalThis.fetch;
    const appSessionId = await createTestSession("session_groq_preview_gemma", "install_groq_preview_gemma");
    const upstreamCalls: Array<{ body: Record<string, unknown>; url: string }> = [];
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      upstreamCalls.push({ body, url });
      const content = url.includes("groq.com") ? "C\nمسودة" : "نهائي";
      const model = url.includes("groq.com") ? "openai/gpt-oss-20b" : "google/gemma-4-26b-a4b-it";
      return makeSseResponse(
        makeSseLines(
          `data: ${JSON.stringify({ id: `${model}_1`, model, choices: [{ delta: { content } }] })}`,
          "data: [DONE]",
        ),
      );
    };

    try {
      const sent = await sendTranslateRequest(
        makeTranslateRequest(appSessionId, "span_preview_gemma", {
          client_request_id: "client_preview_gemma_1",
          connection_id: "connection_preview_gemma",
          source_caption: "Hello there",
          source_status: "stable",
          translation_model_route: "experiment_groq_preview_gemma",
          translation_mode: "continuous",
        }),
        {
          GROQ_API_KEY: "groq_key",
          MURMUR_ENV: "development",
          OPENROUTER_API_KEY: "openrouter_key",
        },
      );

      expect(upstreamCalls).toHaveLength(2);
      expect(upstreamCalls[0]).toMatchObject({
        url: "https://api.groq.com/openai/v1/chat/completions",
        body: { model: "openai/gpt-oss-20b" },
      });
      expect(upstreamCalls[1]).toMatchObject({
        url: "https://openrouter.ai/api/v1/chat/completions",
        body: { model: "google/gemma-4-26b-a4b-it" },
      });
      expect(sent).toHaveLength(3);
      expect(sent[0]).toMatchObject({
        draft_text: "مسودة",
        kind: "translation_delta",
      });
      expect(sent[1]).toMatchObject({
        draft_text: "نهائي",
        kind: "translation_delta",
      });
      expect(sent[2]).toMatchObject({
        kind: "translation_done",
        provider_metadata: {
          experiment: "groq_preview_gemma",
          final_model: "google/gemma-4-26b-a4b-it",
          final_provider: "openrouter",
          preview_model: "openai/gpt-oss-20b",
          preview_provider: "groq",
          provider: "mixed",
          route_id: "experiment_groq_preview_gemma",
        },
        translated_caption: "نهائي",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects OpenRouter streams that end before DONE", async () => {
    const originalFetch = globalThis.fetch;
    const appSessionId = await createTestSession("session_incomplete_stream", "install_incomplete_stream");
    globalThis.fetch = async () =>
      makeSseResponse(['data: {"choices":[{"delta":{"content":"partial"}}]}', ""]);

    try {
      const sent = await sendTranslateRequest(
        makeTranslateRequest(appSessionId, "span_incomplete_stream"),
        {
          OPENROUTER_API_KEY: "openrouter_key",
        },
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
    const appSessionId = await createTestSession("session_empty_stream", "install_empty_stream");
    globalThis.fetch = async () => makeSseResponse(makeSseLines("data: [DONE]"));

    try {
      const sent = await sendTranslateRequest(
        makeTranslateRequest(appSessionId, "span_empty_stream"),
        {
          OPENROUTER_API_KEY: "openrouter_key",
        },
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

});

describe("worker session routes", () => {
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

  it("creates Ultravox replacement sessions with a server WebSocket join URL", async () => {
    const originalFetch = globalThis.fetch;
    let createCallBody: Record<string, unknown> | null = null;
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      expect(url).toBe("https://api.ultravox.ai/api/calls");
      expect((init?.headers as Record<string, string>)["X-API-Key"]).toBe("ultravox_key");
      createCallBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ callId: "call_ultravox_1", joinUrl: "wss://ultravox.example/join" }, { status: 201 });
    };

    try {
      const response = await worker.fetch(
        new Request("https://murmur.test/v1/session", {
          body: JSON.stringify({
            app_install_id: `install_ultravox_${Date.now()}`,
            source_language: "en",
            target_language: "ar",
            translation_model_route: "experiment_ultravox_replacement",
            ultravox_vad_enabled: true,
          }),
          method: "POST",
        }),
        {
          MURMUR_ENV: "development",
          ULTRAVOX_API_KEY: "ultravox_key",
        },
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        deepgram_ws_url?: string;
        tokens?: { cartesia_access_token?: string | null; deepgram_token?: string | null };
        ultravox?: { call_id?: string; join_url?: string; vad_profile?: string };
      };
      expect(createCallBody).toMatchObject({
        initialOutputMedium: "MESSAGE_MEDIUM_TEXT",
        medium: {
          serverWebSocket: {
            inputSampleRate: 16000,
          },
        },
        vadSettings: {
          turnEndpointDelay: "0.096s",
        },
      });
      expect(body.deepgram_ws_url).toBeUndefined();
      expect(body.tokens?.cartesia_access_token).toBeNull();
      expect(body.tokens?.deepgram_token).toBeNull();
      expect(body.ultravox).toEqual({
        call_id: "call_ultravox_1",
        join_url: "wss://ultravox.example/join",
        vad_enabled: true,
        vad_profile: "low_latency",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
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
    const response = await postSession(
      makeSessionBody("install_integrity_unconfigured", {
        device_integrity: makePlayIntegrityDeviceIntegrity("nonce_integrity_unconfigured"),
      }),
      { MURMUR_REQUIRE_DEVICE_INTEGRITY: "true" },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "device_integrity_verifier_unconfigured",
    });
  });

  it("verifies Play Integrity before returning a session when enforcement is enabled", async () => {
    const nonce = "nonce_integrity_verified";
    const restoreFetch = stubPlayIntegrityFetch(nonce, { includeProviderTokens: true });

    try {
      const response = await postSession(
        makeSessionBody(`install_integrity_${Date.now()}`, {
          device_integrity: makePlayIntegrityDeviceIntegrity(nonce),
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
      restoreFetch();
    }
  });

  it("rejects stale Play Integrity tokens when Google returns a signed timestamp", async () => {
    const nonce = "nonce_integrity_stale";
    const restoreFetch = stubPlayIntegrityFetch(nonce, { timestampMillis: "1" });

    try {
      const response = await postSession(
        makeSessionBody(`install_integrity_stale_${Date.now()}`, {
          device_integrity: makePlayIntegrityDeviceIntegrity(nonce),
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
      restoreFetch();
    }
  });

  it("does not mint provider tokens for iOS App Attest when server verification is unconfigured", async () => {
    const response = await postSession(
      makeSessionBody("install_app_attest_unconfigured", {
        device_integrity: makeAppAttestDeviceIntegrity("nonce_app_attest_unconfigured", "attestation"),
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
    const restoreFetch = stubProviderTokenFetch();
    const installId = `install_app_attest_${Date.now()}`;
    appAttestMocks.verifyAttestation.mockResolvedValueOnce({
      publicKeyPem: "-----BEGIN PUBLIC KEY-----\nmock\n-----END PUBLIC KEY-----",
      receipt: new Uint8Array([1, 2, 3]),
      signCount: 0,
    });
    appAttestMocks.verifyAssertion.mockResolvedValueOnce({ signCount: 1 });

    try {
      const createResponse = await postSession(
        makeSessionBody(installId, {
          device_integrity: {
            available: true,
            key_id: "app_attest_key_verified",
            kind: "attestation",
            nonce: "nonce_app_attest_verified",
            platform: "ios",
            provider: "app_attest",
            token: "app_attest_payload_long_enough_for_worker_contract",
          },
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

      const refreshResponse = await refreshSessionTokensRequest(
        createBody.app_session_id,
        makeSessionBody(installId, {
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
      restoreFetch();
      appAttestMocks.verifyAttestation.mockReset();
      appAttestMocks.verifyAssertion.mockReset();
    }
  });

  it("selects a Cartesia voice by target language when configured", async () => {
    const restoreFetch = stubProviderTokenFetch();

    try {
      const response = await postSession(
        makeSessionBody(`install_voice_${Date.now()}`, {
          device_integrity: {
            available: true,
            platform: "android",
            provider: "play_integrity",
            token: "integrity_token_long_enough_for_worker_contract",
          },
        }),
        {
          ...configuredProviderEnv,
          CARTESIA_DEFAULT_VOICE_ID: "voice_default",
          CARTESIA_VOICE_ID_BY_LANGUAGE: JSON.stringify({ ar: "voice_ar", nl: "voice_nl" }),
        },
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { speech?: { default_voice_id?: string } };
      expect(body.speech?.default_voice_id).toBe("voice_ar");
    } finally {
      restoreFetch();
    }
  });

  it("skips Cartesia token minting for continuous sessions", async () => {
    const cartesiaCounter = stubCountingCartesiaFetch();

    try {
      const env = configuredProviderEnv;
      const appInstallId = `install_continuous_speech_${Date.now()}`;
      const createResponse = await postSession(
        makeSessionBody(appInstallId, { translation_mode: "continuous" }),
        env,
      );

      expect(createResponse.status).toBe(200);
      const created = (await createResponse.json()) as {
        app_session_id: string;
        session_epoch: number;
        speech?: { enabled?: boolean };
        tokens: { cartesia_access_token: string | null };
      };
      expect(created.tokens.cartesia_access_token).toBeNull();
      expect(created.speech?.enabled).toBe(false);

      const refreshResponse = await refreshSessionTokensRequest(
        created.app_session_id,
        makeSessionBody(appInstallId, {
          app_session_id: created.app_session_id,
          session_epoch: created.session_epoch,
          translation_mode: "continuous",
        }),
        env,
      );

      expect(refreshResponse.status).toBe(200);
      const refreshed = (await refreshResponse.json()) as {
        speech?: { enabled?: boolean };
        tokens: { cartesia_access_token: string | null };
      };
      expect(refreshed.tokens.cartesia_access_token).toBeNull();
      expect(refreshed.speech?.enabled).toBe(false);
      expect(cartesiaCounter.cartesiaTokensMinted()).toBe(0);
    } finally {
      cartesiaCounter.restoreFetch();
    }
  });

  it("refreshes provider tokens for an existing session without creating a new session", async () => {
    const cartesiaCounter = stubCountingCartesiaFetch();

    try {
      const env = configuredProviderEnv;
      const appInstallId = `install_refresh_${Date.now()}`;
      const createResponse = await postSession(makeSessionBody(appInstallId), env);
      expect(createResponse.status).toBe(200);
      const created = (await createResponse.json()) as {
        app_session_id: string;
        deepgram_ws_url: string;
        session_epoch: number;
        tokens: { deepgram_token: string | null; token_bundle_id: string };
      };
      expect(created.deepgram_ws_url).toContain("/v1/deepgram");
      expect(created.tokens.deepgram_token).toBeNull();

      const refreshResponse = await refreshSessionTokensRequest(
        created.app_session_id,
        makeSessionBody(appInstallId, {
          app_session_id: created.app_session_id,
          session_epoch: created.session_epoch,
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
      expect(cartesiaCounter.cartesiaTokensMinted()).toBe(2);

      const mismatchResponse = await refreshSessionTokensRequest(
        created.app_session_id,
        makeSessionBody(appInstallId, {
          app_session_id: "different_session",
          session_epoch: refreshed.session_epoch,
        }),
        env,
      );
      expect(mismatchResponse.status).toBe(400);
      await expect(mismatchResponse.json()).resolves.toEqual({ error: "session_id_mismatch" });

      const invalidEpochResponse = await refreshSessionTokensRequest(
        created.app_session_id,
        makeSessionBody(appInstallId, {
          app_session_id: created.app_session_id,
          session_epoch: 0,
        }),
        env,
      );
      expect(invalidEpochResponse.status).toBe(400);
      await expect(invalidEpochResponse.json()).resolves.toEqual({ error: "invalid_session_epoch" });
    } finally {
      cartesiaCounter.restoreFetch();
    }
  });

  it("creates a session with a Worker-proxied Deepgram URL instead of minting a Deepgram token", async () => {
    let deepgramRequests = 0;
    const restoreFetch = stubProviderTokenFetch({
      countDeepgram: () => {
        deepgramRequests += 1;
      },
    });

    try {
      const response = await postSession(
        makeSessionBody(`install_deepgram_proxy_${Date.now()}`, {
          device_integrity: {
            available: true,
            platform: "android",
            provider: "play_integrity",
            token: "integrity_token_long_enough_for_worker_contract",
          },
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
      restoreFetch();
    }
  });

  it("creates auto-source sessions with a multilingual Deepgram proxy URL", async () => {
    const response = await postSession(
      makeSessionBody(`install_auto_source_${Date.now()}`, { source_language: "auto" }),
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
    const restoreFetch = stubProviderTokenFetch({ cartesiaStatus: 503 });

    try {
      const response = await postSession(
        makeSessionBody(`install_cartesia_fail_${Date.now()}`, {
          device_integrity: {
            available: true,
            platform: "android",
            provider: "play_integrity",
            token: "integrity_token_long_enough_for_worker_contract",
          },
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
      restoreFetch();
    }
  });

});

describe("worker report routes", () => {
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
    const appSessionId = await createTestSession("session_report_inbox", "install_report_inbox");

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
    const appSessionId = await createTestSession("session_report_delete", "install_report_delete");

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
