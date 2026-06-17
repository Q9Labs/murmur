import {
  autoSourceLanguageCode,
  getLanguage,
} from "../../../lib/languages";
import type { TranslationRequest } from "../../../lib/transport/types";
import {
  buildInterpreterSystemPrompt,
  buildInterpreterUserPrompt,
  buildPreviewGateSystemPrompt,
  buildPreviewGateUserPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  shouldUseTargetActionProtocol,
} from "../translation/prompts";
import type { ChatCompletionPayload } from "./types";

export function buildGroqChatPayload(request: TranslationRequest): ChatCompletionPayload {
  const sourceLanguageName =
    request.source_language === autoSourceLanguageCode
      ? "the detected source language"
      : getLanguage(request.source_language).openrouter_source_name;
  const targetLanguage = getLanguage(request.target_language);
  const useTargetActionProtocol = shouldUseTargetActionProtocol(request);
  return {
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content: useTargetActionProtocol
          ? buildInterpreterSystemPrompt(sourceLanguageName, targetLanguage.openrouter_target_name)
          : buildSystemPrompt(
              sourceLanguageName,
              targetLanguage.openrouter_target_name,
            ),
      },
      {
        role: "user",
        content: useTargetActionProtocol
          ? buildInterpreterUserPrompt(request)
          : buildUserPrompt(request),
      },
    ],
    temperature: useTargetActionProtocol ? 0 : 0.1,
    max_tokens: 300,
    stream: true,
    reasoning_effort: "low",
    include_reasoning: false,
  };
}

export function buildGroqPreviewChatPayload(request: TranslationRequest): ChatCompletionPayload {
  const sourceLanguageName =
    request.source_language === autoSourceLanguageCode
      ? "the detected source language"
      : getLanguage(request.source_language).openrouter_source_name;
  const targetLanguage = getLanguage(request.target_language);
  return {
    model: "openai/gpt-oss-20b",
    messages: [
      {
        role: "system",
        content: buildPreviewGateSystemPrompt(sourceLanguageName, targetLanguage.openrouter_target_name),
      },
      {
        role: "user",
        content: buildPreviewGateUserPrompt(request),
      },
    ],
    temperature: 0,
    max_tokens: 96,
    stream: true,
    reasoning_effort: "low",
    include_reasoning: false,
  };
}
