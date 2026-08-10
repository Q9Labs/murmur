import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../modules/murmur-audio", () => ({
  default: {
    enqueuePcm16: vi.fn(),
  },
}));

import MurmurAudioModule from "../../../modules/murmur-audio";
import {
  parseServerEvent,
  createRealtimeTranslationClient,
} from "./realtimeTranslation";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  binaryType = "";
  bufferedAmount = 0;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onopen: (() => void) | null = null;
  readyState = MockWebSocket.OPEN;
  sent: unknown[] = [];

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  send(value: unknown): void {
    this.sent.push(value);
  }
}

describe("RealtimeTranslationClient", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.clearAllMocks();
  });

  it("streams raw audio and an app-facing finish command", () => {
    const client = createRealtimeTranslationClient({
      onEvent: vi.fn(),
      url: "wss://worker.test/v2/realtime",
    });
    client.connect();
    client.sendAudio(new Uint8Array([1, 2]));
    client.finish();

    expect(MockWebSocket.instances[0]?.sent).toEqual([
      new Uint8Array([1, 2]),
      JSON.stringify({ kind: "close_session" }),
    ]);
  });

  it("batches ten 20 ms PCM frames into one 200 ms chunk", () => {
    const client = createRealtimeTranslationClient({
      onEvent: vi.fn(),
      url: "wss://worker.test/v2/realtime",
    });
    client.connect();
    for (let index = 0; index < 10; index += 1) {
      client.sendAudio(new Uint8Array(960).fill(index));
    }

    const socket = MockWebSocket.instances[0];
    expect(socket?.sent).toHaveLength(1);
    expect(socket?.sent[0]).toBeInstanceOf(Uint8Array);
    expect((socket?.sent[0] as Uint8Array).byteLength).toBe(9_600);
    expect(client.getDiagnostics()).toMatchObject({
      input_buffered_bytes: 0,
      input_bytes_received: 9_600,
      input_bytes_sent: 9_600,
      input_chunk_target_bytes: 9_600,
      input_chunks_sent: 1,
      input_frames_received: 10,
      input_partial_chunks_sent: 0,
    });
  });

  it("plays translated PCM and emits normalized transcript events", async () => {
    const onEvent = vi.fn();
    const client = createRealtimeTranslationClient({
      onEvent,
      url: "wss://worker.test/v2/realtime",
    });
    client.connect();
    const socket = MockWebSocket.instances[0];
    socket?.onmessage?.({ data: new Uint8Array([3, 4]).buffer });
    socket?.onmessage?.({
      data: JSON.stringify({
        delta: "hello",
        kind: "source_delta",
        provider_elapsed_ms: 1_200,
        provider_event_id: "event_source",
      }),
    });
    socket?.onmessage?.({
      data: JSON.stringify({
        bytes_received: 9_600,
        chunk_seq: 1,
        kind: "input_audio_ack",
        worker_received_at_ms: 2_000,
      }),
    });
    await vi.waitFor(() => {
      expect(MurmurAudioModule.enqueuePcm16).toHaveBeenCalledWith(new Uint8Array([3, 4]));
    });
    expect(onEvent).toHaveBeenCalledWith({
      delta: "hello",
      kind: "source_delta",
      provider_elapsed_ms: 1_200,
      provider_event_id: "event_source",
    });
    expect(client.getDiagnostics()).toMatchObject({
      last_provider_source_elapsed_ms: 1_200,
      last_provider_source_event_id: "event_source",
      output_audio_bytes_received: 2,
      output_audio_chunks_received: 1,
      output_playback_enqueues: 1,
      provider_source_delta_count: 1,
      worker_audio_bytes_received: 9_600,
      worker_audio_chunks_received: 1,
    });
  });

  it("keeps translated audio off while still receiving transcript events", async () => {
    const onEvent = vi.fn();
    const client = createRealtimeTranslationClient({
      onEvent,
      shouldPlayAudio: () => false,
      url: "wss://worker.test/v2/realtime",
    });
    client.connect();
    const socket = MockWebSocket.instances[0];
    socket?.onmessage?.({ data: new Uint8Array([3, 4]).buffer });
    socket?.onmessage?.({
      data: JSON.stringify({ delta: "hello", kind: "translation_delta" }),
    });

    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith({ delta: "hello", kind: "translation_delta" });
    });
    expect(MurmurAudioModule.enqueuePcm16).not.toHaveBeenCalled();
    expect(client.getDiagnostics()).toMatchObject({
      output_audio_chunks_received: 1,
      output_audio_chunks_skipped_playback_disabled: 1,
      output_playback_enqueues: 0,
    });
  });

  it("keeps the transport live when translated playback fails", async () => {
    vi.mocked(MurmurAudioModule.enqueuePcm16).mockRejectedValueOnce(
      new Error("playback failed"),
    );
    const onEvent = vi.fn();
    const client = createRealtimeTranslationClient({
      onEvent,
      url: "wss://worker.test/v2/realtime",
    });
    client.connect();
    MockWebSocket.instances[0]?.onmessage?.({ data: new Uint8Array([3, 4]).buffer });

    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith({ kind: "playback_error" });
    });
    expect(client.getDiagnostics()).toMatchObject({
      output_playback_enqueue_failures: 1,
      socket_transport_errors: 0,
    });
  });

  it("preserves buffered input while translated playback arrives", async () => {
    const client = createRealtimeTranslationClient({
      onEvent: vi.fn(),
      url: "wss://worker.test/v2/realtime",
    });
    client.connect();
    const socket = MockWebSocket.instances[0];
    for (let index = 0; index < 5; index += 1) {
      client.sendAudio(new Uint8Array(960).fill(index));
    }
    socket?.onmessage?.({ data: new Uint8Array([7, 8]).buffer });
    for (let index = 5; index < 11; index += 1) {
      client.sendAudio(new Uint8Array(960).fill(index));
    }
    client.finish();

    await vi.waitFor(() => {
      expect(MurmurAudioModule.enqueuePcm16).toHaveBeenCalledWith(new Uint8Array([7, 8]));
    });
    expect(socket?.sent).toHaveLength(3);
    const fullChunk = socket?.sent[0] as Uint8Array;
    const tailChunk = socket?.sent[1] as Uint8Array;
    expect(fullChunk.byteLength).toBe(9_600);
    expect(Array.from(fullChunk.slice(0, 2))).toEqual([0, 0]);
    expect(Array.from(fullChunk.slice(-2))).toEqual([9, 9]);
    expect(tailChunk).toEqual(new Uint8Array(960).fill(10));
    expect(socket?.sent[2]).toBe(JSON.stringify({ kind: "close_session" }));
    expect(client.getDiagnostics()).toMatchObject({
      input_bytes_sent: 10_560,
      input_chunks_sent: 2,
      input_partial_chunks_sent: 1,
      output_playback_enqueues: 1,
    });
  });

  it("queues translated audio in arrival order", async () => {
    let releaseFirst: (() => void) | undefined;
    vi.mocked(MurmurAudioModule.enqueuePcm16)
      .mockImplementationOnce(() => new Promise<Record<string, unknown>>((resolve) => {
        releaseFirst = () => resolve({});
      }))
      .mockResolvedValueOnce({});
    const client = createRealtimeTranslationClient({
      onEvent: vi.fn(),
      url: "wss://worker.test/v2/realtime",
    });
    client.connect();
    const socket = MockWebSocket.instances[0];
    socket?.onmessage?.({ data: new Uint8Array([1]).buffer });
    socket?.onmessage?.({ data: new Uint8Array([2]).buffer });

    await vi.waitFor(() => {
      expect(MurmurAudioModule.enqueuePcm16).toHaveBeenCalledTimes(1);
    });
    releaseFirst?.();
    await vi.waitFor(() => {
      expect(MurmurAudioModule.enqueuePcm16).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(MurmurAudioModule.enqueuePcm16).mock.calls).toEqual([
      [new Uint8Array([1])],
      [new Uint8Array([2])],
    ]);
  });

  it("rejects malformed server events", () => {
    expect(parseServerEvent("not-json")).toBeNull();
    expect(parseServerEvent(JSON.stringify({ kind: "source_delta", delta: 42 }))).toBeNull();
  });
});
