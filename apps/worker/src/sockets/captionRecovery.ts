import type { WorkerWebSocket } from "../http/response";
import { createInputAudioMessage, parseTranslationOutput, type OpenAITranslationOutput } from "../providers/openaiRealtime";

export const captionStallTimeoutMs = 10_000;
// Include replay time separately; healthy direct 4x replay answered in 1.25s.
export const captionResponseTimeoutMs = 5_000;
const maxCaptionRetries = 2;
const maxBufferedBytes = 60 * 24_000 * 2;
// A connection cap alone would not bound successful, long-running fan-out.
const maxRecoveryInputBytes = 2 * maxBufferedBytes;
const replayFrameBytes = 4_800;
const replaySpeed = 4;
type Translation = Extract<Extract<OpenAITranslationOutput, { kind: "event" }>["event"], { kind: "translation_delta" | "source_delta" }>;
type AudioQueue = { frames: ArrayBuffer[]; bytes: number };
type CaptionSplice = { reference: string; pending: string; aligned: boolean };
type CaptionConnection = AudioQueue & { socket: WorkerWebSocket; replaying: boolean; received: boolean; splice: CaptionSplice };
function appendFrames(queue: AudioQueue, frames: ArrayBuffer[], bytes: number): void {
  queue.frames.push(...frames);
  queue.bytes += bytes;
  while (queue.bytes > maxBufferedBytes) queue.bytes -= queue.frames.shift()?.byteLength ?? 0;
}

// Suppress exact replay prefixes, never fuzzy-match independent wording.
function spliceCaption(splice: CaptionSplice, delta: string): string {
  if (splice.aligned) return delta;
  splice.pending += delta;
  let overlap = 0;
  // A rolling audio prefix can start partway through the delivered transcript.
  for (let start = splice.reference.indexOf(splice.pending[0] ?? ""); start >= 0 && start < splice.reference.length;
    start = splice.reference.indexOf(splice.pending[0] ?? "", start + 1)) {
    const suffix = splice.reference.slice(start);
    if (suffix.length > splice.pending.length && suffix.startsWith(splice.pending)) return "";
    if (splice.pending.startsWith(suffix)) overlap = Math.max(overlap, suffix.length);
  }
  splice.aligned = true;
  const text = splice.pending.slice(overlap);
  splice.pending = "";
  splice.reference = "";
  return text;
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
  let inputBytes = 0;
  let budgetExhausted = false;
  let source: "pending" | "original" | "recovery" = "pending";
  let stopped = false;
  let captionsStarted = false;
  let lastAudioAt: number | null = null;
  let audioWithoutCaptionSince: number | null = null;
  let delivered = "";
  let recovered = false;
  let originalPending: Translation[] = [];
  let originalSplice: CaptionSplice = { reference: "", pending: "", aligned: true };
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
    stalled();
  }
  function forward(event: Translation, splice: CaptionSplice): void {
    if (event.delta.trim()) { captionsStarted = true; audioWithoutCaptionSince = null; clearDeadline(); }
    const delta = spliceCaption(splice, event.delta);
    if (!delta) return;
    delivered += delta;
    params.onCaption({ ...event, delta });
    if (source === "recovery" && !recovered && delta.trim()) { recovered = true; params.onRecovered(); }
  }
  function selectOriginal(): void {
    source = "original";
    clearDeadline();
    connecting?.abort();
    retire();
    originalSplice = { reference: delivered, pending: "", aligned: !delivered };
    const pending = originalPending;
    originalPending = [];
    for (const event of pending) forward(event, originalSplice);
  }
  function stalled(): void {
    clearDeadline();
    audioWithoutCaptionSince = null;
    source = "pending";
    retire();
    if (originalPending.some(event => event.delta.trim())) selectOriginal();
    else void retry();
  }
  function sendFrame(connection: CaptionConnection, frame: ArrayBuffer): boolean {
    if (inputBytes + frame.byteLength > maxRecoveryInputBytes) { budgetExhausted = true; stalled(); return false; }
    try {
      connection.socket.send(createInputAudioMessage(frame));
      inputBytes += frame.byteLength;
      budgetExhausted = inputBytes >= maxRecoveryInputBytes;
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
        source = "recovery";
        clearDeadline();
      }
      if (source === "recovery") forward(output.event, connection.splice);
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
    const connection: CaptionConnection = { socket, frames: [...history.frames], bytes: history.bytes, replaying: true, received: false,
      splice: { reference: delivered, pending: "", aligned: !delivered } };
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
    if (retries >= maxCaptionRetries || budgetExhausted) { retire(); releaseHistory(); return; }
    retire();
    retries += 1;
    params.onRetry(retries);
    const controller = new AbortController();
    connecting = controller;
    const socket = await connect(controller);
    if (socket) activate(socket);
    else if (source === "pending" && !stopped) void retry();
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
      if (stopped) return;
      const now = Date.now();
      if (lastAudioAt === null || now - lastAudioAt >= captionStallTimeoutMs) audioWithoutCaptionSince = now;
      lastAudioAt = now;
      audioWithoutCaptionSince ??= now;
      if (deadline || connecting) return;
      if (!captionsStarted) deadline = setTimeout(stalled, captionStallTimeoutMs);
      // Ongoing stalls require arriving audio, not a timer after speech has ended.
      else if (now - audioWithoutCaptionSince >= captionStallTimeoutMs) stalled();
    },
    originalCaption(event: Translation): void {
      if (stopped) return;
      if (source !== "original") {
        originalPending.push(event);
        if (source === "pending" && event.delta.trim()) selectOriginal();
      } else {
        forward(event, originalSplice);
      }
    },
    stop(): void {
      stopped = true;
      connecting?.abort();
      clearDeadline();
      retire();
      releaseHistory();
      originalPending = [];
      delivered = "";
    },
  };
}
