import { languageRegistry } from "@murmur/protocol/languages";
import { describe, expect, it } from "vitest";

import { uiLocales } from "../i18n/types";
import { previewConversationFor } from "./previewConversation";

describe("preview conversation", () => {
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
