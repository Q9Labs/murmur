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
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
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

  it("streams raw audio and a provider-neutral finish command", () => {
    const client = createRealtimeTranslationClient({
      onEvent: vi.fn(),
      url: "wss://worker.test/v1/realtime",
    });
    client.connect();
    client.sendAudio(new Uint8Array([1, 2]));
    client.finish();

    expect(MockWebSocket.instances[0]?.sent).toEqual([
      new Uint8Array([1, 2]),
      JSON.stringify({ kind: "close_session" }),
    ]);
  });

  it("plays translated PCM and emits normalized transcript events", async () => {
    const onEvent = vi.fn();
    const client = createRealtimeTranslationClient({
      onEvent,
      url: "wss://worker.test/v1/realtime",
    });
    client.connect();
    const socket = MockWebSocket.instances[0];
    socket?.onmessage?.({ data: new Uint8Array([3, 4]).buffer });
    socket?.onmessage?.({
      data: JSON.stringify({ delta: "hello", kind: "source_delta" }),
    });
    await vi.waitFor(() => {
      expect(MurmurAudioModule.enqueuePcm16).toHaveBeenCalledWith(new Uint8Array([3, 4]));
    });
    expect(onEvent).toHaveBeenCalledWith({ delta: "hello", kind: "source_delta" });
  });

  it("rejects malformed server events", () => {
    expect(parseServerEvent("not-json")).toBeNull();
    expect(parseServerEvent(JSON.stringify({ kind: "source_delta", delta: 42 }))).toBeNull();
  });
});
