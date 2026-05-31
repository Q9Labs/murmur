import { NativeModule, requireNativeModule } from "expo";

import { MurmurAudioModuleEvents } from "./MurmurAudio.types";

declare class MurmurAudioModule extends NativeModule<MurmurAudioModuleEvents> {
  requestMicrophonePermission(): Promise<boolean>;
  getAudioState(): Promise<Record<string, unknown>>;
  startCapture(): Promise<Record<string, unknown>>;
  stopCapture(reason?: string): Promise<Record<string, unknown>>;
  startPlayback(): Promise<Record<string, unknown>>;
  enqueuePcm16(data: Uint8Array): Promise<Record<string, unknown>>;
  clearPlayback(reason?: string): Promise<Record<string, unknown>>;
  requestPlayIntegrityToken(nonce: string): Promise<Record<string, unknown>>;
}

export default requireNativeModule<MurmurAudioModule>("MurmurAudio");
