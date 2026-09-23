import { autoSourceLanguageCode, getLanguage, type SourceLanguageCode } from "@murmur/protocol/languages";

import { formatUiDate, languageLabel, type UiText } from "../../i18n/runtime";
import type { UiDirection } from "../../i18n/types";
import { formatMinutes } from "../formatMinutes";
import type { ConversationRecord } from "../screenServices";

function languageName(code: SourceLanguageCode, ui: UiText): string {
  return code === autoSourceLanguageCode ? ui.t("home.autoDetect") : languageLabel(getLanguage(code), ui.locale);
}

export function conversationLanguages(record: ConversationRecord, ui: UiText): string {
  return ui.t("history.languagePair", {
    source: languageName(record.sourceLanguage, ui),
    target: languageName(record.targetLanguage, ui),
  });
}

// The saved text is the translation, so it reads in the target language's direction.
export function conversationTextDirection(record: ConversationRecord): UiDirection {
  return getLanguage(record.targetLanguage).rtl ? "rtl" : "ltr";
}

export function conversationStarted(record: ConversationRecord, ui: UiText): string {
  return formatUiDate(record.startedAtMs, ui.locale, { day: "numeric", hour: "numeric", minute: "2-digit", month: "short" });
}

export function conversationDetails(record: ConversationRecord, ui: UiText): string {
  return `${conversationLanguages(record, ui)} · ${formatMinutes(record.durationMs, ui)}`;
}
