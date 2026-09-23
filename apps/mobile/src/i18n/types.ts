export const uiLocales = ["en", "ar", "hi", "es", "fr", "ur", "pt-BR", "de", "id", "tr", "ja"] as const;

export type UiLocale = (typeof uiLocales)[number];
export type UiDirection = "ltr" | "rtl";
export type UiLocalePreference = "system" | UiLocale;

type DeviceLocale = { languageCode: string | null; languageTag: string };

const rtlLocales: ReadonlySet<UiLocale> = new Set(["ar", "ur"]);

// Intl tags per UI locale. Arabic keeps Hasan's Eastern Arabic-Indic digits.
const intlTags: { readonly [Locale in UiLocale]: string } = {
  ar: "ar-u-nu-arab",
  de: "de",
  en: "en",
  es: "es",
  fr: "fr",
  hi: "hi",
  id: "id",
  ja: "ja",
  "pt-BR": "pt-BR",
  tr: "tr",
  ur: "ur",
};

export function isUiLocale(value: unknown): value is UiLocale {
  return uiLocales.some((locale) => locale === value);
}

export function isUiLocalePreference(value: unknown): value is UiLocalePreference {
  return value === "system" || isUiLocale(value);
}

export function directionForLocale(locale: UiLocale): UiDirection {
  if (!isUiLocale(locale)) {
    throw new RangeError(`Unsupported UI locale: ${String(locale)}`);
  }
  return rtlLocales.has(locale) ? "rtl" : "ltr";
}

export function intlLocaleTag(locale: UiLocale): string {
  return intlTags[locale];
}

// Picks the first device language Murmur ships. Portuguese of any region uses pt-BR.
export function matchUiLocale(deviceLocales: readonly DeviceLocale[]): UiLocale {
  for (const deviceLocale of deviceLocales) {
    const language = (deviceLocale.languageCode ?? deviceLocale.languageTag.split("-")[0] ?? "").toLowerCase();
    if (language === "pt") {
      return "pt-BR";
    }
    if (isUiLocale(language)) {
      return language;
    }
  }
  return "en";
}

export function resolveUiLocale(
  preference: UiLocalePreference,
  deviceLocales: readonly DeviceLocale[],
): UiLocale {
  return preference === "system" ? matchUiLocale(deviceLocales) : preference;
}
