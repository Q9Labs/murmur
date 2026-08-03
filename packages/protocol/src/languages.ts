export type LanguageCode =
  | "ar"
  | "de"
  | "en"
  | "es"
  | "fr"
  | "hi"
  | "it"
  | "ja"
  | "ko"
  | "nl"
  | "pt-BR"
  | "ru"
  | "zh-Hans";

export const autoSourceLanguageCode = "auto" as const;

export type SourceLanguageCode = LanguageCode | typeof autoSourceLanguageCode;

export type LanguageDefinition = {
  app_code: LanguageCode;
  dialect_or_variant_notes: string;
  display_name: string;
  expected_translation_notes: string;
  native_name: string;
  rtl: boolean;
  script: string;
  smoke_test_source_phrase: string;
};

export const languageRegistry = [
  {
    app_code: "en",
    dialect_or_variant_notes: "Default launch mode is general English.",
    display_name: "English",
    expected_translation_notes: "Use as the baseline source speech for smoke tests.",
    native_name: "English",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "Where is the train station?",
  },
  {
    app_code: "ar",
    dialect_or_variant_notes: "Launch default is Modern Standard Arabic until dialect handling is verified.",
    display_name: "Arabic",
    expected_translation_notes: "Arabic output must render RTL correctly with punctuation and numbers.",
    native_name: "العربية",
    rtl: true,
    script: "Arab",
    smoke_test_source_phrase: "أين محطة القطار؟",
  },
  {
    app_code: "es",
    dialect_or_variant_notes: "Launch default is general Spanish; regional variants are not exposed in V1.",
    display_name: "Spanish",
    expected_translation_notes: "Preserve formal/informal tone when present.",
    native_name: "Español",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "¿Dónde está la estación de tren?",
  },
  {
    app_code: "fr",
    dialect_or_variant_notes: "Launch default is France-oriented French.",
    display_name: "French",
    expected_translation_notes: "Preserve politeness and names.",
    native_name: "Français",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "Où est la gare ?",
  },
  {
    app_code: "de",
    dialect_or_variant_notes: "Launch default is standard German.",
    display_name: "German",
    expected_translation_notes: "Preserve compound nouns and formal address when present.",
    native_name: "Deutsch",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "Wo ist der Bahnhof?",
  },
  {
    app_code: "it",
    dialect_or_variant_notes: "Launch default is standard Italian.",
    display_name: "Italian",
    expected_translation_notes: "Preserve polite travel phrasing.",
    native_name: "Italiano",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "Dov'è la stazione ferroviaria?",
  },
  {
    app_code: "pt-BR",
    dialect_or_variant_notes: "Launch Portuguese default is Brazilian Portuguese.",
    display_name: "Portuguese",
    expected_translation_notes: "Use Brazilian Portuguese phrasing by default.",
    native_name: "Português",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "Onde fica a estação de trem?",
  },
  {
    app_code: "ja",
    dialect_or_variant_notes: "Launch default is standard Japanese.",
    display_name: "Japanese",
    expected_translation_notes: "Preserve polite form for travel requests.",
    native_name: "日本語",
    rtl: false,
    script: "Jpan",
    smoke_test_source_phrase: "駅はどこですか？",
  },
  {
    app_code: "zh-Hans",
    dialect_or_variant_notes: "Launch Chinese target is Simplified Chinese.",
    display_name: "Chinese",
    expected_translation_notes: "Use Simplified Chinese characters.",
    native_name: "简体中文",
    rtl: false,
    script: "Hans",
    smoke_test_source_phrase: "火车站在哪里？",
  },
  {
    app_code: "ko",
    dialect_or_variant_notes: "Launch default is standard Korean.",
    display_name: "Korean",
    expected_translation_notes: "Preserve polite form.",
    native_name: "한국어",
    rtl: false,
    script: "Kore",
    smoke_test_source_phrase: "기차역이 어디에 있나요?",
  },
  {
    app_code: "ru",
    dialect_or_variant_notes: "Launch default is standard Russian.",
    display_name: "Russian",
    expected_translation_notes: "Preserve names and numbers.",
    native_name: "Русский",
    rtl: false,
    script: "Cyrl",
    smoke_test_source_phrase: "Где находится железнодорожная станция?",
  },
  {
    app_code: "hi",
    dialect_or_variant_notes: "Launch default is standard Hindi.",
    display_name: "Hindi",
    expected_translation_notes: "Preserve respectful travel phrasing.",
    native_name: "हिन्दी",
    rtl: false,
    script: "Deva",
    smoke_test_source_phrase: "रेलवे स्टेशन कहाँ है?",
  },
  {
    app_code: "nl",
    dialect_or_variant_notes: "Launch default is standard Dutch.",
    display_name: "Dutch",
    expected_translation_notes: "Required smoke-test language; preserve natural Dutch word order.",
    native_name: "Nederlands",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "Waar is het treinstation?",
  },
] as const satisfies readonly LanguageDefinition[];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === "string" && languageRegistry.some((item) => item.app_code === value);
}

export function isSourceLanguageCode(value: unknown): value is SourceLanguageCode {
  return value === autoSourceLanguageCode || isLanguageCode(value);
}

export function getLanguage(appCode: LanguageCode): LanguageDefinition {
  const language = languageRegistry.find((item) => item.app_code === appCode);
  if (!language) {
    throw new Error(`Unsupported language: ${appCode}`);
  }
  return language;
}
