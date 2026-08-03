import type { RealtimeServerEvent } from "@murmur/protocol/transport/types";

import MurmurAudioModule from "../../../modules/murmur-audio";

export type RealtimeTranslationClientEvent =
  | RealtimeServerEvent
  | { kind: "transport_closed" }
  | { kind: "transport_error" };

export type RealtimeTranslationClient = {
  close: (reason?: string) => void;
  connect: () => void;
  finish: () => void;
  sendAudio: (data: Uint8Array) => void;
};

export function createRealtimeTranslationClient(options: {
  onEvent: (event: RealtimeTranslationClientEvent) => void;
  url: string;
}): RealtimeTranslationClient {
  let socket: WebSocket | null = null;

  return {
    close(reason = "client_close"): void {
      const activeSocket = socket;
      socket = null;
      if (
        activeSocket?.readyState === WebSocket.OPEN ||
        activeSocket?.readyState === WebSocket.CONNECTING
      ) {
        activeSocket.close(1000, reason);
      }
    },
    connect(): void {
      if (socket) {
        return;
      }
      const nextSocket = new WebSocket(options.url);
      nextSocket.binaryType = "arraybuffer";
      nextSocket.onmessage = (event) => {
        void receive(event.data, options.onEvent).catch(() => {
          options.onEvent({ kind: "transport_error" });
        });
      };
      nextSocket.onerror = () => {
        options.onEvent({ kind: "transport_error" });
      };
      nextSocket.onclose = () => {
        socket = null;
        options.onEvent({ kind: "transport_closed" });
      };
      socket = nextSocket;
    },
    finish(): void {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ kind: "close_session" }));
      }
    },
    sendAudio(data: Uint8Array): void {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    },
  };
}

export function parseServerEvent(data: unknown): RealtimeServerEvent | null {
  if (typeof data !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (parsed.kind === "session_opened" && isRecord(parsed.provider_metadata)) {
      return { kind: "session_opened", provider_metadata: parsed.provider_metadata };
    }
    if (
      (parsed.kind === "source_delta" || parsed.kind === "translation_delta") &&
      typeof parsed.delta === "string"
    ) {
      return { delta: parsed.delta, kind: parsed.kind };
    }
    if (parsed.kind === "session_closed") {
      return { kind: "session_closed" };
    }
    if (
      parsed.kind === "session_error" &&
      typeof parsed.code === "string" &&
      typeof parsed.retryable === "boolean"
    ) {
      return {
        code: parsed.code,
        kind: "session_error",
        retryable: parsed.retryable,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function receive(
  data: unknown,
  onEvent: (event: RealtimeTranslationClientEvent) => void,
): Promise<void> {
  const audio = await readAudio(data);
  if (audio) {
    await MurmurAudioModule.enqueuePcm16(audio);
    return;
  }
  const event = parseServerEvent(data);
  if (event) {
    onEvent(event);
  }
}

async function readAudio(data: unknown): Promise<Uint8Array | null> {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
