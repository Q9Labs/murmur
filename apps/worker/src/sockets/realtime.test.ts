import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const providerMocks = vi.hoisted(() => ({
  openTranslationSocket: vi.fn(),
}));

vi.mock("../providers/openaiRealtime", async (importOriginal) => ({
  ...await importOriginal<typeof import("../providers/openaiRealtime")>(),
  openTranslationSocket: providerMocks.openTranslationSocket,
}));

import type { WorkerWebSocket } from "../http/response";
import { createSessionRecordDurable } from "../rateLimitDurableObject";
import {
  isAcceptedAudioFrame,
  parseClientCommand,
  proxyRealtimeSession,
} from "./realtime";

// cspell:ignore AQID AQIDBA

class FakeSocket extends EventTarget {
  binaryType = "blob";
  closeCalls: Array<{ code?: number; reason?: string }> = [];
  readyState = 1;
  sent: unknown[] = [];

  accept(): void {}

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this.readyState = 3;
  }

  send(value: unknown): void {
    this.sent.push(value);
  }
}

async function openTestRealtimeSession(params: {
  env?: Parameters<typeof proxyRealtimeSession>[2];
  name: string;
  targetLanguage?: string;
}): Promise<{ appSessionId: string; client: FakeSocket; upstream: FakeSocket }> {
  const appSessionId = `session_${params.name}_${crypto.randomUUID()}`;
  await createSessionRecordDurable({
    app_session_id: appSessionId,
    hashed_install_id: "install_hash",
    now_ms: Date.now(),
  });
  const client = new FakeSocket();
  const upstream = new FakeSocket();
  providerMocks.openTranslationSocket.mockResolvedValueOnce(
    upstream as unknown as WorkerWebSocket,
  );
  await proxyRealtimeSession(
    new Request(
      `https://worker.test/v2/realtime?app_session_id=${appSessionId}&target_language=${params.targetLanguage ?? "ar"}`,
    ),
    client as unknown as WorkerWebSocket,
    params.env ?? { OPENAI_API_KEY: "test_key" },
  );
  return { appSessionId, client, upstream };
}

describe("app-facing realtime socket", () => {
  beforeEach(() => {
    providerMocks.openTranslationSocket.mockReset();
    vi.stubGlobal("WebSocket", { CONNECTING: 0, OPEN: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts only the close command", () => {
    expect(parseClientCommand(JSON.stringify({ kind: "close_session" }))).toEqual({
      kind: "close_session",
    });
    expect(parseClientCommand(JSON.stringify({ kind: "provider_command" }))).toBeNull();
    expect(parseClientCommand("not-json")).toBeNull();
  });

  it("bounds binary audio frames", () => {
    expect(isAcceptedAudioFrame(960)).toBe(true);
    expect(isAcceptedAudioFrame(9_600)).toBe(true);
    expect(isAcceptedAudioFrame(64 * 1024)).toBe(true);
    expect(isAcceptedAudioFrame(0)).toBe(false);
    expect(isAcceptedAudioFrame(959)).toBe(false);
    expect(isAcceptedAudioFrame(64 * 1024 + 1)).toBe(false);
  });

  it("closes invalid, unconfigured, and unknown sessions", async () => {
    const invalid = new FakeSocket();
    await proxyRealtimeSession(
      new Request("https://worker.test/v2/realtime"),
      invalid as unknown as WorkerWebSocket,
      {},
    );
    expect(invalid.closeCalls).toContainEqual({
      code: 1008,
      reason: "invalid_realtime_request",
    });

    const unconfigured = new FakeSocket();
    await proxyRealtimeSession(
      new Request(
        "https://worker.test/v2/realtime?app_session_id=session&target_language=ar",
      ),
      unconfigured as unknown as WorkerWebSocket,
      {},
    );
    expect(unconfigured.closeCalls).toContainEqual({
      code: 1011,
      reason: "provider_unconfigured",
    });

    const unknown = new FakeSocket();
    await proxyRealtimeSession(
      new Request(
        "https://worker.test/v2/realtime?app_session_id=missing&target_language=ar",
      ),
      unknown as unknown as WorkerWebSocket,
      { OPENAI_API_KEY: "test_key" },
    );
    expect(unknown.closeCalls).toContainEqual({
      code: 1008,
      reason: "session_closed",
    });
  });

  it("reports provider connection failures without leaking details", async () => {
    const appSessionId = `session_failure_${crypto.randomUUID()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: "install_hash",
      now_ms: Date.now(),
    });
    providerMocks.openTranslationSocket.mockRejectedValueOnce(new Error("secret upstream error"));
    const client = new FakeSocket();

    await proxyRealtimeSession(
      new Request(
        `https://worker.test/v2/realtime?app_session_id=${appSessionId}&target_language=ar`,
      ),
      client as unknown as WorkerWebSocket,
      { OPENAI_API_KEY: "test_key" },
    );

    expect(client.sent.map(String).join(" ")).toContain("provider_connection_failed");
    expect(client.sent.map(String).join(" ")).not.toContain("secret upstream error");
    expect(client.closeCalls).toContainEqual({
      code: 1011,
      reason: "provider_connection_failed",
    });
  });

  it("allows one upstream connection per app session", async () => {
    const appSessionId = `session_once_${crypto.randomUUID()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: "install_hash",
      now_ms: Date.now(),
    });
    providerMocks.openTranslationSocket.mockResolvedValueOnce(
      new FakeSocket() as unknown as WorkerWebSocket,
    );
    const request = new Request(
      `https://worker.test/v2/realtime?app_session_id=${appSessionId}&target_language=ar`,
    );

    const firstClient = new FakeSocket();
    await proxyRealtimeSession(request, firstClient as unknown as WorkerWebSocket, {
      OPENAI_API_KEY: "test_key",
    });
    const replay = new FakeSocket();
    await proxyRealtimeSession(request, replay as unknown as WorkerWebSocket, {
      OPENAI_API_KEY: "test_key",
    });

    expect(providerMocks.openTranslationSocket).toHaveBeenCalledOnce();
    expect(replay.closeCalls).toContainEqual({
      code: 1008,
      reason: "session_already_connected",
    });
    firstClient.dispatchEvent(new Event("close"));
  });

  it("closes both sockets at the server-enforced session deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000_000_000);
    const { client, upstream } = await openTestRealtimeSession({ name: "deadline" });
    await vi.advanceTimersByTimeAsync(900_000);

    expect(client.sent.map(String).join(" ")).toContain("session_expired");
    expect(client.closeCalls).toContainEqual({ code: 1008, reason: "session_expired" });
    expect(upstream.closeCalls).toContainEqual({ code: 1008, reason: "session_expired" });
  });

  it("proxies audio, transcripts, translated audio, close, and errors", async () => {
    const { client, upstream } = await openTestRealtimeSession({
      env: {
        OPENAI_API_KEY: "test_key",
        OPENAI_REALTIME_MODEL: "gpt-realtime-translate-test",
      },
      name: "success",
      targetLanguage: "pt-BR",
    });

    expect(providerMocks.openTranslationSocket).toHaveBeenCalledWith({
      apiKey: "test_key",
      model: "gpt-realtime-translate-test",
      safetyIdentifier: "install_hash",
    });
    expect(JSON.parse(String(upstream.sent[0]))).toMatchObject({
      session: {
        audio: {
          input: { transcription: { model: "gpt-realtime-whisper" } },
          output: { language: "pt" },
        },
      },
      type: "session.update",
    });
    expect(client.sent.map(String).join(" ")).toContain("session_opened");

    client.dispatchEvent(new MessageEvent("message", {
      data: new Uint8Array([1, 2, 3, 4]).buffer,
    }));
    await vi.waitFor(() => {
      expect(JSON.parse(String(upstream.sent.at(-1)))).toEqual({
        audio: "AQIDBA==",
        type: "session.input_audio_buffer.append",
      });
    });
    expect(client.sent.map(String).join(" ")).toContain("input_audio_ack");
    expect(client.sent.map(String).join(" ")).toContain('"bytes_received":4');

    client.dispatchEvent(new MessageEvent("message", {
      data: new ArrayBuffer(64 * 1024 + 1),
    }));
    expect(client.sent.map(String).join(" ")).toContain("audio_frame_too_large");

    client.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ kind: "close_session" }),
    }));
    await vi.waitFor(() => {
      expect(JSON.parse(String(upstream.sent.at(-1)))).toEqual({ type: "session.close" });
    });

    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({
        delta: "hello",
        type: "session.input_transcript.delta",
      }),
    }));
    expect(client.sent.map(String).join(" ")).toContain("source_delta");

    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({
        delta: "AQID",
        type: "session.output_audio.delta",
      }),
    }));
    expect(client.sent.at(-1)).toBeInstanceOf(ArrayBuffer);

    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ type: "session.closed" }),
    }));
    expect(client.closeCalls).toContainEqual({
      code: 1000,
      reason: "session_closed",
    });
  });

  it("closes the peer socket on transport shutdown", async () => {
    const { client, upstream } = await openTestRealtimeSession({ name: "transport" });

    upstream.dispatchEvent(new Event("error"));
    expect(client.sent.map(String).join(" ")).toContain("provider_transport_error");

    const { client: secondClient, upstream: secondUpstream } =
      await openTestRealtimeSession({ name: "transport_second" });
    secondClient.dispatchEvent(new Event("close"));
    expect(secondUpstream.closeCalls).toContainEqual({
      code: 1000,
      reason: "client_close",
    });

    const { client: thirdClient, upstream: thirdUpstream } =
      await openTestRealtimeSession({ name: "transport_third" });
    thirdUpstream.dispatchEvent(new Event("close"));
    expect(thirdClient.sent.map(String).join(" ")).toContain("provider_transport_closed");
    expect(thirdClient.closeCalls).toContainEqual({
      code: 1011,
      reason: "provider_transport_closed",
    });
  });
});
