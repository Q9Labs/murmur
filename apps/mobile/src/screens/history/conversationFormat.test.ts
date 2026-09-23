import { describe, expect, it } from "vitest";

import { conversationDetails, conversationLanguages, conversationStarted } from "./conversationFormat";
import { en, uiText } from "../__tests__/uiText";

const record = {
  durationMs: 12 * 60_000,
  id: "conversation-1",
  sourceLanguage: "ar" as const,
  startedAtMs: Date.UTC(2026, 8, 3, 14, 5),
  targetLanguage: "en" as const,
  text: "Hello",
};

const ja = uiText("ja");

describe("conversation formatting", () => {
  it("names the languages and the length", () => {
    expect(conversationLanguages(record, en)).toBe("Arabic to English");
    expect(conversationLanguages({ ...record, sourceLanguage: "auto" }, en)).toBe("Auto detect to English");
    expect(conversationDetails(record, en)).toBe("Arabic to English · 12 min");
  });

  it("formats the start time in the listener's locale", () => {
    expect(conversationStarted(record, en)).not.toContain("2026");
    expect(conversationStarted(record, en)).toMatch(/\d/);
  });

  it("names languages by their own name outside English", () => {
    expect(conversationLanguages(record, ja)).toContain("العربية");
  });
});
