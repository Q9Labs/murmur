export type UltravoxTranscriptEvent = {
  delta: string | null;
  final: boolean;
  medium: string | null;
  ordinal: number;
  role: "agent" | "user";
  text: string | null;
  type: "transcript";
};

export type UltravoxStatusEvent = {
  call_id?: string;
  reason: string;
  state?: string;
  type: "call_started" | "close" | "error" | "open" | "state";
};

export type UltravoxClientEvent = UltravoxStatusEvent | UltravoxTranscriptEvent;

export type UltravoxClientOptions = {
  maxBufferedBytes?: number;
  onEvent: (event: UltravoxClientEvent) => void;
  url: string;
};

const defaultMaxBufferedBytes = 128_000;

export class UltravoxLiveClient {
  private backpressureActive = false;
  private socket: WebSocket | null = null;

  constructor(private readonly options: UltravoxClientOptions) {}

  connect(): void {
    if (this.socket) {
      return;
    }

    const socket = new WebSocket(this.options.url);
    socket.binaryType = "arraybuffer";
    socket.onopen = () => {
      this.options.onEvent({ type: "open", reason: "ultravox_open" });
      socket.send(JSON.stringify({ type: "set_output_medium", medium: "text" }));
    };
    socket.onerror = () => this.options.onEvent({ type: "error", reason: "ultravox_error" });
    socket.onclose = () => {
      this.options.onEvent({ type: "close", reason: "ultravox_close" });
      this.socket = null;
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      const parsed = parseUltravoxMessage(event.data);
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
        this.options.onEvent({ type: "error", reason: "ultravox_backpressure" });
      }
      this.backpressureActive = true;
      return;
    }
    this.backpressureActive = false;
    const data = frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength);
    this.socket.send(data);
  }

  close(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "hang_up", message: "" }));
    }
    this.socket?.close(1000, "client_close");
    this.socket = null;
  }
}

function parseUltravoxMessage(raw: string): UltravoxClientEvent | null {
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") {
    return { type: "error", reason: "ultravox_invalid_message" };
  }

  const message = parsed as {
    callId?: string;
    delta?: string | null;
    final?: boolean;
    medium?: string;
    ordinal?: number;
    role?: string;
    state?: string;
    text?: string | null;
    type?: string;
  };

  if (message.type === "call_started") {
    return { type: "call_started", reason: "call_started", call_id: message.callId };
  }
  if (message.type === "state") {
    return { type: "state", reason: "state", state: message.state };
  }
  if (message.type !== "transcript") {
    return null;
  }
  if (message.role !== "agent" && message.role !== "user") {
    return null;
  }

  const text = typeof message.text === "string" ? message.text : null;
  const delta = typeof message.delta === "string" ? message.delta : null;
  if (!text && !delta) {
    return null;
  }

  return {
    delta,
    final: Boolean(message.final),
    medium: typeof message.medium === "string" ? message.medium : null,
    ordinal: typeof message.ordinal === "number" ? message.ordinal : 0,
    role: message.role,
    text,
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
