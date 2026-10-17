import type { WorkerWebSocket } from "../http/response";
import { createInputAudioMessage, parseTranslationOutput, type OpenAITranslationOutput } from "../providers/openaiRealtime";

export const captionStallTimeoutMs = 10_000;
// Long-speech healthy audio-to-caption max was 4.158s. Include replay time separately.
export const captionResponseTimeoutMs = 5_000;
const maxCaptionRetries = 2;
const maxBufferedBytes = 60 * 24_000 * 2;
const replayFrameBytes = 4_800;
const replaySpeed = 4;
type Translation = Extract<Extract<OpenAITranslationOutput, { kind: "event" }>["event"], { kind: "translation_delta" | "source_delta" }>;
type AudioQueue = { frames: ArrayBuffer[]; bytes: number };
type CaptionConnection = AudioQueue & { socket: WorkerWebSocket; replaying: boolean; received: boolean };
function appendFrames(queue: AudioQueue, frames: ArrayBuffer[], bytes: number): void {
  queue.frames.push(...frames);
  queue.bytes += bytes;
  while (queue.bytes > maxBufferedBytes) queue.bytes -= queue.frames.shift()?.byteLength ?? 0;
}

export function createCaptionRecovery(params: {
  initial: WorkerWebSocket;
  open: (signal: AbortSignal) => Promise<WorkerWebSocket>;
  retire: (socket: WorkerWebSocket) => void;
  onCaption: (event: Translation) => void;
  onRetry: (count: number) => void;
  onRecovered: () => void;
  onRetryFailure: () => void;
  onConnection: () => void;
  onConnectionCaption: () => void;
  onConnectionFailure: () => void;
  onInput: (bytes: number) => void;
}) {
  const history: AudioQueue = { frames: [], bytes: 0 };
  let retainHistory = true;
  let active: CaptionConnection | null = null;
  let retries = 0;
  let source: "pending" | "original" | "recovery" = "pending";
  let stopped = false;
  let started = false;
  let connecting: AbortController | null = null;
  let deadline: ReturnType<typeof setTimeout> | null = null;
  let replayTimer: ReturnType<typeof setTimeout> | null = null;

  function clearDeadline(): void {
    if (deadline) clearTimeout(deadline);
    deadline = null;
  }
  function releaseHistory(): void {
    retainHistory = false;
    history.frames = [];
    history.bytes = 0;
  }
  function retire(): void {
    const previous = active;
    active = null;
    if (replayTimer) clearTimeout(replayTimer);
    replayTimer = null;
    if (previous) params.retire(previous.socket);
  }
  function fail(connection: CaptionConnection): void {
    if (active !== connection || stopped) return;
    if (!connection.received) params.onConnectionFailure();
    params.onRetryFailure();
    clearDeadline();
    retire();
    if (source === "pending") void retry();
  }
  function sendFrame(connection: CaptionConnection, frame: ArrayBuffer): boolean {
    try {
      connection.socket.send(createInputAudioMessage(frame));
      params.onInput(frame.byteLength);
      return true;
    } catch {
      fail(connection);
      return false;
    }
  }
  function pumpReplay(): void {
    replayTimer = null;
    const connection = active;
    if (!connection || stopped) return;
    const frame = connection.frames.shift();
    if (!frame) { connection.replaying = false; return; }
    connection.bytes -= frame.byteLength;
    if (sendFrame(connection, frame)) {
      replayTimer = setTimeout(pumpReplay, frame.byteLength / 48 / replaySpeed);
    }
  }
  function receiveEvent(connection: CaptionConnection, output: Extract<OpenAITranslationOutput, { kind: "event" }>): void {
    if (output.event.kind === "translation_delta" && output.event.delta.trim()) {
      if (!connection.received) { connection.received = true; params.onConnectionCaption(); }
      if (source === "pending") {
        source = "recovery";
        clearDeadline();
        releaseHistory();
        params.onRecovered();
      }
      if (source === "recovery") params.onCaption(output.event);
    } else if (output.event.kind === "session_error" || output.event.kind === "session_closed") {
      fail(connection);
    }
  }
  function bind(connection: CaptionConnection): void {
    connection.socket.addEventListener("message", (event: MessageEvent) => {
      if (stopped || active !== connection) return;
      try {
        const output = parseTranslationOutput(event.data);
        // Caption-only audio and source transcripts are never client playback/caption sources.
        if (output.kind === "event") receiveEvent(connection, output);
      } catch { fail(connection); }
    });
    connection.socket.addEventListener("close", () => fail(connection));
    connection.socket.addEventListener("error", () => fail(connection));
  }
  async function connect(controller: AbortController): Promise<WorkerWebSocket | null> {
    const connectDeadline = setTimeout(() => controller.abort(), captionResponseTimeoutMs);
    try {
      const socket = await params.open(controller.signal);
      if (stopped || source !== "pending" || controller.signal.aborted) { params.retire(socket); return null; }
      return socket;
    } catch {
      if (!stopped && source === "pending") params.onRetryFailure();
      return null;
    } finally {
      clearTimeout(connectDeadline);
      connecting = null;
    }
  }
  function activate(socket: WorkerWebSocket): void {
    if (stopped || source !== "pending") { params.retire(socket); return; }
    const connection = { socket, frames: [...history.frames], bytes: history.bytes, replaying: true, received: false };
    active = connection;
    params.onConnection();
    bind(connection);
    // Arm at connection, including silent providers. Buffer eviction never touches this timer.
    deadline = setTimeout(() => {
      if (active === connection && !connection.received) fail(connection);
    }, captionResponseTimeoutMs + history.bytes / 48 / replaySpeed);
    if (retries === maxCaptionRetries) releaseHistory();
    pumpReplay();
  }
  async function retry(): Promise<void> {
    clearDeadline();
    if (stopped || source !== "pending" || connecting) return;
    if (retries >= maxCaptionRetries) { retire(); releaseHistory(); return; }
    retire();
    retries += 1;
    params.onRetry(retries);
    const controller = new AbortController();
    connecting = controller;
    const socket = await connect(controller);
    if (socket) activate(socket);
    else if (!stopped && source === "pending") void retry();
  }
  function sendAudio(audio: ArrayBuffer): void {
    if (stopped) return;
    // The original is permanent. Replay and fan-out never enter the usage meter again.
    params.initial.send(createInputAudioMessage(audio));
    const frames: ArrayBuffer[] = [];
    for (let offset = 0; offset < audio.byteLength; offset += replayFrameBytes) frames.push(audio.slice(offset, offset + replayFrameBytes));
    if (retainHistory) {
      appendFrames(history, frames, audio.byteLength);
    }
    const connection = active;
    if (!connection) return;
    if (connection.replaying) {
      appendFrames(connection, frames, audio.byteLength);
    } else {
      for (const frame of frames) { if (!sendFrame(connection, frame)) break; }
    }
  }
  return {
    sendAudio,
    outputAudio(): void {
      if (stopped || started || source !== "pending") return;
      started = true;
      deadline = setTimeout(() => { void retry(); }, captionStallTimeoutMs);
    },
    acceptOriginalCaption(delta: string): boolean {
      if (stopped || !delta.trim() || source === "recovery") return false;
      if (source === "pending") {
        source = "original";
        clearDeadline();
        connecting?.abort();
        retire();
        releaseHistory();
      }
      return true;
    },
    stop(): void {
      stopped = true;
      connecting?.abort();
      clearDeadline();
      retire();
      releaseHistory();
    },
  };
}
