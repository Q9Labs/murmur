import {
  autoSourceLanguageCode,
  type LanguageCode,
  type SourceLanguageCode,
} from "@murmur/protocol/languages";

export type LanguagePair = {
  source: SourceLanguageCode;
  target: LanguageCode;
};

export function isLanguageEnabled(
  code: LanguageCode,
  enabledLanguages: readonly LanguageCode[] | null,
): boolean {
  return enabledLanguages === null || enabledLanguages.includes(code);
}

export function isLanguagePairEnabled(
  pair: LanguagePair,
  enabledLanguages: readonly LanguageCode[] | null,
): boolean {
  const sourceEnabled = pair.source === autoSourceLanguageCode ||
    isLanguageEnabled(pair.source, enabledLanguages);
  return sourceEnabled && isLanguageEnabled(pair.target, enabledLanguages);
}

// Moves a disabled source or target onto the first enabled language that keeps the pair
// distinct. Auto-detect stays as the source because it is not a language itself.
export function normalizeLanguagePair(
  pair: LanguagePair,
  enabledLanguages: readonly LanguageCode[] | null,
): LanguagePair {
  if (enabledLanguages === null || enabledLanguages.length === 0) {
    return pair;
  }
  const target = isLanguageEnabled(pair.target, enabledLanguages)
    ? pair.target
    : firstEnabledExcept(enabledLanguages, pair.source);
  const source = pair.source === autoSourceLanguageCode || isLanguageEnabled(pair.source, enabledLanguages)
    ? pair.source
    : firstEnabledExcept(enabledLanguages, target);
  return { source, target };
}

function firstEnabledExcept(
  enabledLanguages: readonly LanguageCode[],
  excluded: SourceLanguageCode,
): LanguageCode {
  return enabledLanguages.find((code) => code !== excluded) ?? enabledLanguages[0];
}
