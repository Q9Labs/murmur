import { afterEach, describe, expect, it, vi } from "vitest";

import { getLanguage } from "../languages";
import type { TranslationRequest } from "../transport/types";

vi.mock("../../modules/murmur-audio", () => ({
  default: {
    clearPlayback: vi.fn(),
    enqueuePcm16: vi.fn(),
  },
}));

import MurmurAudioModule from "../../modules/murmur-audio";

type MessageHandler = ((event: { data: string | ArrayBuffer }) => void) | null;
type OpenHandler = (() => void) | null;
type CloseHandler = (() => void) | null;
type ErrorHandler = (() => void) | null;

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  binaryType = "";
  bufferedAmount = 0;
  onclose: CloseHandler = null;
  onerror: ErrorHandler = null;
  onmessage: MessageHandler = null;
  onopen: OpenHandler = null;
  readyState = FakeWebSocket.CONNECTING;
  sent: any[] = [];

  constructor(
    readonly url: string,
    readonly protocols?: string | string[],
    readonly options?: { headers?: Record<string, string> },
  ) {
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  send(payload: string | ArrayBuffer): void {
    this.sent.push(payload);
  }
}

describe("realtime provider clients", () => {
  const originalWebSocket = globalThis.WebSocket;

  afterEach(() => {
    FakeWebSocket.instances = [];
    globalThis.WebSocket = originalWebSocket;
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("queues Cartesia speech payloads until the socket opens", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { CartesiaSpeechClient } = await import("./cartesia");
    const speechUnavailable = vi.fn();
    const client = new CartesiaSpeechClient({
      accessToken: "cartesia_token",
      language: getLanguage("ar"),
      onSpeechUnavailable: speechUnavailable,
      voiceId: "voice_ar",
    });

    const requestId = client.speak("مرحبا");
    const socket = FakeWebSocket.instances[0];

    expect(requestId).toMatch(/^speech_/);
    expect(socket.sent).toEqual([]);
    expect(speechUnavailable).not.toHaveBeenCalledWith("cartesia_not_open");

    socket.open();

    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      context_id: requestId,
      language: "ar",
      model_id: "sonic-3.5",
      transcript: "مرحبا",
      voice: {
        id: "voice_ar",
        mode: "id",
      },
    });
  });

  it("drops queued Cartesia speech payloads when canceled before open", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { CartesiaSpeechClient } = await import("./cartesia");
    const client = new CartesiaSpeechClient({
      accessToken: "cartesia_token",
      language: getLanguage("ar"),
      onSpeechUnavailable: vi.fn(),
      voiceId: "voice_ar",
    });

    client.speak("مرحبا");
    const socket = FakeWebSocket.instances[0];
    client.cancel("newer_translation");
    socket.open();

    expect(socket.sent).toEqual([]);
  });

  it("drops late Cartesia audio chunks after cancel", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { CartesiaSpeechClient } = await import("./cartesia");
    const client = new CartesiaSpeechClient({
      accessToken: "cartesia_token",
      language: getLanguage("ar"),
      onSpeechUnavailable: vi.fn(),
      voiceId: "voice_ar",
    });

    client.speak("مرحبا");
    const socket = FakeWebSocket.instances[0];
    socket.open();
    client.cancel("user_cancel");
    socket.onmessage?.({ data: JSON.stringify({ data: "AQI=" }) });
    socket.onmessage?.({ data: new Uint8Array([1, 2]).buffer });

    await Promise.resolve();
    expect(MurmurAudioModule.enqueuePcm16).not.toHaveBeenCalled();
  });

  it("plays Cartesia chunks while the context is active", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { CartesiaSpeechClient } = await import("./cartesia");
    const client = new CartesiaSpeechClient({
      accessToken: "cartesia_token",
      language: getLanguage("ar"),
      onSpeechUnavailable: vi.fn(),
      voiceId: "voice_ar",
    });

    client.speak("مرحبا");
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.onmessage?.({ data: JSON.stringify({ data: "AQI=" }) });

    await Promise.resolve();
    expect(MurmurAudioModule.enqueuePcm16).toHaveBeenCalledWith(new Uint8Array([1, 2]));
  });

  it("marks Cartesia speech unavailable for malformed provider messages", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { CartesiaSpeechClient } = await import("./cartesia");
    const speechUnavailable = vi.fn();
    const client = new CartesiaSpeechClient({
      accessToken: "cartesia_token",
      language: getLanguage("ar"),
      onSpeechUnavailable: speechUnavailable,
      voiceId: "voice_ar",
    });

    client.speak("مرحبا");
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.onmessage?.({ data: "not json" });

    await Promise.resolve();
    expect(speechUnavailable).toHaveBeenCalledWith("cartesia_invalid_message");
  });

  it("queues translation requests until the Worker WebSocket opens", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { MurmurTranslationClient } = await import("./translation");
    const status = vi.fn();
    const client = new MurmurTranslationClient({
      onEvent: vi.fn(),
      onStatus: status,
      url: "wss://murmur.test/v1/translate",
    });
    const request: TranslationRequest = {
      app_session_id: "session",
      connection_id: "connection",
      context_spans: [],
      event_seq: 1,
      revision: 1,
      session_epoch: 1,
      source_caption: "hello",
      source_language: "en",
      span_id: "span",
      target_language: "ar",
      translation_attempt: 1,
    };

    client.connect();
    client.translate(request);
    const socket = FakeWebSocket.instances[0];

    expect(socket.sent).toEqual([]);
    socket.open();

    expect(status).toHaveBeenCalledWith("open");
    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      kind: "translate",
      source_caption: "hello",
      target_language: "ar",
    });
  });

  it("drops queued translation payloads when the session stops before open", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { MurmurTranslationClient } = await import("./translation");
    const client = new MurmurTranslationClient({
      onEvent: vi.fn(),
      onStatus: vi.fn(),
      url: "wss://murmur.test/v1/translate",
    });

    client.connect();
    client.translate({
      app_session_id: "session",
      connection_id: "connection",
      context_spans: [],
      event_seq: 1,
      revision: 1,
      session_epoch: 1,
      source_caption: "hello",
      source_language: "en",
      span_id: "span",
      target_language: "ar",
      translation_attempt: 1,
    });
    const socket = FakeWebSocket.instances[0];
    client.stopSession("user_cancel");
    socket.open();

    expect(socket.sent).toEqual([]);
  });

  it("sends session identity before closing an open translation session", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { MurmurTranslationClient } = await import("./translation");
    const client = new MurmurTranslationClient({
      onEvent: vi.fn(),
      onStatus: vi.fn(),
      url: "wss://murmur.test/v1/translate",
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    client.stopSession("user_stop", "session_worker_123");

    expect(JSON.parse(socket.sent[0])).toEqual({
      app_session_id: "session_worker_123",
      kind: "stop_session",
      reason: "user_stop",
    });
  });

  it("sends session identity before closing an open cancelled session", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { MurmurTranslationClient } = await import("./translation");
    const client = new MurmurTranslationClient({
      onEvent: vi.fn(),
      onStatus: vi.fn(),
      url: "wss://murmur.test/v1/translate",
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    client.cancelSession("user_cancel", "session_worker_456");

    expect(JSON.parse(socket.sent[0])).toEqual({
      app_session_id: "session_worker_456",
      kind: "cancel_session",
      reason: "user_cancel",
    });
  });

  it("reports Worker stream parse errors without throwing", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { MurmurTranslationClient } = await import("./translation");
    const status = vi.fn();
    const client = new MurmurTranslationClient({
      onEvent: vi.fn(),
      onStatus: status,
      url: "wss://murmur.test/v1/translate",
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.onmessage?.({ data: "not json" });

    expect(status).toHaveBeenCalledWith("error");
  });

  it("reconnects translation sockets and flushes queued spans after an unexpected close", async () => {
    vi.useFakeTimers();
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { MurmurTranslationClient } = await import("./translation");
    const status = vi.fn();
    const client = new MurmurTranslationClient({
      onEvent: vi.fn(),
      onStatus: status,
      url: "wss://murmur.test/v1/translate",
    });

    client.connect();
    const firstSocket = FakeWebSocket.instances[0];
    firstSocket.open();
    firstSocket.close();

    client.translate({
      app_session_id: "session",
      connection_id: "connection",
      context_spans: [],
      event_seq: 2,
      revision: 1,
      session_epoch: 1,
      source_caption: "still translating",
      source_language: "en",
      span_id: "span_reconnect",
      target_language: "ar",
      translation_attempt: 1,
    });

    expect(status).toHaveBeenCalledWith("reconnecting");
    expect(FakeWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(500);
    const secondSocket = FakeWebSocket.instances[1];
    secondSocket.open();

    expect(secondSocket.sent).toHaveLength(1);
    expect(JSON.parse(secondSocket.sent[0])).toMatchObject({
      kind: "translate",
      source_caption: "still translating",
      span_id: "span_reconnect",
    });
  });

  it("drops Deepgram frames while buffering exceeds the live threshold and resumes after drain", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { DeepgramLiveClient } = await import("./deepgram");
    const events = vi.fn();
    const client = new DeepgramLiveClient({
      language: getLanguage("en"),
      maxBufferedBytes: 640,
      onEvent: events,
      token: "deepgram_token",
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.bufferedAmount = 641;
    client.sendPcm16(new Uint8Array(640));
    client.sendPcm16(new Uint8Array(640));

    expect(events).toHaveBeenCalledWith({ type: "error", reason: "deepgram_backpressure" });
    expect(events).toHaveBeenCalledTimes(2);
    expect(socket.readyState).toBe(FakeWebSocket.OPEN);
    expect(socket.sent).toEqual([]);

    socket.bufferedAmount = 0;
    client.sendPcm16(new Uint8Array([1, 2]));

    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toBeInstanceOf(ArrayBuffer);
  });

  it("emits a Deepgram error for malformed provider messages", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { DeepgramLiveClient } = await import("./deepgram");
    const events = vi.fn();
    const client = new DeepgramLiveClient({
      language: getLanguage("en"),
      onEvent: events,
      token: "deepgram_token",
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.onmessage?.({ data: "not json" });

    expect(events).toHaveBeenCalledWith({
      type: "error",
      reason: "deepgram_invalid_message",
    });
  });

  it("parses Ultravox transcript messages and requests text output", async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const { UltravoxLiveClient } = await import("./ultravox");
    const events: unknown[] = [];
    const client = new UltravoxLiveClient({
      onEvent: (event) => events.push(event),
      url: "wss://ultravox.example/join",
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.onmessage?.({
      data: JSON.stringify({
        delta: "مرحبا",
        final: false,
        ordinal: 1,
        role: "agent",
        type: "transcript",
      }),
    });
    client.sendPcm16(new Uint8Array([1, 2]));

    expect(socket.sent[0]).toEqual(JSON.stringify({ type: "set_output_medium", medium: "text" }));
    expect(socket.sent[1]).toBeInstanceOf(ArrayBuffer);
    expect(events).toEqual([
      { type: "open", reason: "ultravox_open" },
      {
        delta: "مرحبا",
        final: false,
        medium: null,
        ordinal: 1,
        role: "agent",
        text: null,
        type: "transcript",
      },
    ]);
  });
});
