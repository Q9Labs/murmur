import {
  isLanguageCode,
  isSourceLanguageCode,
  type LanguageCode,
  type SourceLanguageCode,
} from "@murmur/protocol/languages";

export function parseLanguagePair(
  source: unknown,
  target: unknown,
):
  | { sourceLanguage: SourceLanguageCode; targetLanguage: LanguageCode }
  | { error: string } {
  if (!isSourceLanguageCode(source)) {
    return { error: "unsupported_source_language" };
  }
  if (!isLanguageCode(target)) {
    return { error: "unsupported_target_language" };
  }
  if (source !== "auto" && source === target) {
    return { error: "source_target_must_differ" };
  }
  return {
    sourceLanguage: source,
    targetLanguage: target,
  };
}
