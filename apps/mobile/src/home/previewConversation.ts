// cspell:ignore acompanhar anders chaque cidade ciudad comprend consigo diferente distinta entende entiendes folgen jede jedem parece peux puedo rente siente Stadt Stimme suivre versteht ville
import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";

import type { UiLocale } from "../i18n/types";

export type PreviewConversation = {
  sourceCaption: string;
  sourceLanguage: SourceLanguageCode;
  targetLanguage: LanguageCode;
  translation: string;
};

const englishSourceCaption =
  "Hello, the city feels different when you understand every voice. Now I can follow every conversation live.";

// The default pair: an Arabic speaker translated into English. UI languages that
// Murmur can also translate into show English translated into that language, so
// each localized preview reads naturally. Urdu, Indonesian and Turkish are UI-only
// languages and keep the default pair.
const arabicToEnglish: PreviewConversation = {
  sourceCaption:
    "مرحباً، المدينة تبدو مختلفة عندما تفهم كل صوت. الآن أستطيع متابعة الحديث مباشرة باللغة الإنجليزية.",
  sourceLanguage: "ar",
  targetLanguage: "en",
  translation:
    "Hello, the city feels different when you understand every voice. Now I can follow the conversation live in English.",
};

function fromEnglish(targetLanguage: LanguageCode, translation: string): PreviewConversation {
  return { sourceCaption: englishSourceCaption, sourceLanguage: "en", targetLanguage, translation };
}

const previewConversations: { readonly [Locale in UiLocale]: PreviewConversation } = {
  ar: fromEnglish("ar", "مرحباً، المدينة تبدو مختلفة عندما تفهم كل صوت. الآن أستطيع متابعة كل محادثة مباشرة."),
  de: fromEnglish(
    "de",
    "Hallo, die Stadt fühlt sich anders an, wenn man jede Stimme versteht. Jetzt kann ich jedem Gespräch live folgen.",
  ),
  en: arabicToEnglish,
  es: fromEnglish(
    "es",
    "Hola, la ciudad se siente distinta cuando entiendes cada voz. Ahora puedo seguir cada conversación en directo.",
  ),
  fr: fromEnglish(
    "fr",
    "Bonjour, la ville paraît différente quand on comprend chaque voix. Maintenant, je peux suivre chaque conversation en direct.",
  ),
  hi: fromEnglish(
    "hi",
    "नमस्ते, जब आप हर आवाज़ समझते हैं तो शहर अलग लगता है। अब मैं हर बातचीत को लाइव समझ सकता हूँ।",
  ),
  id: arabicToEnglish,
  ja: fromEnglish("ja", "こんにちは。すべての声がわかると、街が違って見えます。今はどんな会話もその場で追えます。"),
  "pt-BR": fromEnglish(
    "pt-BR",
    "Olá, a cidade parece diferente quando você entende cada voz. Agora consigo acompanhar cada conversa ao vivo.",
  ),
  tr: arabicToEnglish,
  ur: arabicToEnglish,
};

export function previewConversationFor(locale: UiLocale): PreviewConversation {
  return previewConversations[locale];
}
