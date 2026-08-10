export type RealtimeTransportDiagnostics = {
  input_buffered_bytes: number;
  input_bytes_received: number;
  input_bytes_sent: number;
  input_chunk_target_bytes: number;
  input_chunks_sent: number;
  input_frames_received: number;
  input_frames_skipped_socket_not_open: number;
  input_partial_chunks_sent: number;
  last_input_chunk_sent_at_ms: number | null;
  last_input_frame_received_at_ms: number | null;
  last_output_audio_enqueued_at_ms: number | null;
  last_output_audio_received_at_ms: number | null;
  last_provider_source_at_ms: number | null;
  last_provider_source_elapsed_ms: number | null;
  last_provider_source_event_id: string | null;
  last_provider_translation_at_ms: number | null;
  last_provider_translation_elapsed_ms: number | null;
  last_provider_translation_event_id: string | null;
  last_worker_ack_at_ms: number | null;
  last_worker_received_at_ms: number | null;
  messages_skipped_client_closed: number;
  output_audio_bytes_received: number;
  output_audio_chunks_received: number;
  output_audio_chunks_skipped_playback_disabled: number;
  output_playback_enqueue_failures: number;
  output_playback_enqueues: number;
  provider_source_delta_count: number;
  provider_session_config_received_at_ms: number | null;
  provider_session_id: string | null;
  provider_session_input_noise_reduction: string | null;
  provider_session_output_language: string | null;
  provider_session_phase: "created" | "updated" | null;
  provider_session_transcription_model: string | null;
  provider_translation_delta_count: number;
  socket_buffered_amount_bytes: number;
  socket_closed_at_ms: number | null;
  socket_max_buffered_amount_bytes: number;
  socket_opened_at_ms: number | null;
  socket_ready_state: number | null;
  socket_transport_errors: number;
  worker_audio_bytes_received: number;
  worker_audio_chunks_received: number;
};

export const inputChunkTargetBytes = 24_000 * 2 * 200 / 1_000;

export function createEmptyRealtimeTransportDiagnostics(): RealtimeTransportDiagnostics {
  return {
    input_buffered_bytes: 0,
    input_bytes_received: 0,
    input_bytes_sent: 0,
    input_chunk_target_bytes: inputChunkTargetBytes,
    input_chunks_sent: 0,
    input_frames_received: 0,
    input_frames_skipped_socket_not_open: 0,
    input_partial_chunks_sent: 0,
    last_input_chunk_sent_at_ms: null,
    last_input_frame_received_at_ms: null,
    last_output_audio_enqueued_at_ms: null,
    last_output_audio_received_at_ms: null,
    last_provider_source_at_ms: null,
    last_provider_source_elapsed_ms: null,
    last_provider_source_event_id: null,
    last_provider_translation_at_ms: null,
    last_provider_translation_elapsed_ms: null,
    last_provider_translation_event_id: null,
    last_worker_ack_at_ms: null,
    last_worker_received_at_ms: null,
    messages_skipped_client_closed: 0,
    output_audio_bytes_received: 0,
    output_audio_chunks_received: 0,
    output_audio_chunks_skipped_playback_disabled: 0,
    output_playback_enqueue_failures: 0,
    output_playback_enqueues: 0,
    provider_source_delta_count: 0,
    provider_session_config_received_at_ms: null,
    provider_session_id: null,
    provider_session_input_noise_reduction: null,
    provider_session_output_language: null,
    provider_session_phase: null,
    provider_session_transcription_model: null,
    provider_translation_delta_count: 0,
    socket_buffered_amount_bytes: 0,
    socket_closed_at_ms: null,
    socket_max_buffered_amount_bytes: 0,
    socket_opened_at_ms: null,
    socket_ready_state: null,
    socket_transport_errors: 0,
    worker_audio_bytes_received: 0,
    worker_audio_chunks_received: 0,
  };
}
