import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

export class DeepgramService {
  private client: any;
  private connection: any;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = createClient(apiKey);
  }

  async startStreaming(
    onTranscript: (text: string) => void,
    onError: (error: Error) => void
  ) {
    try {
      // Create WebSocket connection for live transcription
      this.connection = this.client.listen.live({
        model: 'nova-2',
        language: 'multi', // Multilingual auto-detection
        smart_format: true,
        punctuate: true,
        interim_results: true,
        endpointing: 100, // Recommended for code-switching
        encoding: 'linear16',
        sample_rate: 16000,
      });

      // Handle transcript events
      this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        if (transcript && transcript.trim() !== '') {
          onTranscript(transcript);
        }
      });

      // Handle errors
      this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        onError(new Error(error.message || 'Deepgram error'));
      });

      // Open connection
      this.connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('Deepgram connection opened');
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram connection closed');
      });

      return this.connection;
    } catch (error) {
      onError(error as Error);
      throw error;
    }
  }

  sendAudio(audioData: ArrayBuffer) {
    if (this.connection) {
      this.connection.send(audioData);
    }
  }

  stop() {
    if (this.connection) {
      this.connection.finish();
      this.connection = null;
    }
  }
}
