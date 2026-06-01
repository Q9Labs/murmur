import { NativeModule, registerWebModule } from "expo";

import type { MurmurAudioModuleEvents } from "./MurmurAudio.types";

class MurmurAudioModule extends NativeModule<MurmurAudioModuleEvents> {
  async requestMicrophonePermission(): Promise<boolean> {
    return false;
  }

  async getAudioState(): Promise<Record<string, unknown>> {
    return this.state("web_unavailable");
  }

  async startCapture(): Promise<Record<string, unknown>> {
    return this.state("web_unavailable");
  }

  async stopCapture(reason = "stop_capture"): Promise<Record<string, unknown>> {
    return this.state(reason);
  }

  async startPlayback(): Promise<Record<string, unknown>> {
    return this.state("web_unavailable");
  }

  async enqueuePcm16(): Promise<Record<string, unknown>> {
    return this.state("web_unavailable");
  }

  async clearPlayback(reason = "clear_playback"): Promise<Record<string, unknown>> {
    return this.state(reason);
  }

  async requestPlayIntegrityToken(): Promise<Record<string, unknown>> {
    return {
      available: false,
      platform: "web",
      reason: "web_unavailable",
    };
  }

  private state(reason: string): Record<string, unknown> {
    return {
      audio_generation_id: 0,
      capture_active: false,
      dropped_frames: 0,
      event_seq: 0,
      playback_active: false,
      playback_queued_ms: 0,
      reason,
      route: "web",
      sample_rate: 16000,
    };
  }
}

export default registerWebModule(MurmurAudioModule, "MurmurAudio");
