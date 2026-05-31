import { buildBackendUrl } from "@/services/backend";

// Using native fetch instead of ai SDK to avoid Node.js dependencies

interface StreamingState {
  isStreaming: boolean;
  fullTranslation: string;
  buffer: string;
}

interface TranslationResponse {
  readonly translation?: unknown;
  readonly text?: unknown;
  readonly content?: unknown;
  readonly chunk?: unknown;
  readonly choices?: ReadonlyArray<{
    readonly delta?: { readonly content?: unknown };
    readonly message?: { readonly content?: unknown };
  }>;
}

export class TranslationService {
  private readonly apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    if (!apiBaseUrl || apiBaseUrl.trim() === "") {
      throw new Error("TranslationService: backend URL is required");
    }
    this.apiBaseUrl = apiBaseUrl;
  }

  private async translateOnce(
    text: string,
    targetLanguage: string,
  ): Promise<string> {
    try {
      if (!text || !targetLanguage) {
        throw new Error("Text and targetLanguage are required");
      }

      const response = await fetch(
        buildBackendUrl(this.apiBaseUrl, "/translate"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            targetLanguage,
            stream: false,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Murmur backend translation error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as TranslationResponse;
      const content = this.extractTranslationContent(data);
      if (!content) {
        throw new Error("Murmur backend returned empty translation");
      }

      return content;
    } catch (error) {
      console.error("[TranslationService] Error in translateOnce:", error);
      throw error;
    }
  }

  /**
   * Parses Server-Sent Events (SSE) format responses from the Murmur backend.
   * Handles incomplete messages and multi-line JSON structures.
   */
  private parseSSELine(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("data: ")) {
      return null;
    }

    const data = trimmed.slice(6).trim();

    // Skip completion marker
    if (data === "[DONE]") {
      return null;
    }

    // Try to parse JSON and extract content. Plain text data is also accepted
    // so the backend can avoid leaking provider-specific response shapes.
    try {
      const parsed = JSON.parse(data) as TranslationResponse;
      return this.extractTranslationContent(parsed);
    } catch {
      return data;
    }
  }

  private extractTranslationContent(
    data: TranslationResponse | string,
  ): string | null {
    if (typeof data === "string") {
      return data || null;
    }

    const content =
      data.chunk ??
      data.translation ??
      data.text ??
      data.content ??
      data.choices?.[0]?.delta?.content ??
      data.choices?.[0]?.message?.content;

    return typeof content === "string" && content.length > 0 ? content : null;
  }

  /**
   * Processes incoming data chunks and extracts complete SSE messages.
   * Properly handles multi-line messages and incomplete data.
   */
  private processSseChunk(
    chunk: string,
    buffer: string,
    onChunk: (chunk: string) => void,
  ): string {
    // Combine buffer with new chunk
    const combined = buffer + chunk;
    
    // Split by newlines but preserve incomplete lines in buffer
    // Support both \n and \r\n
    const lines = combined.split(/\r?\n/);

    // Last line might be incomplete - keep it in buffer
    const lastLine = lines[lines.length - 1];
    const completeLines = lines.slice(0, -1);

    // Process complete lines
    for (const line of completeLines) {
      if (!line.trim()) continue;
      
      const content = this.parseSSELine(line);
      if (content) {
        onChunk(content);
      }
    }

    // Return incomplete last line as new buffer
    return lastLine;
  }

  async translateStream(
    text: string,
    targetLanguage: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullText: string) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    const state: StreamingState = {
      isStreaming: false,
      fullTranslation: "",
      buffer: "",
    };

    try {
      // Validate inputs
      if (!text || !targetLanguage) {
        throw new Error("Text and targetLanguage are required");
      }

      if (!onChunk || !onComplete || !onError) {
        throw new Error("Callbacks are required");
      }

      state.isStreaming = true;

      let response: Response | null = null;
      try {
        response = await fetch(
          buildBackendUrl(this.apiBaseUrl, "/translate"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text,
              targetLanguage,
              stream: true,
            }),
          },
        );
      } catch (fetchError) {
        console.error("[TranslationService] Network error:", fetchError);
        throw new Error("Network error: Failed to reach translation service");
      }

      if (!response || !response.ok) {
        throw new Error(
          `Murmur backend translation error: ${response?.status ?? "unknown"} ${response?.statusText ?? "Unknown error"}`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        // Fallback to non-streaming if body is unavailable
        try {
          const fullText = await this.translateOnce(text, targetLanguage);
          onChunk(fullText);
          state.fullTranslation = fullText;
          onComplete(fullText);
          state.isStreaming = false;
        } catch (fallbackError) {
          throw fallbackError;
        }
        return;
      }

      const decoder = new TextDecoder();

      // Read stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining buffer content
          if (state.buffer && state.buffer.trim()) {
            const content = this.parseSSELine(state.buffer);
            if (content) {
              state.fullTranslation += content;
              try {
                onChunk(content);
              } catch (callbackError) {
                console.error(
                  "[TranslationService] Error in onChunk callback:",
                  callbackError,
                );
              }
            }
          }
          break;
        }

        // Decode chunk and process SSE lines
        try {
          const chunk = decoder.decode(value, { stream: true });
          state.buffer = this.processSseChunk(
            chunk,
            state.buffer,
            (processedChunk) => {
              state.fullTranslation += processedChunk;
              // Call the user's callback immediately with each chunk
              try {
                onChunk(processedChunk);
              } catch (callbackError) {
                console.error(
                  "[TranslationService] Error in onChunk callback:",
                  callbackError,
                );
              }
            },
          );
        } catch (decodeError) {
          console.error(
            "[TranslationService] Error decoding chunk:",
            decodeError,
          );
          throw new Error("Failed to decode translation response");
        }
      }

      state.isStreaming = false;
      try {
        onComplete(state.fullTranslation);
      } catch (callbackError) {
        console.error(
          "[TranslationService] Error in onComplete callback:",
          callbackError,
        );
      }
    } catch (error) {
      state.isStreaming = false;
      try {
        onError(error instanceof Error ? error : new Error(String(error)));
      } catch (callbackError) {
        console.error(
          "[TranslationService] Error in onError callback:",
          callbackError,
        );
      }
    }
  }

  /**
   * Get current streaming state (useful for debugging)
   */
  getStreamingState(): StreamingState {
    return {
      isStreaming: false,
      fullTranslation: "",
      buffer: "",
    };
  }
}
