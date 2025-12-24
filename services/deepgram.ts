/**
 * DeepgramService - Real-time speech-to-text streaming with VAD and turn detection
 *
 * Uses native WebSocket instead of @deepgram/sdk to avoid Node.js dependencies.
 * Leverages Deepgram's built-in VAD via `speech_final` and `utterance_end_ms` for turn detection.
 */

// =============================================================================
// Types & Interfaces
// =============================================================================

/** Deepgram transcription alternative */
interface DeepgramAlternative {
  readonly transcript: string;
  readonly confidence: number;
  readonly words?: ReadonlyArray<{
    readonly word: string;
    readonly start: number;
    readonly end: number;
    readonly confidence: number;
  }>;
}

/** Deepgram channel data */
interface DeepgramChannel {
  readonly alternatives: ReadonlyArray<DeepgramAlternative>;
}

/** Deepgram transcript result message */
interface DeepgramTranscriptMessage {
  readonly type: 'Results';
  readonly channel_index: readonly [number, number];
  readonly duration: number;
  readonly start: number;
  readonly is_final: boolean;
  readonly speech_final: boolean;
  readonly channel: DeepgramChannel;
}

/** Deepgram utterance end message - sent when word-timing gap exceeds threshold */
interface DeepgramUtteranceEndMessage {
  readonly type: 'UtteranceEnd';
  readonly channel: readonly [number, number];
  readonly last_word_end: number;
}

/** Deepgram metadata message - sent on connection */
interface DeepgramMetadataMessage {
  readonly type: 'Metadata';
  readonly transaction_key: string;
  readonly request_id: string;
  readonly sha256: string;
  readonly created: string;
  readonly duration: number;
  readonly channels: number;
  readonly models: readonly string[];
}

/** Union type for all Deepgram WebSocket messages */
type DeepgramMessage =
  | DeepgramTranscriptMessage
  | DeepgramUtteranceEndMessage
  | DeepgramMetadataMessage;

/** Callback interface for DeepgramService consumers */
export interface DeepgramCallbacks {
  /**
   * Called for each transcript segment received.
   * @param text - The transcribed text
   * @param isFinal - Whether this is a finalized segment (won't be revised)
   */
  readonly onTranscript: (text: string, isFinal: boolean) => void;

  /**
   * Called when Deepgram detects the user has finished speaking (speech_final=true).
   * This is the primary trigger for initiating translation.
   * @param fullTranscript - The complete accumulated transcript
   */
  readonly onSpeechFinal: (fullTranscript: string) => void;

  /**
   * Called when Deepgram sends an UtteranceEnd message.
   * This is a fallback trigger for translation when speech_final is unreliable
   * (e.g., background noise preventing silence detection).
   */
  readonly onUtteranceEnd: () => void;

  /**
   * Optional callback for VAD speaking state changes.
   * Useful for UI feedback (e.g., showing "Speaking..." indicator).
   * @param isSpeaking - Whether the user is currently speaking
   */
  readonly onSpeakingChange?: (isSpeaking: boolean) => void;

  /**
   * Called when an error occurs.
   * @param error - The error that occurred
   */
  readonly onError: (error: Error) => void;
}

/** Deepgram streaming configuration */
interface DeepgramConfig {
  /** Deepgram model to use (default: nova-2) */
  readonly model: string;
  /** Language code or 'multi' for auto-detect (default: multi) */
  readonly language: string;
  /** Enable smart formatting (default: true) */
  readonly smartFormat: boolean;
  /** Enable punctuation (default: true) */
  readonly punctuate: boolean;
  /** Enable interim results for real-time feedback (default: true) */
  readonly interimResults: boolean;
  /** Silence duration (ms) to trigger speech_final (default: 800) */
  readonly endpointing: number;
  /** Word-timing gap (ms) to trigger UtteranceEnd (default: 1500) */
  readonly utteranceEndMs: number;
  /** Audio encoding (default: linear16) */
  readonly encoding: string;
  /** Audio sample rate in Hz (default: 16000) */
  readonly sampleRate: number;
}

/** Default configuration values */
const DEFAULT_CONFIG: DeepgramConfig = {
  model: 'nova-2',
  language: 'multi',
  smartFormat: true,
  punctuate: true,
  interimResults: true,
  endpointing: 800,
  utteranceEndMs: 1500,
  encoding: 'linear16',
  sampleRate: 16000,
} as const;

// =============================================================================
// DeepgramService Class
// =============================================================================

export class DeepgramService {
  private ws: WebSocket | null = null;
  private readonly apiKey: string;
  private readonly config: DeepgramConfig;

  // State tracking for transcript accumulation
  private accumulatedTranscript: string = '';
  private lastSpeechFinalHandled: boolean = false;
  private isSpeaking: boolean = false;

  constructor(apiKey: string, config: Partial<DeepgramConfig> = {}) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('DeepgramService: API key is required');
    }

    this.apiKey = apiKey;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Starts streaming audio to Deepgram with VAD and turn detection.
   *
   * @param callbacks - Callback functions for handling events
   * @returns Promise resolving to the WebSocket instance
   */
  async startStreaming(callbacks: DeepgramCallbacks): Promise<WebSocket> {
    // Reset state for new session
    this.resetState();

    return new Promise((resolve, reject) => {
      try {
        const url = this.buildWebSocketUrl();
        this.ws = new WebSocket(url, ['token', this.apiKey]);

        this.ws.onopen = (): void => {
          console.log('[Deepgram] Connection opened');
          resolve(this.ws!);
        };

        this.ws.onmessage = (event: MessageEvent): void => {
          this.handleMessage(event, callbacks);
        };

        this.ws.onerror = (event: Event): void => {
          console.error('[Deepgram] WebSocket error:', event);
          const error = new Error(
            'Deepgram WebSocket connection failed. Check your API key and network connection.'
          );
          callbacks.onError(error);
          reject(error);
        };

        this.ws.onclose = (event: CloseEvent): void => {
          this.handleClose(event, callbacks);
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        callbacks.onError(err);
        reject(err);
      }
    });
  }

  /**
   * Sends audio data to Deepgram.
   * Audio should be PCM 16-bit, 16kHz mono.
   *
   * @param audioData - Raw PCM audio data as ArrayBuffer
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.ws) {
      console.warn('[Deepgram] Cannot send audio: WebSocket not initialized');
      return;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.warn(
        '[Deepgram] Cannot send audio: WebSocket not open (state: %d)',
        this.ws.readyState
      );
      return;
    }

    this.ws.send(audioData);
  }

  /**
   * Stops the Deepgram streaming session and closes the WebSocket.
   */
  stop(): void {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        // Send close frame for graceful shutdown
        this.ws.close(1000, 'Client requested close');
      }
      this.ws = null;
    }
    this.resetState();
    console.log('[Deepgram] Connection stopped');
  }

  /**
   * Returns the current accumulated transcript.
   */
  getAccumulatedTranscript(): string {
    return this.accumulatedTranscript.trim();
  }

  /**
   * Clears the accumulated transcript buffer.
   * Call this after translation is triggered to start fresh.
   */
  clearAccumulatedTranscript(): void {
    this.accumulatedTranscript = '';
    this.lastSpeechFinalHandled = false;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private buildWebSocketUrl(): string {
    const params = new URLSearchParams({
      model: this.config.model,
      language: this.config.language,
      smart_format: String(this.config.smartFormat),
      punctuate: String(this.config.punctuate),
      interim_results: String(this.config.interimResults),
      endpointing: String(this.config.endpointing),
      utterance_end_ms: String(this.config.utteranceEndMs),
      encoding: this.config.encoding,
      sample_rate: String(this.config.sampleRate),
    });

    return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  }

  private resetState(): void {
    this.accumulatedTranscript = '';
    this.lastSpeechFinalHandled = false;
    this.isSpeaking = false;
  }

  private handleMessage(event: MessageEvent, callbacks: DeepgramCallbacks): void {
    try {
      const data = JSON.parse(event.data as string) as DeepgramMessage;

      switch (data.type) {
        case 'Results':
          this.handleTranscriptMessage(data, callbacks);
          break;

        case 'UtteranceEnd':
          this.handleUtteranceEnd(data, callbacks);
          break;

        case 'Metadata':
          console.log('[Deepgram] Session metadata received:', data.request_id);
          break;

        default:
          // Unknown message type - log for debugging
          console.log('[Deepgram] Unknown message type:', (data as { type?: string }).type);
      }
    } catch {
      // Non-JSON messages (keepalives, etc.) - silently ignore
    }
  }

  private handleTranscriptMessage(
    data: DeepgramTranscriptMessage,
    callbacks: DeepgramCallbacks
  ): void {
    const alternative = data.channel?.alternatives?.[0];
    if (!alternative) return;

    const transcript = alternative.transcript;
    const isEmpty = !transcript || transcript.trim() === '';

    // Update speaking state based on receiving non-empty transcripts
    if (!isEmpty && !this.isSpeaking) {
      this.isSpeaking = true;
      callbacks.onSpeakingChange?.(true);
    }

    // Always emit transcript (even interim) for real-time display
    if (!isEmpty) {
      callbacks.onTranscript(transcript, data.is_final);
    }

    // Accumulate finalized transcripts only (not interim results)
    if (data.is_final && !isEmpty) {
      // Add space between segments if needed
      if (this.accumulatedTranscript && !this.accumulatedTranscript.endsWith(' ')) {
        this.accumulatedTranscript += ' ';
      }
      this.accumulatedTranscript += transcript;
    }

    // Handle speech_final - user has finished speaking
    if (data.speech_final) {
      this.isSpeaking = false;
      callbacks.onSpeakingChange?.(false);

      const fullTranscript = this.accumulatedTranscript.trim();
      if (fullTranscript && !this.lastSpeechFinalHandled) {
        this.lastSpeechFinalHandled = true;
        callbacks.onSpeechFinal(fullTranscript);
      }
    }
  }

  private handleUtteranceEnd(
    _data: DeepgramUtteranceEndMessage,
    callbacks: DeepgramCallbacks
  ): void {
    console.log('[Deepgram] UtteranceEnd received');

    // Update speaking state
    if (this.isSpeaking) {
      this.isSpeaking = false;
      callbacks.onSpeakingChange?.(false);
    }

    // Only trigger if we haven't already handled via speech_final
    // This is a fallback for noisy environments
    if (!this.lastSpeechFinalHandled && this.accumulatedTranscript.trim()) {
      callbacks.onUtteranceEnd();
    }
  }

  private handleClose(event: CloseEvent, callbacks: DeepgramCallbacks): void {
    console.log('[Deepgram] Connection closed:', event.code, event.reason || '(no reason)');

    // Update speaking state on close
    if (this.isSpeaking) {
      this.isSpeaking = false;
      callbacks.onSpeakingChange?.(false);
    }

    // Only report abnormal closures as errors
    // 1000 = normal closure, 1005 = no status received (also normal in some cases)
    if (event.code !== 1000 && event.code !== 1005) {
      callbacks.onError(
        new Error(
          `Deepgram connection closed unexpectedly: ${event.code} ${event.reason || 'Unknown reason'}`
        )
      );
    }
  }
}
