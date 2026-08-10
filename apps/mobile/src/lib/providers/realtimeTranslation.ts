import type { RealtimeServerEvent } from "@murmur/protocol/transport/types";

import MurmurAudioModule from "../../../modules/murmur-audio";
import {
  createEmptyRealtimeTransportDiagnostics,
  inputChunkTargetBytes,
  type RealtimeTransportDiagnostics,
} from "./realtimeTranslationDiagnostics";

export {
  createEmptyRealtimeTransportDiagnostics,
  type RealtimeTransportDiagnostics,
} from "./realtimeTranslationDiagnostics";

export type RealtimeTranslationClientEvent =
  | RealtimeServerEvent
  | { kind: "playback_error" }
  | { kind: "transport_closed" }
  | { kind: "transport_error" };

export type RealtimeTranslationClient = {
  close: (reason?: string) => Promise<void>;
  connect: () => void;
  finish: () => void;
  getDiagnostics: () => RealtimeTransportDiagnostics;
  sendAudio: (data: Uint8Array) => void;
};

export function createRealtimeTranslationClient(options: {
  onEvent: (event: RealtimeTranslationClientEvent) => void;
  shouldPlayAudio?: () => boolean;
  url: string;
}): RealtimeTranslationClient {
  let socket: WebSocket | null = null;
  let acceptingMessages = true;
  let receiveQueue = Promise.resolve();
  const inputBuffer = new Uint8Array(inputChunkTargetBytes);
  let inputBufferedBytes = 0;
  const diagnostics = createEmptyRealtimeTransportDiagnostics();

  function sendBufferedAudio(allowPartial: boolean): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (inputBufferedBytes < inputChunkTargetBytes && !allowPartial) {
      return;
    }
    if (inputBufferedBytes === 0) {
      return;
    }
    const chunk = inputBuffer.slice(0, inputBufferedBytes);
    socket.send(chunk);
    diagnostics.input_chunks_sent += 1;
    diagnostics.input_bytes_sent += chunk.byteLength;
    diagnostics.last_input_chunk_sent_at_ms = Date.now();
    if (chunk.byteLength < inputChunkTargetBytes) {
      diagnostics.input_partial_chunks_sent += 1;
    }
    diagnostics.socket_buffered_amount_bytes = socket.bufferedAmount;
    diagnostics.socket_max_buffered_amount_bytes = Math.max(
      diagnostics.socket_max_buffered_amount_bytes,
      socket.bufferedAmount,
    );
    inputBufferedBytes = 0;
    diagnostics.input_buffered_bytes = 0;
  }

  function recordServerEvent(event: RealtimeServerEvent): void {
    const nowMs = Date.now();
    if (event.kind === "input_audio_ack") {
      diagnostics.worker_audio_chunks_received = event.chunk_seq;
      diagnostics.worker_audio_bytes_received = event.bytes_received;
      diagnostics.last_worker_ack_at_ms = nowMs;
      diagnostics.last_worker_received_at_ms = event.worker_received_at_ms;
      return;
    }
    if (event.kind === "source_delta") {
      diagnostics.provider_source_delta_count += 1;
      diagnostics.last_provider_source_at_ms = nowMs;
      diagnostics.last_provider_source_elapsed_ms = event.provider_elapsed_ms ?? null;
      diagnostics.last_provider_source_event_id = event.provider_event_id ?? null;
      return;
    }
    if (event.kind === "provider_session_config") {
      diagnostics.provider_session_config_received_at_ms = nowMs;
      diagnostics.provider_session_id = event.provider_session_id;
      diagnostics.provider_session_input_noise_reduction = event.input_noise_reduction;
      diagnostics.provider_session_output_language = event.output_language;
      diagnostics.provider_session_phase = event.phase;
      diagnostics.provider_session_transcription_model = event.transcription_model;
      return;
    }
    if (event.kind === "translation_delta") {
      diagnostics.provider_translation_delta_count += 1;
      diagnostics.last_provider_translation_at_ms = nowMs;
      diagnostics.last_provider_translation_elapsed_ms = event.provider_elapsed_ms ?? null;
      diagnostics.last_provider_translation_event_id = event.provider_event_id ?? null;
    }
  }

  return {
    async close(reason = "client_close"): Promise<void> {
      const activeSocket = socket;
      socket = null;
      acceptingMessages = false;
      inputBufferedBytes = 0;
      diagnostics.input_buffered_bytes = 0;
      if (
        activeSocket?.readyState === WebSocket.OPEN ||
        activeSocket?.readyState === WebSocket.CONNECTING
      ) {
        activeSocket.close(1000, reason);
      }
      await receiveQueue;
    },
    connect(): void {
      if (socket) {
        return;
      }
      acceptingMessages = true;
      const nextSocket = new WebSocket(options.url);
      nextSocket.binaryType = "arraybuffer";
      nextSocket.onopen = () => {
        diagnostics.socket_opened_at_ms = Date.now();
      };
      nextSocket.onmessage = (event) => {
        receiveQueue = receiveQueue.then(async () => {
          if (!acceptingMessages) {
            diagnostics.messages_skipped_client_closed += 1;
            return;
          }
          await receive(
            event.data,
            diagnostics,
            options.shouldPlayAudio,
            () => options.onEvent({ kind: "playback_error" }),
            (serverEvent) => {
              recordServerEvent(serverEvent);
              options.onEvent(serverEvent);
            },
          );
        }).catch(() => {
          diagnostics.socket_transport_errors += 1;
          options.onEvent({ kind: "transport_error" });
        });
      };
      nextSocket.onerror = () => {
        diagnostics.socket_transport_errors += 1;
        options.onEvent({ kind: "transport_error" });
      };
      nextSocket.onclose = () => {
        diagnostics.socket_closed_at_ms = Date.now();
        socket = null;
        void receiveQueue.then(() => options.onEvent({ kind: "transport_closed" }));
      };
      socket = nextSocket;
    },
    finish(): void {
      if (socket?.readyState === WebSocket.OPEN) {
        sendBufferedAudio(true);
        socket.send(JSON.stringify({ kind: "close_session" }));
      }
    },
    getDiagnostics(): RealtimeTransportDiagnostics {
      return {
        ...diagnostics,
        input_buffered_bytes: inputBufferedBytes,
        socket_buffered_amount_bytes: socket?.bufferedAmount ?? 0,
        socket_ready_state: socket?.readyState ?? null,
      };
    },
    sendAudio(data: Uint8Array): void {
      diagnostics.input_frames_received += 1;
      diagnostics.input_bytes_received += data.byteLength;
      diagnostics.last_input_frame_received_at_ms = Date.now();
      if (socket?.readyState !== WebSocket.OPEN) {
        diagnostics.input_frames_skipped_socket_not_open += 1;
        return;
      }
      let offset = 0;
      while (offset < data.byteLength) {
        const copyBytes = Math.min(
          inputChunkTargetBytes - inputBufferedBytes,
          data.byteLength - offset,
        );
        inputBuffer.set(data.subarray(offset, offset + copyBytes), inputBufferedBytes);
        inputBufferedBytes += copyBytes;
        offset += copyBytes;
        diagnostics.input_buffered_bytes = inputBufferedBytes;
        sendBufferedAudio(false);
      }
    },
  };
}

export function parseServerEvent(data: unknown): RealtimeServerEvent | null {
  const parsed = parseJsonRecord(data);
  if (!parsed || typeof parsed.kind !== "string") {
    return null;
  }
  if (parsed.kind === "session_opened") {
    return parseSessionOpened(parsed);
  }
  if (parsed.kind === "source_delta" || parsed.kind === "translation_delta") {
    return parseTranscriptDelta(parsed);
  }
  if (parsed.kind === "input_audio_ack") {
    return parseInputAudioAck(parsed);
  }
  if (parsed.kind === "provider_session_config") {
    return parseProviderSessionConfig(parsed);
  }
  if (parsed.kind === "session_closed") {
    return { kind: "session_closed" };
  }
  return parsed.kind === "session_error" ? parseSessionError(parsed) : null;
}

function parseSessionOpened(parsed: Record<string, unknown>): RealtimeServerEvent | null {
  return isRecord(parsed.provider_metadata)
    ? { kind: "session_opened", provider_metadata: parsed.provider_metadata }
    : null;
}

function parseTranscriptDelta(parsed: Record<string, unknown>): RealtimeServerEvent | null {
  if (
    (parsed.kind !== "source_delta" && parsed.kind !== "translation_delta") ||
    typeof parsed.delta !== "string"
  ) {
    return null;
  }
  return {
    delta: parsed.delta,
    kind: parsed.kind,
    ...(isNonNegativeFiniteNumber(parsed.provider_elapsed_ms)
      ? { provider_elapsed_ms: parsed.provider_elapsed_ms }
      : {}),
    ...(typeof parsed.provider_event_id === "string"
      ? { provider_event_id: parsed.provider_event_id }
      : {}),
  };
}

function parseInputAudioAck(parsed: Record<string, unknown>): RealtimeServerEvent | null {
  if (
    !isNonNegativeFiniteNumber(parsed.bytes_received) ||
    !isNonNegativeFiniteNumber(parsed.chunk_seq) ||
    !isNonNegativeFiniteNumber(parsed.worker_received_at_ms)
  ) {
    return null;
  }
  return {
    bytes_received: parsed.bytes_received,
    chunk_seq: parsed.chunk_seq,
    kind: "input_audio_ack",
    worker_received_at_ms: parsed.worker_received_at_ms,
  };
}

function parseProviderSessionConfig(
  parsed: Record<string, unknown>,
): RealtimeServerEvent | null {
  if (
    (parsed.phase !== "created" && parsed.phase !== "updated") ||
    !isNullableString(parsed.input_noise_reduction) ||
    !isNullableString(parsed.output_language) ||
    !isNullableString(parsed.provider_session_id) ||
    !isNullableString(parsed.transcription_model)
  ) {
    return null;
  }
  return {
    input_noise_reduction: parsed.input_noise_reduction,
    kind: "provider_session_config",
    output_language: parsed.output_language,
    phase: parsed.phase,
    provider_session_id: parsed.provider_session_id,
    transcription_model: parsed.transcription_model,
  };
}

function parseSessionError(parsed: Record<string, unknown>): RealtimeServerEvent | null {
  if (typeof parsed.code !== "string" || typeof parsed.retryable !== "boolean") {
    return null;
  }
  return {
    code: parsed.code,
    kind: "session_error",
    retryable: parsed.retryable,
  };
}

async function receive(
  data: unknown,
  diagnostics: RealtimeTransportDiagnostics,
  shouldPlayAudio: (() => boolean) | undefined,
  onPlaybackError: () => void,
  onEvent: (event: RealtimeServerEvent) => void,
): Promise<void> {
  const audio = await readAudio(data);
  if (audio) {
    diagnostics.output_audio_chunks_received += 1;
    diagnostics.output_audio_bytes_received += audio.byteLength;
    diagnostics.last_output_audio_received_at_ms = Date.now();
    if (shouldPlayAudio?.() === false) {
      diagnostics.output_audio_chunks_skipped_playback_disabled += 1;
      return;
    }
    try {
      await MurmurAudioModule.enqueuePcm16(audio);
      diagnostics.output_playback_enqueues += 1;
      diagnostics.last_output_audio_enqueued_at_ms = Date.now();
    } catch {
      diagnostics.output_playback_enqueue_failures += 1;
      onPlaybackError();
    }
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

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
