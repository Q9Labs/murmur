import type { WorkerWebSocket } from "../http/response";
import { createInputAudioMessage } from "../providers/openaiRealtime";

// Saved robot trials: healthy audio-to-caption p95 500ms, maximum 590ms (n=20).
export const captionStallTimeoutMs = 2_000;
const maxCaptionRetries = 2;
const maxBufferedBytes = 30 * 24_000 * 2;
const replayFrameBytes = 4_800;
const replaySpeed = 4;

type Replay = {
  frames: ArrayBuffer[];
  bytes: number;
  socket: WorkerWebSocket;
};

export function createCaptionRecovery(params: {
  initial: WorkerWebSocket;
  open: (signal: AbortSignal) => Promise<WorkerWebSocket>;
  activate: (socket: WorkerWebSocket) => void;
  retire: (socket: WorkerWebSocket) => void;
  onRetry: (count: number) => void;
  onRecovered: () => void;
  onRetryFailure: () => void;
  onReplayFailure: () => void;
}) {
  let current = params.initial;
  let history: ArrayBuffer[] = [];
  let historyBytes = 0;
  let replay: Replay | null = null;
  let retries = 0;
  let captionReceived = false;
  let stopped = false;
  let connecting: AbortController | null = null;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  let replayTimer: ReturnType<typeof setTimeout> | null = null;

  function clearStall(): void {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = null;
  }

  function releaseHistory(): void {
    history = [];
    historyBytes = 0;
  }

  function pumpReplay(): void {
    replayTimer = null;
    const active = replay;
    if (!active || stopped) return;
    const frame = active.frames.shift();
    if (!frame) {
      replay = null;
      return;
    }
    active.bytes -= frame.byteLength;
    try {
      active.socket.send(createInputAudioMessage(frame));
    } catch {
      params.onReplayFailure();
      return;
    }
    replayTimer = setTimeout(pumpReplay, frame.byteLength / 48 / replaySpeed);
  }

  function canRetry(): boolean {
    return !stopped && !captionReceived && !connecting && retries < maxCaptionRetries && history.length > 0;
  }

  async function retry(): Promise<void> {
    stallTimer = null;
    if (!canRetry()) return;
    retries += 1;
    params.onRetry(retries);
    const controller = new AbortController();
    connecting = controller;
    const deadline = setTimeout(() => controller.abort(), 15_000);
    try {
      const replacement = await params.open(controller.signal);
      if (stopped || captionReceived || controller.signal.aborted) {
        params.retire(replacement);
        return;
      }
      const previous = current;
      if (replayTimer) clearTimeout(replayTimer);
      replayTimer = null;
      replay = { socket: replacement, frames: [...history], bytes: historyBytes };
      current = replacement;
      // Activate before closing: all callbacks from the previous generation become inert.
      params.activate(replacement);
      params.retire(previous);
      pumpReplay();
    } catch {
      if (!stopped && !captionReceived) {
        params.onRetryFailure();
        // The old connection is still usable if the replacement handshake failed.
        stallTimer = setTimeout(() => { void retry(); }, captionStallTimeoutMs);
      }
    } finally {
      clearTimeout(deadline);
      connecting = null;
    }
  }

  function sendAudio(audio: ArrayBuffer): void {
    if (stopped) return;
    // Split large client frames so the replay rate is bounded, not a large burst.
    const frames: ArrayBuffer[] = [];
    for (let offset = 0; offset < audio.byteLength; offset += replayFrameBytes) {
      frames.push(audio.slice(offset, offset + replayFrameBytes));
    }
    if (!captionReceived) {
      history.push(...frames);
      historyBytes += audio.byteLength;
      while (historyBytes > maxBufferedBytes) {
        const oldest = history.shift();
        if (oldest) historyBytes -= oldest.byteLength;
      }
    }
    if (replay) {
      // Real-time input drains at 4x. An unbounded sender must not grow this queue.
      if (replay.bytes + audio.byteLength > maxBufferedBytes) {
        params.onReplayFailure();
        return;
      }
      replay.frames.push(...frames);
      replay.bytes += audio.byteLength;
    } else {
      current.send(createInputAudioMessage(audio));
    }
  }

  return {
    sendAudio,
    outputAudio(): void {
      if (!stallTimer && canRetry()) {
        stallTimer = setTimeout(() => { void retry(); }, captionStallTimeoutMs);
      }
    },
    caption(): void {
      if (captionReceived || stopped) return;
      captionReceived = true;
      clearStall();
      connecting?.abort();
      releaseHistory();
      if (current !== params.initial) params.onRecovered();
    },
    stop(): void {
      stopped = true;
      connecting?.abort();
      clearStall();
      if (replayTimer) clearTimeout(replayTimer);
      replayTimer = null;
      replay = null;
      releaseHistory();
    },
  };
}
