import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatCompletionPayload } from "./types";
import { readProviderChatCompletionStream } from "./chatCompletionStream";

function makePayload(): ChatCompletionPayload {
  return {
    max_tokens: 64,
    messages: [
      { content: "Translate carefully.", role: "system" },
      { content: "Hello", role: "user" },
    ],
    model: "model-a",
    stream: true,
    temperature: 0,
  };
}

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("provider chat completion stream reader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("streams deltas, forwards request metadata, and merges upstream metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        makeStream([
          'data: {"id":"gen_1","model":"model-a","provider":"provider-a","choices":[{"delta":{"content":"Hel"}}]}\n',
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
          "data: [DONE]\n",
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onDelta = vi.fn();

    const result = await readProviderChatCompletionStream({
      api_key: "provider_key",
      endpoint: "https://provider.test/chat/completions",
      error_prefix: "openrouter",
      extra_headers: { "HTTP-Referer": "https://murmur.test" },
      onDelta,
      payload: makePayload(),
      signal: new AbortController().signal,
      timeout_ms: 1_000,
    });

    expect(result).toEqual({
      provider_metadata: {
        upstream_id: "gen_1",
        upstream_model: "model-a",
        upstream_provider: "provider-a",
      },
      text: "Hello",
    });
    expect(onDelta).toHaveBeenNthCalledWith(1, "Hel", {
      upstream_id: "gen_1",
      upstream_model: "model-a",
      upstream_provider: "provider-a",
    });
    expect(onDelta).toHaveBeenNthCalledWith(2, "lo", {
      upstream_id: undefined,
      upstream_model: undefined,
      upstream_provider: undefined,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://provider.test/chat/completions",
      expect.objectContaining({
        body: JSON.stringify(makePayload()),
        headers: expect.objectContaining({
          Authorization: "Bearer provider_key",
          "Content-Type": "application/json",
          "HTTP-Referer": "https://murmur.test",
        }),
        method: "POST",
      }),
    );
  });

  it("raises provider-specific errors for http and incomplete streams", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));

    await expect(
      readProviderChatCompletionStream({
        api_key: "provider_key",
        endpoint: "https://provider.test/chat/completions",
        error_prefix: "groq",
        extra_headers: {},
        payload: makePayload(),
        signal: new AbortController().signal,
        timeout_ms: 1_000,
      }),
    ).rejects.toThrow("groq_http_429");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(makeStream(['data: {"choices":[{"delta":{"content":"partial"}}]}\n']), {
          status: 200,
        }),
      ),
    );

    await expect(
      readProviderChatCompletionStream({
        api_key: "provider_key",
        endpoint: "https://provider.test/chat/completions",
        error_prefix: "openrouter",
        extra_headers: {},
        payload: makePayload(),
        signal: new AbortController().signal,
        timeout_ms: 1_000,
      }),
    ).rejects.toThrow("openrouter_stream_incomplete");
  });
});
