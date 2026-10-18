import type { WorkerWebSocket } from "../http/response";
import { createInputAudioMessage, parseTranslationOutput, type OpenAITranslationOutput } from "../providers/openaiRealtime";

export const captionStallTimeoutMs = 10_000;
// Include replay time separately; healthy direct 4x replay answered in 1.25s.
export const captionResponseTimeoutMs = 5_000;
const maxCaptionReplacements = 2;
const maxBufferedBytes = 60 * 24_000 * 2;
const replayFrameBytes = 4_800;
const replaySpeed = 4;
type Translation = Extract<Extract<OpenAITranslationOutput, { kind: "event" }>["event"], { kind: "translation_delta" | "source_delta" }>;
type AudioQueue = { frames: ArrayBuffer[]; bytes: number };
type CaptionConnection = AudioQueue & { socket: WorkerWebSocket; replaying: boolean; received: boolean; connectedAt: number };
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
  let lastAudioAt = Date.now() - captionStallTimeoutMs;
  let audioWithoutCaptionSince: number | null = null;
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
      audioWithoutCaptionSince = null;
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
    audioWithoutCaptionSince = null;
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
      replayTimer = setTimeout(pumpReplay, frame.byteLength / 48 / replaySpeed);
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
    // Replaying the whole recent window prefers a repeated line over lost speech.
    deadline = setTimeout(() => {
      if (active === connection && !connection.received) fail(connection);
    }, captionResponseTimeoutMs + history.bytes / 48 / replaySpeed);
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
  function sendAudio(audio: ArrayBuffer): void {
    if (stopped) return;
    // Replay and fan-out never enter the usage meter again.
    params.initial.send(createInputAudioMessage(audio));
    if (source === "ended" || source === "original-only") return;
    const frames: ArrayBuffer[] = [];
    for (let offset = 0; offset < audio.byteLength; offset += replayFrameBytes) frames.push(audio.slice(offset, offset + replayFrameBytes));
    appendFrames(history, frames, audio.byteLength);
    const connection = active;
    if (!connection) return;
    if (connection.replaying) appendFrames(connection, frames, audio.byteLength);
    else for (const frame of frames) { if (!sendFrame(connection, frame)) break; }
  }
  function observeAudio(now: number): number {
    const afterPause = now - lastAudioAt >= captionStallTimeoutMs;
    lastAudioAt = now;
    if (afterPause || audioWithoutCaptionSince === null) audioWithoutCaptionSince = now;
    return audioWithoutCaptionSince;
  }
  return {
    sendAudio,
    outputAudio(): void {
      if (recoveryDisabled()) return;
      const now = Date.now();
      const since = observeAudio(now);
      if (deadline || connecting) return;
      if (!captionsStarted) deadline = setTimeout(stalled, captionStallTimeoutMs);
      // Ongoing stalls require arriving audio, not a timer after speech has ended.
      else if (now - since >= captionStallTimeoutMs) stalled();
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
