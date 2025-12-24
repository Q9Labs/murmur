// Using native WebSocket instead of @deepgram/sdk to avoid Node.js dependencies

export class DeepgramService {
  private ws: WebSocket | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async startStreaming(
    onTranscript: (text: string) => void,
    onError: (error: Error) => void
  ): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL with query parameters
        const params = new URLSearchParams({
          model: 'nova-2',
          language: 'multi',
          smart_format: 'true',
          punctuate: 'true',
          interim_results: 'true',
          endpointing: '300',
          encoding: 'linear16',
          sample_rate: '16000',
        });

        const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

        // For React Native client-side apps, use Sec-WebSocket-Protocol for authentication
        // Format: ['token', 'YOUR_API_KEY']
        this.ws = new WebSocket(url, ['token', this.apiKey]);

        this.ws.onopen = () => {
          console.log('Deepgram connection opened');
          resolve(this.ws!);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string);
            const transcript = data.channel?.alternatives?.[0]?.transcript;
            if (transcript && transcript.trim() !== '') {
              onTranscript(transcript);
            }
          } catch (e) {
            // Ignore non-JSON messages (like keepalive)
          }
        };

        this.ws.onerror = (event: Event) => {
          console.error('Deepgram WebSocket error event:', event);
          const error = new Error('Deepgram WebSocket connection failed. Check your API key and network connection.');
          onError(error);
          reject(error);
        };

        this.ws.onclose = (event: CloseEvent) => {
          console.log('Deepgram connection closed:', event.code, event.reason);
          if (event.code !== 1000 && event.code !== 1005) {
            // Abnormal closure
            onError(new Error(`Deepgram connection closed unexpectedly: ${event.code} ${event.reason || 'Unknown reason'}`));
          }
        };
      } catch (error) {
        onError(error as Error);
        reject(error);
      }
    });
  }

  sendAudio(audioData: ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }

  stop() {
    if (this.ws) {
      // Send close message to Deepgram
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
