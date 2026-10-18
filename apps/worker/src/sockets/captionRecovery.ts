import type { WorkerWebSocket } from "../http/response";
import { createInputAudioMessage, parseTranslationOutput, type OpenAITranslationOutput } from "../providers/openaiRealtime";

export const captionStallTimeoutMs = 10_000;
// Include replay time separately; healthy direct 4x replay answered in 1.25s.
export const captionResponseTimeoutMs = 5_000;
const maxCaptionReplacements = 2;
const captionReplayWindowMs = 15_000;
const inputBytesPerMs = 48;
const maxBufferedBytes = captionReplayWindowMs * inputBytesPerMs;
const replayFrameBytes = 4_800;
const replaySpeed = 4;
type Translation = Extract<Extract<OpenAITranslationOutput, { kind: "event" }>["event"], { kind: "translation_delta" | "source_delta" }>;
type AudioQueue = { frames: ArrayBuffer[]; bytes: number };
type CaptionConnection = AudioQueue & { socket: WorkerWebSocket; replaying: boolean; received: boolean; connectedAt: number };
function appendFrames(queue: AudioQueue, frames: ArrayBuffer[], bytes: number): void {
  queue.frames.push(...frames);
  queue.bytes += bytes;
  while (queue.bytes > maxBufferedBytes) {
    const first = queue.frames[0];
    const excess = Math.min(queue.bytes - maxBufferedBytes, first.byteLength);
    if (excess === first.byteLength) queue.frames.shift();
    else queue.frames[0] = first.slice(excess);
    queue.bytes -= excess;
  }
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
  onConnectedSeconds: (seconds: number) => void;
  onReplacement: (count: number) => void;
  onExhausted: () => void;
}) {
  const history: AudioQueue = { frames: [], bytes: 0 };
  let active: CaptionConnection | null = null;
  let retries = 0;
  let source: "original" | "racing" | "recovery" | "original-only" | "ended" = "original";
  let stopped = false;
  let captionsStarted = false;
  let connecting: AbortController | null = null;
  let deadline: ReturnType<typeof setTimeout> | null = null;
  let replayTimer: ReturnType<typeof setTimeout> | null = null;

  function recoveryDisabled(): boolean {
    return stopped || source === "ended" || source === "original-only";
  }
  function canRecover(): boolean {
    return !stopped && (source === "racing" || source === "recovery");
  }
  function clearDeadline(): void {
    if (deadline) clearTimeout(deadline);
    deadline = null;
  }
  function releaseHistory(): void {
    history.frames = [];
    history.bytes = 0;
  }
  function retire(): void {
    const previous = active;
    active = null;
    if (replayTimer) clearTimeout(replayTimer);
    replayTimer = null;
    if (previous) {
      params.onConnectedSeconds((Date.now() - previous.connectedAt) / 1000);
      params.retire(previous.socket);
    }
  }
  function forward(event: Translation): void {
    if (event.delta.trim()) {
      captionsStarted = true;
      clearDeadline();
    }
    params.onCaption(event);
  }
  function fail(connection: CaptionConnection): void {
    if (active !== connection || stopped) return;
    params.onConnectionFailure();
    params.onRetryFailure();
    void retry();
  }
  function stalled(): void {
    if (recoveryDisabled()) return;
    clearDeadline();
    if (source === "original") source = "racing";
    void retry();
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
      replayTimer = setTimeout(pumpReplay, frame.byteLength / inputBytesPerMs / replaySpeed);
    }
  }
  function receiveEvent(connection: CaptionConnection, output: Extract<OpenAITranslationOutput, { kind: "event" }>): void {
    if (output.event.kind === "translation_delta") {
      if (output.event.delta.trim() && !connection.received) {
        connection.received = true;
        params.onConnectionCaption();
        if (source === "racing") {
          source = "recovery";
          params.onRecovered();
        }
      }
      if (source === "recovery") forward(output.event);
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
      if (stopped || controller.signal.aborted) { params.retire(socket); return null; }
      return socket;
    } catch {
      if (!stopped && !controller.signal.aborted) params.onRetryFailure();
      return null;
    } finally {
      clearTimeout(connectDeadline);
      if (connecting === controller) connecting = null;
    }
  }
  function activate(socket: WorkerWebSocket): void {
    if (!canRecover()) { params.retire(socket); return; }
    const connection: CaptionConnection = { socket, frames: [...history.frames], bytes: history.bytes,
      replaying: true, received: false, connectedAt: Date.now() };
    active = connection;
    params.onConnection();
    bind(connection);
    // Every takeover replays at most 15 seconds, independent of caption timing or text.
    deadline = setTimeout(() => {
      if (active === connection && !connection.received) fail(connection);
    }, captionResponseTimeoutMs + history.bytes / inputBytesPerMs / replaySpeed);
    pumpReplay();
  }
  async function retry(): Promise<void> {
    clearDeadline();
    if (!canRecover() || connecting) return;
    retire();
    if (retries >= 1 + maxCaptionReplacements) {
      source = source === "recovery" ? "ended" : "original-only";
      releaseHistory();
      params.onExhausted();
      return;
    }
    params.onReplacement(retries);
    retries += 1;
    params.onRetry(retries);
    const controller = new AbortController();
    connecting = controller;
    const socket = await connect(controller);
    // The original can win while the upgrade is pending.
    if (socket) activate(socket);
    else void retry();
  }
  function observeSpeech(): void {
    if (!captionsStarted || deadline || connecting) return;
    // A missing response to input speech is a stall even if that utterance ends.
    // Playback tails and silent input never arm this timer.
    deadline = setTimeout(() => {
      if (active) fail(active);
      else stalled();
    }, captionStallTimeoutMs);
  }
  function fanOut(connection: CaptionConnection, frames: ArrayBuffer[], bytes: number): void {
    if (connection.replaying) appendFrames(connection, frames, bytes);
    else for (const frame of frames) { if (!sendFrame(connection, frame)) break; }
  }
  function sendAudio(audio: ArrayBuffer, hasSpeech: boolean): void {
    if (stopped) return;
    // Replay and fan-out never enter the usage meter again.
    params.initial.send(createInputAudioMessage(audio));
    if (source === "ended" || source === "original-only") return;
    if (hasSpeech) observeSpeech();
    const frames: ArrayBuffer[] = [];
    for (let offset = 0; offset < audio.byteLength; offset += replayFrameBytes) frames.push(audio.slice(offset, offset + replayFrameBytes));
    appendFrames(history, frames, audio.byteLength);
    if (active) fanOut(active, frames, audio.byteLength);
  }
  return {
    sendAudio,
    outputAudio(): void {
      if (recoveryDisabled()) return;
      if (captionsStarted || deadline || connecting) return;
      deadline = setTimeout(stalled, captionStallTimeoutMs);
    },
    originalCaption(event: Translation): void {
      if (stopped || source === "recovery" || source === "ended") return;
      if (source === "racing" && event.delta.trim()) {
        source = "original";
        connecting?.abort();
        retire();
      }
      forward(event);
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
