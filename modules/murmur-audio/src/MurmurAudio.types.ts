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
  sample_rate: 16000;
  timestamp_ms: number;
};

export type AudioStateEvent = {
  audio_generation_id: number;
  capture_active: boolean;
  dropped_frames: number;
  event_seq: number;
  playback_active: boolean;
  playback_queued_ms: number;
  reason: string;
  route: string;
  sample_rate: 16000;
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
