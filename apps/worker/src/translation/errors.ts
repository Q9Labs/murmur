import type { TranslationRequest } from "@murmur/protocol/transport/types";

export function getTranslationErrorCode(error: unknown): string {
  if (!(error instanceof Error)) {
    return "translation_failed";
  }
  if (error.message.startsWith("openrouter_http_") || error.message.startsWith("groq_http_")) {
    return error.message;
  }
  if (
    [
      "groq_empty_translation",
      "groq_network_error",
      "groq_stream_error",
      "groq_stream_incomplete",
      "groq_stream_read_failed",
      "groq_suspiciously_short_translation",
      "groq_timeout",
      "groq_wait_for_final_source",
      "missing_groq_api_key",
      "openrouter_network_error",
      "openrouter_empty_translation",
      "openrouter_stream_incomplete",
      "openrouter_stream_error",
      "openrouter_stream_read_failed",
      "openrouter_suspiciously_short_translation",
      "openrouter_timeout",
      "openrouter_wait_for_final_source",
      "missing_openrouter_api_key",
    ].includes(error.message)
  ) {
    return error.message;
  }
  return "translation_failed";
}

export function validateTranslatedCaption(
  request: TranslationRequest,
  translatedCaption: string,
  errorPrefix = "openrouter",
): string {
  const trimmedCaption = translatedCaption.trim();
  if (!trimmedCaption) {
    throw new Error(`${errorPrefix}_empty_translation`);
  }
  if (request.source_caption.trim().length >= 80 && trimmedCaption.length < 4) {
    throw new Error(`${errorPrefix}_suspiciously_short_translation`);
  }
  return translatedCaption;
}
