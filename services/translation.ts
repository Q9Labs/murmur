import { streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export class TranslationService {
  private provider: ReturnType<typeof createOpenRouter>;

  constructor(apiKey: string) {
    this.provider = createOpenRouter({
      apiKey,
    });
  }

  async translateStream(
    text: string,
    targetLanguage: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullText: string) => void,
    onError: (error: Error) => void
  ) {
    try {
      const result = await streamText({
        model: this.provider.chat('anthropic/claude-3.5-haiku'),
        prompt: `Translate the following text to ${targetLanguage}. Only provide the translation, no explanations or additional text:\n\n${text}`,
        temperature: 0.3,
      });

      let fullTranslation = '';

      for await (const chunk of result.textStream) {
        fullTranslation += chunk;
        onChunk(chunk);
      }

      onComplete(fullTranslation);
    } catch (error) {
      onError(error as Error);
    }
  }
}
