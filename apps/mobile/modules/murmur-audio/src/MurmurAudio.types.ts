export type MurmurAudioModuleEvents = {
  onAudioFrame: (frame: AudioFrameEvent) => void;
  onAudioState: (state: AudioStateEvent) => void;
};

export type AudioFrameEvent = {
  audio_generation_id: number;
  data: Uint8Array;
  duration_ms: number;
  event_seq: number;
  rms: number;
  sample_rate: 24000;
  timestamp_ms: number;
};

export type AudioStateEvent = {
  android?: {
    acoustic_echo_canceler: AudioEffectState;
    audio_mode: number | null;
    audio_source: string;
    automatic_gain_control: AudioEffectState;
    capture_bytes_emitted_native: number;
    capture_frames_emitted_native: number;
    capture_read_errors: number;
    last_capture_frame_at_ms: number | null;
    last_capture_frame_rms: number | null;
    noise_suppressor: AudioEffectState;
    output_route: string;
    playback_bytes_requested: number;
    playback_bytes_written: number;
    playback_chunks_received: number;
    playback_short_writes: number;
    playback_underrun_count: number;
    playback_usage: string;
    playback_write_errors: number;
    sdk_int: number;
  };
  audio_generation_id: number;
  capture_active: boolean;
  dropped_frames: number;
  event_seq: number;
  playback_active: boolean;
  playback_queued_ms: number;
  reason: string;
  route: string;
  sample_rate: 24000;
};

export type AudioEffectState = {
  available: boolean;
  created: boolean;
  enabled: boolean;
  has_control: boolean;
};

export type DeviceIntegrityPayload = {
  available: boolean;
  key_id?: string;
  kind?: "attestation" | "assertion" | string;
  nonce?: string;
  platform: "android" | "ios" | "web" | string;
  provider?: "play_integrity" | "app_attest" | string;
  reason?: string;
  token?: string;
};
