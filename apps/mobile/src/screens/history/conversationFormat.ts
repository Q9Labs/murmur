import { autoSourceLanguageCode, getLanguage, type SourceLanguageCode } from "@murmur/protocol/languages";

import { formatMinutes } from "../formatMinutes";
import type { ConversationRecord } from "../screenServices";

function languageName(code: SourceLanguageCode): string {
  return code === autoSourceLanguageCode ? "Auto detect" : getLanguage(code).display_name;
}

export function conversationLanguages(record: ConversationRecord): string {
  return `${languageName(record.sourceLanguage)} to ${languageName(record.targetLanguage)}`;
}

export function conversationStarted(record: ConversationRecord): string {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", hour: "numeric", minute: "2-digit", month: "short" })
    .format(new Date(record.startedAtMs));
}

export function conversationDetails(record: ConversationRecord): string {
  return `${conversationLanguages(record)} · ${formatMinutes(record.durationMs)}`;
}
