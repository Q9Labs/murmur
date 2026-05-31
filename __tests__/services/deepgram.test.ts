import { DeepgramService, type DeepgramCallbacks } from "@/services/deepgram";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  send = jest.fn();
  close = jest.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000, reason: reason ?? "" } as CloseEvent);
  });

  constructor(
    readonly url: string,
    readonly protocols?: string | string[],
  ) {
    MockWebSocket.instances.push(this);
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
}

const createCallbacks = (): DeepgramCallbacks => ({
  onTranscript: jest.fn(),
  onSpeechFinal: jest.fn(),
  onUtteranceEnd: jest.fn(),
  onSpeakingChange: jest.fn(),
  onReconnecting: jest.fn(),
  onError: jest.fn(),
});

describe("DeepgramService lifecycle", () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    MockWebSocket.instances = [];
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    global.WebSocket = originalWebSocket;
  });

  it("can start again after stop marks the service destroyed", async () => {
    const service = new DeepgramService("test-api-key");
    const callbacks = createCallbacks();

    const firstStart = service.startStreaming(callbacks);
    const firstSocket = MockWebSocket.instances[0];
    firstSocket.open();
    await expect(firstStart).resolves.toBe(firstSocket);

    expect(service.isAlive()).toBe(true);

    service.stop();

    expect(service.isAlive()).toBe(false);

    const secondStart = service.startStreaming(callbacks);
    const secondSocket = MockWebSocket.instances[1];
    secondSocket.open();
    await expect(secondStart).resolves.toBe(secondSocket);

    expect(service.isAlive()).toBe(true);

    const audioData = new ArrayBuffer(4);
    service.sendAudio(audioData);

    expect(secondSocket.send).toHaveBeenCalledWith(audioData);

    service.stop();
  });

  it("does not reconnect from close events fired by an explicit stop", async () => {
    const service = new DeepgramService("test-api-key");
    const callbacks = createCallbacks();

    const start = service.startStreaming(callbacks);
    const socket = MockWebSocket.instances[0];
    socket.open();
    await start;

    service.stop();
    socket.onclose?.({ code: 1006, reason: "network gone" } as CloseEvent);
    jest.runOnlyPendingTimers();

    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
