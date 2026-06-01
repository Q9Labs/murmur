import type { TranslationRequest, TranslationServerEvent } from "../transport/types";

export type MurmurTranslationClientOptions = {
  onEvent: (event: TranslationServerEvent) => void;
  onStatus: (status: "open" | "close" | "error" | "reconnecting") => void;
  url: string;
};

const maxPendingPayloads = 100;
const maxReconnectDelayMs = 10_000;
const reconnectBaseDelayMs = 500;

export class MurmurTranslationClient {
  private pendingPayloads: unknown[] = [];
  private reconnectAttempt = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private socket: WebSocket | null = null;

  constructor(private readonly options: MurmurTranslationClientOptions) {}

  connect(): void {
    if (this.socket) {
      return;
    }
    this.shouldReconnect = true;
    this.openSocket();
  }

  private openSocket(): void {
    const socket = new WebSocket(this.options.url);
    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.options.onStatus("open");
      this.flushPendingPayloads();
    };
    socket.onerror = () => this.options.onStatus("error");
    socket.onclose = () => {
      this.options.onStatus("close");
      if (this.socket === socket) {
        this.socket = null;
      }
      this.scheduleReconnect();
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      const parsed = safeJsonParse(event.data);
      if (!parsed) {
        this.options.onStatus("error");
        return;
      }
      this.options.onEvent(parsed as TranslationServerEvent);
    };
    this.socket = socket;
  }

  translate(request: TranslationRequest): void {
    this.send({ ...request, kind: "translate" });
  }

  cancelTranslation(params: {
    revision?: number;
    span_id?: string;
    translation_request_id?: string;
  }): void {
    this.send({ ...params, kind: "cancel_translation" });
  }

  stopSession(reason: string, appSessionId?: string): void {
    this.shouldReconnect = false;
    this.clearReconnect();
    this.send({ app_session_id: appSessionId, kind: "stop_session", reason });
    this.pendingPayloads = [];
    this.socket?.close(1000, reason);
    this.socket = null;
  }

  cancelSession(reason: string, appSessionId?: string): void {
    this.shouldReconnect = false;
    this.clearReconnect();
    this.send({ app_session_id: appSessionId, kind: "cancel_session", reason });
    this.pendingPayloads = [];
    this.socket?.close(1000, reason);
    this.socket = null;
  }

  close(): void {
    this.shouldReconnect = false;
    this.clearReconnect();
    this.pendingPayloads = [];
    this.socket?.close(1000, "client_close");
    this.socket = null;
  }

  private send(payload: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else {
      this.pendingPayloads.push(payload);
      this.pendingPayloads = this.pendingPayloads.slice(-maxPendingPayloads);
      if (!this.socket && this.shouldReconnect && !this.reconnectTimeout) {
        this.connect();
      }
    }
  }

  private flushPendingPayloads(): void {
    const pendingPayloads = this.pendingPayloads;
    this.pendingPayloads = [];
    for (const payload of pendingPayloads) {
      this.send(payload);
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimeout) {
      return;
    }
    const delayMs = Math.min(
      maxReconnectDelayMs,
      reconnectBaseDelayMs * 2 ** this.reconnectAttempt,
    );
    this.reconnectAttempt += 1;
    this.options.onStatus("reconnecting");
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.socket && this.shouldReconnect) {
        this.openSocket();
      }
    }, delayMs);
  }

  private clearReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
