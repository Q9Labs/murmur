import { NativeModule, registerWebModule } from "expo";

import type { AudioFrameEvent, AudioStateEvent, MurmurAudioModuleEvents } from "./MurmurAudio.types";

const murmurSampleRate = 24_000;
const frameSamples = 480;
const frameDurationMs = 20;
const playbackIdlePaddingMs = 120;

type CaptureRuntime = {
  audioContext: AudioContext;
  input: MediaStreamAudioSourceNode;
  node: AudioWorkletNode | ScriptProcessorNode;
  stream: MediaStream;
};

type PendingPlayback = {
  audioBuffer: AudioBuffer;
  durationMs: number;
};

class MurmurAudioModule extends NativeModule<MurmurAudioModuleEvents> {
  private audioGenerationId = 0;
  private captureRuntime: CaptureRuntime | null = null;
  private captureBuffer = new Float32Array(0);
  private droppedFrames = 0;
  private eventSeq = 0;
  private playbackContext: AudioContext | null = null;
  private playbackActive = false;
  private playbackEndsAtMs = 0;
  private playbackGeneration = 0;
  private playbackQueuedMs = 0;
  private playbackSources: AudioBufferSourceNode[] = [];
  private pendingPlayback: PendingPlayback[] = [];
  private playbackIdleTimer: ReturnType<typeof setTimeout> | null = null;

  async requestMicrophonePermission(): Promise<boolean> {
    if (!supportsBrowserAudioCapture()) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: getCaptureConstraints() });
      stopMediaStream(stream);
      return true;
    } catch {
      return false;
    }
  }

  async getAudioState(): Promise<AudioStateEvent> {
    return this.state("get_audio_state");
  }

  async startCapture(): Promise<AudioStateEvent> {
    if (this.captureRuntime) {
      return this.state("capture_started");
    }
    if (!supportsBrowserAudioCapture()) {
      throw new Error("Browser microphone capture is unavailable");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: getCaptureConstraints() });
    try {
      const AudioContextConstructor = getAudioContextConstructor();
      const audioContext = new AudioContextConstructor();
      await audioContext.resume();
      const input = audioContext.createMediaStreamSource(stream);
      const node = await createCaptureNode(audioContext, (samples) => this.handleCaptureSamples(samples));
      input.connect(node);
      connectCaptureNodeToSink(node, audioContext);

      this.audioGenerationId += 1;
      this.captureBuffer = new Float32Array(0);
      this.droppedFrames = 0;
      this.captureRuntime = {
        audioContext,
        input,
        node,
        stream,
      };
      this.emitState("capture_started");
      return this.state("capture_started");
    } catch (error) {
      stopMediaStream(stream);
      throw error;
    }
  }

  async stopCapture(reason = "stop_capture"): Promise<AudioStateEvent> {
    await this.stopCaptureRuntime();
    this.emitState(reason);
    return this.state(reason);
  }

  async startPlayback(): Promise<AudioStateEvent> {
    await this.ensurePlaybackStarted();
    this.emitState("playback_started");
    return this.state("playback_started");
  }

  async enqueuePcm16(data: Uint8Array): Promise<AudioStateEvent> {
    if (!data.length) {
      return this.state("playback_enqueued");
    }
    const context = await this.ensurePlaybackStarted();
    const audioBuffer = pcm16ToAudioBuffer(data, context);
    const durationMs = Math.round((audioBuffer.length / context.sampleRate) * 1000);
    this.pendingPlayback.push({ audioBuffer, durationMs });
    this.flushPlaybackQueue(context);
    this.emitState("playback_enqueued");
    return this.state("playback_enqueued");
  }

  async clearPlayback(reason = "clear_playback"): Promise<AudioStateEvent> {
    this.clearPlaybackRuntime(reason);
    return this.state(reason);
  }

  async requestPlayIntegrityToken(): Promise<Record<string, unknown>> {
    return {
      available: false,
      platform: "web",
      reason: "platform_integrity_not_implemented",
    };
  }

  private handleCaptureSamples(samples: Float32Array): void {
    if (!this.captureRuntime) {
      return;
    }

    const combined = appendSamples(this.captureBuffer, samples);
    let offset = 0;
    while (offset + frameSamples <= combined.length) {
      const frame = combined.subarray(offset, offset + frameSamples);
      this.emitFrame(float32ToPcm16Bytes(frame));
      offset += frameSamples;
    }
    this.captureBuffer = combined.slice(offset);
  }

  private emitFrame(data: Uint8Array): void {
    this.emit("onAudioFrame", {
      audio_generation_id: this.audioGenerationId,
      data,
      duration_ms: frameDurationMs,
      event_seq: this.nextEventSeq(),
      rms: calculatePcm16Rms(data),
      sample_rate: murmurSampleRate,
      timestamp_ms: Date.now(),
    } satisfies AudioFrameEvent);
  }

  private emitState(reason: string): void {
    this.emit("onAudioState", this.state(reason));
  }

  private state(reason: string): AudioStateEvent {
    this.refreshPlaybackQueueMs();
    return {
      audio_generation_id: this.audioGenerationId,
      capture_active: Boolean(this.captureRuntime),
      dropped_frames: this.droppedFrames,
      event_seq: this.nextEventSeq(),
      playback_active: this.playbackActive,
      playback_queued_ms: this.playbackQueuedMs,
      reason,
      route: "web",
      sample_rate: murmurSampleRate,
    };
  }

  private nextEventSeq(): number {
    this.eventSeq += 1;
    return this.eventSeq;
  }

  private async stopCaptureRuntime(): Promise<void> {
    const runtime = this.captureRuntime;
    if (!runtime) {
      return;
    }
    this.captureRuntime = null;
    this.captureBuffer = new Float32Array(0);
    try {
      runtime.input.disconnect();
      runtime.node.disconnect();
    } catch {
      this.droppedFrames += 1;
    }
    stopMediaStream(runtime.stream);
    await runtime.audioContext.close().catch(() => undefined);
  }

  private async ensurePlaybackStarted(): Promise<AudioContext> {
    const AudioContextConstructor = getAudioContextConstructor();
    if (!this.playbackContext) {
      this.playbackContext = new AudioContextConstructor({ sampleRate: murmurSampleRate });
    }
    await this.playbackContext.resume();
    if (!this.playbackActive) {
      this.playbackActive = true;
      this.playbackGeneration += 1;
      this.playbackEndsAtMs = 0;
    }
    return this.playbackContext;
  }

  private flushPlaybackQueue(context: AudioContext): void {
    while (this.pendingPlayback.length) {
      const item = this.pendingPlayback.shift();
      if (!item) {
        continue;
      }
      const source = context.createBufferSource();
      source.buffer = item.audioBuffer;
      source.connect(context.destination);
      const currentTimeMs = context.currentTime * 1000;
      const startAtMs = Math.max(currentTimeMs, this.playbackEndsAtMs);
      this.playbackEndsAtMs = startAtMs + item.durationMs;
      const generation = this.playbackGeneration;
      source.onended = () => {
        if (generation !== this.playbackGeneration) {
          return;
        }
        this.playbackSources = this.playbackSources.filter((current) => current !== source);
        this.refreshPlaybackQueueMs();
        if (this.playbackQueuedMs <= 0) {
          this.finishPlayback("playback_finished");
          return;
        }
        this.emitState("playback_buffer_complete");
      };
      source.start(startAtMs / 1000);
      this.playbackSources.push(source);
    }
    this.refreshPlaybackQueueMs();
    this.schedulePlaybackIdle();
  }

  private refreshPlaybackQueueMs(): void {
    const contextNowMs = (this.playbackContext?.currentTime ?? 0) * 1000;
    this.playbackQueuedMs = this.playbackActive ? Math.max(0, Math.round(this.playbackEndsAtMs - contextNowMs)) : 0;
  }

  private schedulePlaybackIdle(): void {
    if (this.playbackIdleTimer) {
      clearTimeout(this.playbackIdleTimer);
    }
    const generation = this.playbackGeneration;
    const delayMs = Math.max(80, this.playbackQueuedMs + playbackIdlePaddingMs);
    this.playbackIdleTimer = setTimeout(() => {
      if (generation !== this.playbackGeneration || !this.playbackActive) {
        return;
      }
      this.refreshPlaybackQueueMs();
      if (this.playbackQueuedMs <= 0) {
        this.finishPlayback("playback_finished");
      }
    }, delayMs);
  }

  private clearPlaybackRuntime(reason: string): void {
    this.playbackGeneration += 1;
    if (this.playbackIdleTimer) {
      clearTimeout(this.playbackIdleTimer);
      this.playbackIdleTimer = null;
    }
    for (const source of this.playbackSources) {
      try {
        source.stop();
      } catch {
        // Source may have already ended; playback state is reset below.
      }
    }
    this.playbackSources = [];
    this.pendingPlayback = [];
    this.playbackEndsAtMs = 0;
    this.playbackQueuedMs = 0;
    this.playbackActive = false;
    this.emitState(reason);
  }

  private finishPlayback(reason: string): void {
    this.playbackGeneration += 1;
    this.playbackSources = [];
    this.pendingPlayback = [];
    this.playbackEndsAtMs = 0;
    this.playbackQueuedMs = 0;
    this.playbackActive = false;
    this.emitState(reason);
  }
}

export function calculatePcm16Rms(data: Uint8Array): number {
  if (!data.length) {
    return 0;
  }

  let sum = 0;
  let count = 0;
  for (let index = 0; index + 1 < data.length; index += 2) {
    const sample = readInt16Le(data, index) / 32767;
    sum += sample * sample;
    count += 1;
  }
  return count === 0 ? 0 : Math.sqrt(sum / count);
}

export function float32ToPcm16Bytes(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    const sample = clamped < 0 ? clamped * 32768 : clamped * 32767;
    writeInt16Le(bytes, index * 2, Math.round(sample));
  }
  return bytes;
}

export function resampleForRealtime(samples: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === murmurSampleRate) {
    return samples.slice();
  }
  if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0) {
    return new Float32Array(0);
  }

  const ratio = inputSampleRate / murmurSampleRate;
  const outputLength = Math.floor(samples.length / ratio);
  const output = new Float32Array(outputLength);
  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(samples.length, Math.floor((outputIndex + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
      sum += samples[inputIndex];
      count += 1;
    }
    output[outputIndex] = count > 0 ? sum / count : samples[start] ?? 0;
  }
  return output;
}

function appendSamples(left: Float32Array, right: Float32Array): Float32Array {
  if (!left.length) {
    return right.slice();
  }
  const combined = new Float32Array(left.length + right.length);
  combined.set(left);
  combined.set(right, left.length);
  return combined;
}

function supportsBrowserAudioCapture(): boolean {
  return Boolean(globalThis.navigator?.mediaDevices && getAudioContextConstructorOrNull());
}

function getCaptureConstraints(): MediaTrackConstraints {
  return {
    autoGainControl: true,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
  };
}

function getAudioContextConstructor(): typeof AudioContext {
  const constructor = getAudioContextConstructorOrNull();
  if (!constructor) {
    throw new Error("Browser AudioContext is unavailable");
  }
  return constructor;
}

function getAudioContextConstructorOrNull(): typeof AudioContext | null {
  const webGlobal = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  return webGlobal.AudioContext ?? webGlobal.webkitAudioContext ?? null;
}

async function createCaptureNode(
  audioContext: AudioContext,
  onSamples: (samples: Float32Array) => void,
): Promise<AudioWorkletNode | ScriptProcessorNode> {
  if (audioContext.audioWorklet && typeof AudioWorkletNode !== "undefined") {
    const workletUrl = createCaptureWorkletUrl(audioContext.sampleRate);
    try {
      await audioContext.audioWorklet.addModule(workletUrl);
      const node = new AudioWorkletNode(audioContext, "murmur-capture-processor");
      node.port.onmessage = (event: MessageEvent<Float32Array>) => onSamples(event.data);
      URL.revokeObjectURL(workletUrl);
      return node;
    } catch {
      URL.revokeObjectURL(workletUrl);
    }
  }

  const node = audioContext.createScriptProcessor(2048, 1, 1);
  node.onaudioprocess = (event) => {
    onSamples(resampleForRealtime(event.inputBuffer.getChannelData(0), audioContext.sampleRate));
    event.outputBuffer.getChannelData(0).fill(0);
  };
  return node;
}

function createCaptureWorkletUrl(inputSampleRate: number): string {
  const source = `
    const targetSampleRate = ${murmurSampleRate};
    const inputSampleRate = ${JSON.stringify(inputSampleRate)};
    function downsample(samples) {
      if (inputSampleRate === targetSampleRate) {
        return new Float32Array(samples);
      }
      const ratio = inputSampleRate / targetSampleRate;
      const outputLength = Math.floor(samples.length / ratio);
      const output = new Float32Array(outputLength);
      for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
        const start = Math.floor(outputIndex * ratio);
        const end = Math.min(samples.length, Math.floor((outputIndex + 1) * ratio));
        let sum = 0;
        let count = 0;
        for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
          sum += samples[inputIndex];
          count += 1;
        }
        output[outputIndex] = count > 0 ? sum / count : samples[start] || 0;
      }
      return output;
    }
    class MurmurCaptureProcessor extends AudioWorkletProcessor {
      process(inputs) {
        const channel = inputs[0] && inputs[0][0];
        if (channel) {
          this.port.postMessage(downsample(channel));
        }
        return true;
      }
    }
    registerProcessor("murmur-capture-processor", MurmurCaptureProcessor);
  `;
  return URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
}

function connectCaptureNodeToSink(node: AudioWorkletNode | ScriptProcessorNode, audioContext: AudioContext): void {
  const gain = audioContext.createGain();
  gain.gain.value = 0;
  node.connect(gain);
  gain.connect(audioContext.destination);
}

function pcm16ToAudioBuffer(data: Uint8Array, audioContext: AudioContext): AudioBuffer {
  const audioBuffer = audioContext.createBuffer(1, Math.floor(data.length / 2), murmurSampleRate);
  const channel = audioBuffer.getChannelData(0);
  for (let index = 0; index + 1 < data.length; index += 2) {
    channel[index / 2] = readInt16Le(data, index) / 32768;
  }
  return audioBuffer;
}

function readInt16Le(data: Uint8Array, offset: number): number {
  const value = data[offset] | (data[offset + 1] << 8);
  return value & 0x8000 ? value - 0x10000 : value;
}

function writeInt16Le(data: Uint8Array, offset: number, value: number): void {
  const normalized = value < 0 ? value + 0x10000 : value;
  data[offset] = normalized & 0xff;
  data[offset + 1] = (normalized >> 8) & 0xff;
}

function stopMediaStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export default registerWebModule(MurmurAudioModule, "MurmurAudio");
