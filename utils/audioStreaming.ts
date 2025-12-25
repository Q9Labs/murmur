/**
 * Audio streaming utilities for React Native
 *
 * Note: React Native doesn't provide direct access to raw PCM audio chunks
 * like the Web Audio API does. For production, you would typically:
 *
 * 1. Use a native module to capture raw audio data
 * 2. Use a library like react-native-audio-toolkit or react-native-live-audio-stream
 * 3. Implement a custom native module with Audio Queue Services (iOS) / AudioRecord (Android)
 *
 * This implementation provides a foundation that can be extended with native modules.
 */

export interface AudioStreamConfig {
	sampleRate: number;
	channels: number;
	encoding: string;
}

export const DEFAULT_AUDIO_CONFIG: AudioStreamConfig = {
	sampleRate: 16000,
	channels: 1,
	encoding: "linear16",
};

/**
 * Converts base64 audio data to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

/**
 * For production: This would be replaced with a native module that provides
 * real-time audio chunks. Example interface:
 *
 * ```typescript
 * import AudioStream from 'react-native-audio-stream';
 *
 * AudioStream.init({
 *   sampleRate: 16000,
 *   channels: 1,
 *   bitsPerSample: 16,
 * });
 *
 * AudioStream.on('data', (chunk) => {
 *   // Send chunk to Deepgram
 *   deepgramConnection.send(chunk);
 * });
 *
 * AudioStream.start();
 * ```
 */
export class AudioStreamManager {
	private isStreaming = false;

	async start(onData: (data: ArrayBuffer) => void): Promise<void> {
		this.isStreaming = true;
		// Placeholder - in production, this would initialize native audio capture
		console.log("AudioStreamManager: Started");
	}

	stop(): void {
		this.isStreaming = false;
		console.log("AudioStreamManager: Stopped");
	}

	isActive(): boolean {
		return this.isStreaming;
	}
}
