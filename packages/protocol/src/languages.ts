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
  cartesia_language: string;
  cartesia_voice_id: string | null;
  deepgram_language: string;
  dialect_or_variant_notes: string;
  display_name: string;
  expected_translation_notes: string;
  fallback_tts_voice_id: string | null;
  native_name: string;
  openrouter_label: string;
  openrouter_source_name: string;
  openrouter_target_name: string;
  rtl: boolean;
  script: string;
  smoke_test_source_phrase: string;
  default_voice_id: string | null;
};

export const languageRegistry = [
  {
    app_code: "en",
    cartesia_language: "en",
    cartesia_voice_id: null,
    deepgram_language: "en",
    default_voice_id: null,
    dialect_or_variant_notes: "Default launch mode is general English.",
    display_name: "English",
    expected_translation_notes: "Use as the baseline source phrase for smoke tests.",
    fallback_tts_voice_id: null,
    native_name: "English",
    openrouter_label: "English",
    openrouter_source_name: "English",
    openrouter_target_name: "English",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "Where is the train station?",
  },
  {
    app_code: "ar",
    cartesia_language: "ar",
    cartesia_voice_id: null,
    deepgram_language: "ar",
    default_voice_id: null,
    dialect_or_variant_notes: "Launch default is Modern Standard Arabic until dialect handling is verified.",
    display_name: "Arabic",
    expected_translation_notes: "Arabic output must render RTL correctly with punctuation and numbers.",
    fallback_tts_voice_id: null,
    native_name: "العربية",
    openrouter_label: "Arabic",
    openrouter_source_name: "Arabic",
    openrouter_target_name: "Arabic",
    rtl: true,
    script: "Arab",
    smoke_test_source_phrase: "أين محطة القطار؟",
  },
  {
    app_code: "es",
    cartesia_language: "es",
    cartesia_voice_id: null,
    deepgram_language: "es",
    default_voice_id: null,
    dialect_or_variant_notes: "Launch default is general Spanish; regional variants are not exposed in V1.",
    display_name: "Spanish",
    expected_translation_notes: "Preserve formal/informal tone when present.",
    fallback_tts_voice_id: null,
    native_name: "Español",
    openrouter_label: "Spanish",
    openrouter_source_name: "Spanish",
    openrouter_target_name: "Spanish",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "¿Dónde está la estación de tren?",
  },
  {
    app_code: "fr",
    cartesia_language: "fr",
    cartesia_voice_id: null,
    deepgram_language: "fr",
    default_voice_id: null,
    dialect_or_variant_notes: "Launch default is France-oriented French.",
    display_name: "French",
    expected_translation_notes: "Preserve politeness and names.",
    fallback_tts_voice_id: null,
    native_name: "Français",
    openrouter_label: "French",
    openrouter_source_name: "French",
    openrouter_target_name: "French",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "Où est la gare ?",
  },
  {
    app_code: "de",
    cartesia_language: "de",
    cartesia_voice_id: null,
    deepgram_language: "de",
    default_voice_id: null,
    dialect_or_variant_notes: "Launch default is standard German.",
    display_name: "German",
    expected_translation_notes: "Preserve compound nouns and formal address when present.",
    fallback_tts_voice_id: null,
    native_name: "Deutsch",
    openrouter_label: "German",
    openrouter_source_name: "German",
    openrouter_target_name: "German",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "Wo ist der Bahnhof?",
  },
  {
    app_code: "it",
    cartesia_language: "it",
    cartesia_voice_id: null,
    deepgram_language: "it",
    default_voice_id: null,
    dialect_or_variant_notes: "Launch default is standard Italian.",
    display_name: "Italian",
    expected_translation_notes: "Preserve polite travel phrasing.",
    fallback_tts_voice_id: null,
    native_name: "Italiano",
    openrouter_label: "Italian",
    openrouter_source_name: "Italian",
    openrouter_target_name: "Italian",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "Dov'è la stazione ferroviaria?",
  },
  {
    app_code: "pt-BR",
    cartesia_language: "pt",
    cartesia_voice_id: null,
    deepgram_language: "pt",
    default_voice_id: null,
    dialect_or_variant_notes: "Launch Portuguese default is Brazilian Portuguese.",
    display_name: "Portuguese",
    expected_translation_notes: "Use Brazilian Portuguese phrasing by default.",
    fallback_tts_voice_id: null,
    native_name: "Português",
    openrouter_label: "Brazilian Portuguese",
    openrouter_source_name: "Brazilian Portuguese",
    openrouter_target_name: "Brazilian Portuguese",
    rtl: false,
    script: "Latn",
    smoke_test_source_phrase: "Onde fica a estação de trem?",
  },
  {
    app_code: "ja",
    cartesia_language: "ja",
    cartesia_voice_id: null,
    deepgram_language: "ja",
    default_voice_id: null,
    dialect_or_variant_notes: "Launch default is standard Japanese.",
    display_name: "Japanese",
    expected_translation_notes: "Preserve polite form for travel requests.",
    fallback_tts_voice_id: null,
    native_name: "日本語",
    openrouter_label: "Japanese",
    openrouter_source_name: "Japanese",
    openrouter_target_name: "Japanese",
    rtl: false,
    script: "Jpan",
    smoke_test_source_phrase: "駅はどこですか？",
  },
  {
    app_code: "zh-Hans",
    cartesia_language: "zh",
    cartesia_voice_id: null,
    deepgram_language: "zh",
    default_voice_id: null,
    dialect_or_variant_notes: "Launch Chinese target is Simplified Chinese.",
    display_name: "Chinese",
    expected_translation_notes: "Use Simplified Chinese characters.",
    fallback_tts_voice_id: null,
    native_name: "简体中文",
    openrouter_label: "Simplified Chinese",
    openrouter_source_name: "Simplified Chinese",
    openrouter_target_name: "Simplified Chinese",
    rtl: false,
    script: "Hans",
    smoke_test_source_phrase: "火车站在哪里？",
  },
  {
    app_code: "ko",
    cartesia_language: "ko",
    cartesia_voice_id: null,
    deepgram_language: "ko",
    default_voice_id: null,
    dialect_or_variant_notes: "Launch default is standard Korean.",
    display_name: "Korean",
    expected_translation_notes: "Preserve polite form.",
    fallback_tts_voice_id: null,
    native_name: "한국어",
    openrouter_label: "Korean",
    openrouter_source_name: "Korean",
    openrouter_target_name: "Korean",
    rtl: false,
    script: "Kore",
    smoke_test_source_phrase: "기차역이 어디에 있나요?",
  },
  {
    app_code: "ru",
    cartesia_language: "ru",
    cartesia_voice_id: null,
    deepgram_language: "ru",
    default_voice_id: null,
    dialect_or_variant_notes: "Launch default is standard Russian.",
    display_name: "Russian",
    expected_translation_notes: "Preserve names and numbers.",
    fallback_tts_voice_id: null,
    native_name: "Русский",
    openrouter_label: "Russian",
    openrouter_source_name: "Russian",
    openrouter_target_name: "Russian",
    rtl: false,
    script: "Cyrl",
    smoke_test_source_phrase: "Где находится железнодорожная станция?",
  },
  {
    app_code: "hi",
    cartesia_language: "hi",
    cartesia_voice_id: null,
    deepgram_language: "hi",
    default_voice_id: null,
    dialect_or_variant_notes: "Launch default is standard Hindi.",
    display_name: "Hindi",
    expected_translation_notes: "Preserve respectful travel phrasing.",
    fallback_tts_voice_id: null,
    native_name: "हिन्दी",
    openrouter_label: "Hindi",
    openrouter_source_name: "Hindi",
    openrouter_target_name: "Hindi",
    rtl: false,
    script: "Deva",
    smoke_test_source_phrase: "रेलवे स्टेशन कहाँ है?",
  },
  {
    app_code: "nl",
    cartesia_language: "nl",
    cartesia_voice_id: null,
    deepgram_language: "nl",
    default_voice_id: null,
    dialect_or_variant_notes: "Launch default is standard Dutch.",
    display_name: "Dutch",
    expected_translation_notes: "Required smoke-test language; preserve natural Dutch word order.",
    fallback_tts_voice_id: null,
    native_name: "Nederlands",
    openrouter_label: "Dutch",
    openrouter_source_name: "Dutch",
    openrouter_target_name: "Dutch",
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
