import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Env } from "../env";
import type { InsightSessionContext } from "../insights/sessionInsights";

type InsightCollector = ReturnType<typeof import("../insights/sessionInsights").createInsightCollector>;

const providerMocks = vi.hoisted(() => ({
  openTranslationSocket: vi.fn(),
}));

const insightMocks = vi.hoisted(() => ({
  createInsightCollector: vi.fn<() => InsightCollector>(),
  loadInsightSession: vi.fn<(env: Env, appSessionId: string) => Promise<InsightSessionContext | null>>(),
}));

vi.mock("../providers/openaiRealtime", async (importOriginal) => ({
  ...await importOriginal<typeof import("../providers/openaiRealtime")>(),
  openTranslationSocket: providerMocks.openTranslationSocket,
}));

vi.mock("../insights/sessionInsights", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../insights/sessionInsights")>();
  return {
    ...actual,
    createInsightCollector: insightMocks.createInsightCollector,
    loadInsightSession: insightMocks.loadInsightSession,
  };
});

const telemetryMocks = vi.hoisted(() => ({
  queuePostHogEvent: vi.fn<(params: { payload: { event: string } }) => void>(),
}));

vi.mock("../observability/posthog", async (importOriginal) => ({
  ...await importOriginal<typeof import("../observability/posthog")>(),
  queuePostHogEvent: telemetryMocks.queuePostHogEvent,
}));

import type { WorkerWebSocket } from "../http/response";
import { createSessionRecordDurable } from "../rateLimitDurableObject";
import {
  hasMeaningfulPcm16Audio,
  isAcceptedAudioFrame,
  parseClientCommand,
  proxyRealtimeSession,
} from "./realtime";
import { posthogFlagsBody } from "../posthogFlagsFixture";

// cspell:ignore AQID AQIDBA

class FakeSocket extends EventTarget {
  binaryType = "blob";
  closeCalls: Array<{ code?: number; reason?: string }> = [];
  readyState = 1;
  sent: unknown[] = [];
  stayOpenOnClose = false;
  throwOnClose = false;

  accept(): void {}

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    if (!this.stayOpenOnClose) {
      this.readyState = 3;
    }
    if (this.throwOnClose) {
      throw new Error("socket close failed");
    }
  }

  send(value: unknown): void {
    this.sent.push(value);
  }
}

async function openTestRealtimeSession(params: {
  env?: Parameters<typeof proxyRealtimeSession>[2];
  hashedInstallId?: string;
  name: string;
  playbackEnabled?: boolean;
  targetLanguage?: string;
}): Promise<{ appSessionId: string; client: FakeSocket; upstream: FakeSocket }> {
  const appSessionId = `session_${params.name}_${crypto.randomUUID()}`;
  await createSessionRecordDurable({
    app_session_id: appSessionId,
    hashed_install_id: params.hashedInstallId ?? "install_hash",
    now_ms: Date.now(),
  });
  const client = new FakeSocket();
  const upstream = new FakeSocket();
  providerMocks.openTranslationSocket.mockResolvedValueOnce(
    upstream as unknown as WorkerWebSocket,
  );
  await proxyRealtimeSession(
    new Request(
      `https://worker.test/v2/realtime?app_session_id=${appSessionId}&target_language=${params.targetLanguage ?? "ar"}&analytics_enabled=true&playback_enabled=${params.playbackEnabled ?? true}`,
    ),
    client as unknown as WorkerWebSocket,
    params.env ?? { OPENAI_API_KEY: "test_key" },
  );
  return { appSessionId, client, upstream };
}

describe("app-facing realtime socket", () => {
  beforeEach(() => {
    providerMocks.openTranslationSocket.mockReset();
    telemetryMocks.queuePostHogEvent.mockReset();
    insightMocks.createInsightCollector.mockReset();
    insightMocks.loadInsightSession.mockReset().mockResolvedValue(null);
    vi.stubGlobal("WebSocket", { CONNECTING: 0, OPEN: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("accepts close and typed playback commands", () => {
    expect(parseClientCommand(JSON.stringify({ kind: "close_session" }))).toEqual({
      kind: "close_session",
    });
    expect(parseClientCommand(JSON.stringify({ kind: "provider_command" }))).toBeNull();
    expect(parseClientCommand(JSON.stringify({ kind: "set_playback", enabled: false }))).toEqual({
      kind: "set_playback",
      enabled: false,
    });
    expect(parseClientCommand(JSON.stringify({ kind: "set_playback", enabled: "false" }))).toBeNull();
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

  it("distinguishes meaningful PCM from silence", () => {
    expect(hasMeaningfulPcm16Audio(new Int16Array([0, 0, 0, 0]).buffer)).toBe(false);
    expect(hasMeaningfulPcm16Audio(new Int16Array([1, -1, 2, -2]).buffer)).toBe(false);
    expect(hasMeaningfulPcm16Audio(new Int16Array([2_000, -2_000]).buffer)).toBe(true);
  });

  it("does not create or feed an insight collector without session insight consent", async () => {
    const { upstream } = await openTestRealtimeSession({ name: "insights_not_consented" });

    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ delta: "private translated words", type: "session.output_transcript.delta" }),
    }));

    expect(insightMocks.createInsightCollector).not.toHaveBeenCalled();
  });

  it("collects translated deltas when the session insight context confirms consent", async () => {
    const insightSession: InsightSessionContext = {
      appSessionId: "consented-session",
      createdAt: "2026-09-23T00:00:00.000Z",
      customerId: null,
      hashedInstallId: "install_hash",
      sourceLanguage: "en",
      targetLanguage: "ar",
    };
    const addDelta = vi.fn<(delta: string, nowMs?: number) => void>();
    const collector: InsightCollector = {
      add: addDelta,
      finish: vi.fn(() => null),
    };
    insightMocks.loadInsightSession.mockImplementation(async (_env, appSessionId) => ({
      ...insightSession,
      appSessionId,
    }));
    insightMocks.createInsightCollector.mockReturnValue(collector);
    const { upstream } = await openTestRealtimeSession({ name: "insights_consented" });

    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ delta: "consented translated words", type: "session.output_transcript.delta" }),
    }));

    expect(insightMocks.createInsightCollector).toHaveBeenCalledOnce();
    expect(addDelta).toHaveBeenCalledWith("consented translated words");
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

  it("aborts a stalled provider handshake before the session can linger", async () => {
    vi.useFakeTimers();
    const appSessionId = `session_handshake_${crypto.randomUUID()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: "install_hash",
      now_ms: Date.now(),
    });
    providerMocks.openTranslationSocket.mockImplementationOnce(
      ({ signal }: { signal: AbortSignal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason));
      }),
    );
    const client = new FakeSocket();
    const proxy = proxyRealtimeSession(
      new Request(
        `https://worker.test/v2/realtime?app_session_id=${appSessionId}&target_language=ar`,
      ),
      client as unknown as WorkerWebSocket,
      { OPENAI_API_KEY: "test_key" },
    );

    await vi.advanceTimersByTimeAsync(15_000);
    await proxy;

    expect(client.sent.map(String).join(" ")).toContain("provider_connection_timeout");
    expect(client.closeCalls).toContainEqual({
      code: 1011,
      reason: "provider_connection_timeout",
    });
  });

  it("closes a provider socket that arrives after the client has gone", async () => {
    let releaseProvider = (_socket: WorkerWebSocket): void => {
      throw new Error("provider handshake was not initialized");
    };
    const provider = new Promise<WorkerWebSocket>((resolve) => {
      releaseProvider = resolve;
    });
    const appSessionId = `session_late_provider_${crypto.randomUUID()}`;
    await createSessionRecordDurable({
      app_session_id: appSessionId,
      hashed_install_id: "install_hash",
      now_ms: Date.now(),
    });
    providerMocks.openTranslationSocket.mockReturnValueOnce(provider);
    const client = new FakeSocket();
    const proxy = proxyRealtimeSession(
      new Request(
        `https://worker.test/v2/realtime?app_session_id=${appSessionId}&target_language=ar`,
      ),
      client as unknown as WorkerWebSocket,
      { OPENAI_API_KEY: "test_key" },
    );
    await vi.waitFor(() => expect(providerMocks.openTranslationSocket).toHaveBeenCalledOnce());
    client.dispatchEvent(new Event("close"));
    const upstream = new FakeSocket();
    releaseProvider(upstream as unknown as WorkerWebSocket);
    await proxy;

    expect(upstream.closeCalls).toContainEqual({
      code: 1000,
      reason: "session_already_terminated",
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
    for (let elapsedMs = 0; elapsedMs < 300_000; elapsedMs += 100_000) {
      client.dispatchEvent(new MessageEvent("message", {
        data: new Int16Array([2_000, -2_000]).buffer,
      }));
      await vi.advanceTimersByTimeAsync(100_000);
    }

    expect(client.sent.map(String).join(" ")).toContain("session_expired");
    expect(client.closeCalls).toContainEqual({ code: 1008, reason: "session_expired" });
    expect(upstream.closeCalls).toContainEqual({ code: 1008, reason: "session_expired" });
  });

  it("closes silent sessions after 120 seconds even when silent PCM continues", async () => {
    vi.useFakeTimers();
    const { client, upstream } = await openTestRealtimeSession({ name: "silence" });
    for (let elapsedMs = 0; elapsedMs < 120_000; elapsedMs += 30_000) {
      client.dispatchEvent(new MessageEvent("message", {
        data: new Int16Array([0, 0, 0, 0]).buffer,
      }));
      await vi.advanceTimersByTimeAsync(30_000);
    }

    expect(client.sent.map(String).join(" ")).toContain("session_silence_timeout");
    expect(client.closeCalls).toContainEqual({
      code: 1008,
      reason: "session_silence_timeout",
    });
    expect(upstream.closeCalls).toContainEqual({
      code: 1008,
      reason: "session_silence_timeout",
    });
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
      signal: expect.any(AbortSignal),
    });
    expect(JSON.parse(String(upstream.sent[0]))).toMatchObject({
      session: {
        audio: {
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
    expect(upstream.closeCalls).toContainEqual({
      code: 1000,
      reason: "client_close_session",
    });
  });

  it("forwards provider output and physically closes upstream on provider completion", async () => {
    const { client, upstream } = await openTestRealtimeSession({ name: "provider_complete" });
    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ delta: "hello", type: "session.input_transcript.delta" }),
    }));
    expect(client.sent.map(String).join(" ")).not.toContain("source_delta");
    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ delta: "AQID", type: "session.output_audio.delta" }),
    }));
    expect(client.sent.at(-1)).toBeInstanceOf(ArrayBuffer);
    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ type: "session.closed" }),
    }));
    expect(upstream.closeCalls).toContainEqual({
      code: 1000,
      reason: "provider_session_closed",
    });
    expect(client.closeCalls).toContainEqual({
      code: 1000,
      reason: "provider_session_closed",
    });
  });

  it("enables and forwards source transcription when the server flag is on", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(posthogFlagsBody({
      featureFlags: { source_transcript: true },
    }))));
    const { client, upstream } = await openTestRealtimeSession({
      env: { OPENAI_API_KEY: "test_key", POSTHOG_PROJECT_TOKEN: "test-token" },
      hashedInstallId: "install_hash_source_flag_on",
      name: "source_flag_on",
    });
    expect(JSON.parse(String(upstream.sent[0]))).toMatchObject({
      session: { audio: { input: { transcription: { model: "gpt-realtime-whisper" } } } },
    });
    const sourceEvent = new MessageEvent("message", {
      data: JSON.stringify({ delta: "hello", type: "session.input_transcript.delta" }),
    });
    upstream.dispatchEvent(sourceEvent);
    expect(client.sent).toContainEqual(expect.stringContaining('"kind":"source_delta"'));
  });

  it("suppresses translated audio until playback is re-enabled without suppressing text", async () => {
    const { client, upstream } = await openTestRealtimeSession({
      name: "playback_off",
      playbackEnabled: false,
    });
    const audio = JSON.stringify({ delta: "AQID", type: "session.output_audio.delta" });
    upstream.dispatchEvent(new MessageEvent("message", { data: audio }));
    expect(client.sent.some((item) => item instanceof ArrayBuffer)).toBe(false);

    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ delta: "hello", type: "session.output_transcript.delta" }),
    }));
    expect(client.sent.map(String).join(" ")).toContain("translation_delta");

    client.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ kind: "set_playback", enabled: true }),
    }));
    upstream.dispatchEvent(new MessageEvent("message", { data: audio }));
    expect(client.sent.at(-1)).toBeInstanceOf(ArrayBuffer);
  });

  it("suppresses translated audio when the server output-audio flag is off", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(posthogFlagsBody({
      featureFlags: { output_audio_enabled: true },
      featureFlagPayloads: { output_audio_enabled: "false" },
    }))));
    const { client, upstream } = await openTestRealtimeSession({
      env: { OPENAI_API_KEY: "test_key", POSTHOG_PROJECT_TOKEN: "test-token" },
      hashedInstallId: "install_hash_server_audio_off",
      name: "server_audio_off",
    });
    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ delta: "AQID", type: "session.output_audio.delta" }),
    }));
    expect(client.sent.some((item) => item instanceof ArrayBuffer)).toBe(false);
  });

  it("closes the client even when closing the provider socket throws", async () => {
    const { client, upstream } = await openTestRealtimeSession({ name: "close_failure" });
    upstream.throwOnClose = true;
    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ type: "session.closed" }),
    }));

    expect(client.closeCalls).toContainEqual({
      code: 1000,
      reason: "provider_session_closed",
    });
  });

  it("classifies malformed provider output as a provider failure", async () => {
    const { client, upstream } = await openTestRealtimeSession({ name: "invalid_output" });
    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ delta: "%%%", type: "session.output_audio.delta" }),
    }));

    expect(client.sent.map(String).join(" ")).toContain("provider_output_invalid");
    expect(client.sent.map(String).join(" ")).not.toContain("client_transport_error");
    expect(upstream.closeCalls).toContainEqual({
      code: 1011,
      reason: "provider_output_invalid",
    });
    expect(client.closeCalls).toContainEqual({
      code: 1011,
      reason: "provider_output_invalid",
    });
  });

  it("does not forward queued audio after termination even if provider close fails", async () => {
    const { client, upstream } = await openTestRealtimeSession({ name: "late_audio" });
    upstream.stayOpenOnClose = true;
    upstream.throwOnClose = true;

    client.dispatchEvent(new Event("close"));
    client.dispatchEvent(new MessageEvent("message", {
      data: new Uint8Array(960).buffer,
    }));
    await Promise.resolve();

    expect(upstream.sent.map(String).join(" ")).not.toContain("input_audio_buffer.append");
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
      reason: "client_transport_closed",
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

  it("classifies client-requested closes as completed and carries the close reason", async () => {
    const { client } = await openTestRealtimeSession({ name: "client_clean_close" });
    client.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ kind: "close_session" }),
    }));
    client.dispatchEvent(new Event("close"));

    expect(sessionEndedEvents()).toContainEqual(expect.objectContaining({
      close_reason: "client_close_session",
      failure_code: null,
      outcome: "completed",
    }));
  });

  it("keeps a client transport close that was not requested a failure", async () => {
    const { client } = await openTestRealtimeSession({ name: "client_dropped" });
    client.dispatchEvent(new Event("close"));

    expect(sessionEndedEvents()).toContainEqual(expect.objectContaining({
      close_reason: "client_transport_closed",
      failure_code: "client_transport_closed",
      outcome: "failed",
    }));
  });

  it("records the provider close reason when the provider ends the session", async () => {
    const { upstream } = await openTestRealtimeSession({ name: "provider_close_reason" });
    upstream.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify({ reason: "Max Duration Reached", type: "session.closed" }),
    }));

    expect(sessionEndedEvents()).toContainEqual(expect.objectContaining({
      close_reason: "max_duration_reached",
      outcome: "completed",
    }));
  });
});

function sessionEndedEvents(): { event: string }[] {
  return telemetryMocks.queuePostHogEvent.mock.calls
    .map(([params]) => params.payload)
    .filter((payload) => payload.event === "worker_session_ended");
}
