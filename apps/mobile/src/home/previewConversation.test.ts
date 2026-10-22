import { languageRegistry } from "@murmur/protocol/languages";
import { describe, expect, it } from "vitest";

import { uiLocales, type UiLocale } from "../i18n/types";
import { previewConversationFor, type PreviewConversation } from "./previewConversation";

describe("preview conversation", () => {
  it("keeps each fixed paywall.example label aligned with its preview language pair", () => {
    const labelPairs: { [Locale in UiLocale]: Pick<PreviewConversation, "sourceLanguage" | "targetLanguage"> } = {
      en: { sourceLanguage: "ar", targetLanguage: "en" },
      ar: { sourceLanguage: "en", targetLanguage: "ar" },
      hi: { sourceLanguage: "en", targetLanguage: "hi" },
      es: { sourceLanguage: "en", targetLanguage: "es" },
      fr: { sourceLanguage: "en", targetLanguage: "fr" },
      ur: { sourceLanguage: "ar", targetLanguage: "en" },
      "pt-BR": { sourceLanguage: "en", targetLanguage: "pt-BR" },
      de: { sourceLanguage: "en", targetLanguage: "de" },
      id: { sourceLanguage: "ar", targetLanguage: "en" },
      tr: { sourceLanguage: "ar", targetLanguage: "en" },
      ja: { sourceLanguage: "en", targetLanguage: "ja" },
    };
    for (const locale of uiLocales) {
      expect(previewConversationFor(locale), `Update paywall.example in the ${locale} catalog when changing its preview pair`).toMatchObject(labelPairs[locale]);
    }
  });

  it("keeps the Arabic-to-English pair for the English UI", () => {
    expect(previewConversationFor("en")).toMatchObject({ sourceLanguage: "ar", targetLanguage: "en" });
  });

  it("translates English into the UI language when Murmur supports it as a target", () => {
    for (const locale of uiLocales) {
      const conversation = previewConversationFor(locale);
      const expectedTarget = locale !== "en" && languageRegistry.some((language) => language.app_code === locale) ? locale : "en";

      expect(conversation.targetLanguage).toBe(expectedTarget);
      expect(conversation.sourceCaption).not.toBe("");
      expect(conversation.translation).not.toBe("");
    }
  });
});
