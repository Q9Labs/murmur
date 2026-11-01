import { isLanguageCode, type LanguageCode } from "@murmur/protocol/languages";

type DeviceLocale = { languageCode: string | null; languageTag: string };

// First-run translation target: the device's preferred language, so a new user
// hears translations in the language they actually read. English is skipped
// because the default source is already English and a same-language pair can't
// start a session; anything unsupported falls back to the launch default.
export function defaultTargetLanguage(
  deviceLocales: readonly DeviceLocale[],
  fallback: LanguageCode = "ar",
): LanguageCode {
  for (const deviceLocale of deviceLocales) {
    const language = (deviceLocale.languageCode ?? deviceLocale.languageTag.split("-")[0] ?? "").toLowerCase();
    const candidate = language === "pt" ? "pt-BR" : language;
    if (candidate === "en") {
      continue;
    }
    if (isLanguageCode(candidate)) {
      return candidate;
    }
  }
  return fallback;
}
