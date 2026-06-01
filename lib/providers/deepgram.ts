import type { LanguageDefinition } from "../languages";

export type DeepgramTranscriptEvent = {
  is_final: boolean;
  speech_final: boolean;
  transcript: string;
  type: "transcript";
};

export type DeepgramStatusEvent = {
  reason: string;
  type: "open" | "close" | "error" | "utterance_end" | "speech_started";
};

export type DeepgramClientEvent = DeepgramTranscriptEvent | DeepgramStatusEvent;

export type DeepgramClientOptions = {
  language?: LanguageDefinition;
  maxBufferedBytes?: number;
  onEvent: (event: DeepgramClientEvent) => void;
  token?: string | null;
  url?: string;
};

const defaultMaxBufferedBytes = 128_000;

export class DeepgramLiveClient {
  private backpressureActive = false;
  private socket: WebSocket | null = null;

  constructor(private readonly options: DeepgramClientOptions) {}

  connect(): void {
    if (this.socket) {
      return;
    }

    const socket = this.options.url
      ? new WebSocket(this.options.url)
      : new WebSocket(buildDeepgramUrl(requireLanguage(this.options.language)), [
          "token",
          this.options.token ?? "",
        ]);
    socket.binaryType = "arraybuffer";
    socket.onopen = () => this.options.onEvent({ type: "open", reason: "deepgram_open" });
    socket.onerror = () => this.options.onEvent({ type: "error", reason: "deepgram_error" });
    socket.onclose = () => {
      this.options.onEvent({ type: "close", reason: "deepgram_close" });
      this.socket = null;
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      const parsed = parseDeepgramMessage(event.data);
      if (parsed) {
        this.options.onEvent(parsed);
      }
    };
    this.socket = socket;
  }

  sendPcm16(frame: Uint8Array): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }
    const bufferedAmount = Number(this.socket.bufferedAmount ?? 0);
    if (bufferedAmount > (this.options.maxBufferedBytes ?? defaultMaxBufferedBytes)) {
      if (!this.backpressureActive) {
        this.options.onEvent({ type: "error", reason: "deepgram_backpressure" });
      }
      this.backpressureActive = true;
      return;
    }
    this.backpressureActive = false;
    const data = frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength);
    this.socket.send(data);
  }

  keepAlive(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "KeepAlive" }));
    }
  }

  finalize(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "Finalize" }));
    }
  }

  close(): void {
    this.finalize();
    this.socket?.close(1000, "client_close");
    this.socket = null;
  }
}

function requireLanguage(language: LanguageDefinition | undefined): LanguageDefinition {
  if (!language) {
    throw new Error("Deepgram language is required without a proxied URL");
  }
  return language;
}

function buildDeepgramUrl(language: LanguageDefinition): string {
  const params = new URLSearchParams({
    model: "nova-3",
    encoding: "linear16",
    sample_rate: "16000",
    channels: "1",
    interim_results: "true",
    punctuate: "true",
    smart_format: "true",
    vad_events: "true",
    endpointing: "300",
    utterance_end_ms: "1000",
    language: language.deepgram_language,
  });
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

function parseDeepgramMessage(raw: string): DeepgramClientEvent | null {
  const parsed = safeJsonParse(raw);
  if (!parsed) {
    return { type: "error", reason: "deepgram_invalid_message" };
  }

  const message = parsed as {
    channel?: { alternatives?: Array<{ transcript?: string }> };
    is_final?: boolean;
    speech_final?: boolean;
    type?: string;
  };

  if (message.type === "UtteranceEnd") {
    return { type: "utterance_end", reason: "utterance_end" };
  }
  if (message.type === "SpeechStarted") {
    return { type: "speech_started", reason: "speech_started" };
  }
  if (message.type && message.type !== "Results") {
    return null;
  }

  const transcript = message.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
  if (!transcript) {
    return null;
  }

  return {
    is_final: Boolean(message.is_final),
    speech_final: Boolean(message.speech_final),
    transcript,
    type: "transcript",
  };
}

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
