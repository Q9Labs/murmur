import MurmurAudioModule from "../../modules/murmur-audio";
import type { LanguageDefinition } from "../languages";

export type CartesiaSpeechOptions = {
  accessToken: string;
  language: LanguageDefinition;
  onSpeechUnavailable: (reason: string) => void;
  voiceId: string;
};

export class CartesiaSpeechClient {
  private socket: WebSocket | null = null;
  private contextId: string | null = null;
  private pendingPayloads: unknown[] = [];

  constructor(private readonly options: CartesiaSpeechOptions) {}

  connect(): void {
    if (this.socket) {
      return;
    }
    const NativeWebSocket = WebSocket as unknown as {
      new (
        url: string,
        protocols?: string | string[],
        options?: { headers?: Record<string, string> },
      ): WebSocket;
    };
    const socket = new NativeWebSocket("wss://api.cartesia.ai/tts/websocket", undefined, {
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        "Cartesia-Version": "2026-03-01",
      },
    });
    socket.binaryType = "arraybuffer";
    socket.onopen = () => {
      this.flushPendingPayloads();
    };
    socket.onerror = () => this.options.onSpeechUnavailable("cartesia_socket_error");
    socket.onclose = () => {
      this.socket = null;
    };
    socket.onmessage = (event) => {
      void this.handleMessage(event.data);
    };
    this.socket = socket;
  }

  speak(text: string): string {
    const contextId = createContextId();
    this.contextId = contextId;
    this.connect();
    this.send({
      context_id: contextId,
      model_id: "sonic-3.5",
      transcript: text,
      voice: {
        mode: "id",
        id: this.options.voiceId,
      },
      language: this.options.language.cartesia_language,
      output_format: {
        container: "raw",
        encoding: "pcm_s16le",
        sample_rate: 16000,
      },
      continue: false,
    });
    return contextId;
  }

  cancel(reason: string): void {
    this.contextId = null;
    this.pendingPayloads = [];
    void MurmurAudioModule.clearPlayback(reason);
  }

  close(): void {
    this.cancel("cartesia_close");
    this.pendingPayloads = [];
    this.socket?.close(1000, "client_close");
    this.socket = null;
  }

  private async handleMessage(data: string | ArrayBuffer): Promise<void> {
    if (!this.contextId) {
      return;
    }

    if (typeof data !== "string") {
      await MurmurAudioModule.enqueuePcm16(new Uint8Array(data));
      return;
    }

    const parsed = safeJsonParse(data);
    if (!parsed) {
      this.options.onSpeechUnavailable("cartesia_invalid_message");
      return;
    }

    const message = parsed as {
      context_id?: string;
      data?: string;
      error?: string;
      type?: string;
    };
    if (message.context_id && message.context_id !== this.contextId) {
      return;
    }
    if (message.error) {
      this.options.onSpeechUnavailable(message.error);
      return;
    }
    if (message.data && this.contextId) {
      await MurmurAudioModule.enqueuePcm16(base64ToUint8Array(message.data));
    }
  }

  private send(payload: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else {
      this.pendingPayloads.push(payload);
    }
  }

  private flushPendingPayloads(): void {
    const pendingPayloads = this.pendingPayloads;
    this.pendingPayloads = [];
    for (const payload of pendingPayloads) {
      this.send(payload);
    }
  }
}

function base64ToUint8Array(value: string): Uint8Array {
  const decoded = globalThis.atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function createContextId(): string {
  return `speech_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
