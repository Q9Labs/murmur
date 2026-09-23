import { Directory, File, Paths } from "expo-file-system";
import { isLanguageCode, isSourceLanguageCode, type LanguageCode, type SourceLanguageCode } from "@murmur/protocol/languages";
import { Platform, Share } from "react-native";

export type ConversationHistoryEntry = {
  customer_id: string;
  id: string;
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
  started_at_ms: number;
  duration_ms: number;
  translation_text: string;
};

export type ConversationHistorySummary = Omit<ConversationHistoryEntry, "translation_text"> & {
  preview: string;
};

const historyDirectory = new Directory(Paths.document, "conversation-history");
const validId = /^[a-zA-Z0-9_-]{8,100}$/;

export function saveConversation(entry: ConversationHistoryEntry): void {
  if (Platform.OS === "web") return;
  if (!validId.test(entry.id)) throw new Error("invalid_conversation_id");
  if (!entry.customer_id.trim()) throw new Error("invalid_history_customer_id");
  if (!entry.translation_text.trim()) return;
  historyDirectory.create({ idempotent: true });
  new File(historyDirectory, `${entry.id}.json`).write(JSON.stringify(entry));
}

export async function listConversations(customerId: string): Promise<ConversationHistorySummary[]> {
  if (Platform.OS === "web" || !historyDirectory.exists) return [];
  const entries = await Promise.all(historyDirectory.list()
    .filter((item): item is File => item instanceof File && item.uri.endsWith(".json"))
    .map((file) => readConversation(file)));
  return entries.filter((entry): entry is ConversationHistoryEntry => entry !== null && entry.customer_id === customerId)
    .sort((left, right) => right.started_at_ms - left.started_at_ms)
    .map(({ translation_text, ...entry }) => ({ ...entry, preview: translation_text.slice(0, 160) }));
}

export async function getConversation(customerId: string, id: string): Promise<ConversationHistoryEntry | null> {
  if (Platform.OS === "web" || !validId.test(id)) return null;
  const file = new File(historyDirectory, `${id}.json`);
  const entry = file.exists ? await readConversation(file) : null;
  return entry?.customer_id === customerId ? entry : null;
}

export async function deleteConversation(customerId: string, id: string): Promise<void> {
  if (!await getConversation(customerId, id)) return;
  const file = new File(historyDirectory, `${id}.json`);
  if (file.exists) file.delete();
}

export function deleteAllConversations(): void {
  if (Platform.OS !== "web" && historyDirectory.exists) historyDirectory.delete();
}

function conversationShareText(entry: ConversationHistoryEntry): string {
  return entry.translation_text;
}

export async function shareConversation(customerId: string, id: string): Promise<void> {
  const entry = await getConversation(customerId, id);
  if (!entry) throw new Error("conversation_not_found");
  await Share.share({ message: conversationShareText(entry) });
}

// fallow-ignore-next-line complexity
async function readConversation(file: File): Promise<ConversationHistoryEntry | null> {
  const value: unknown = JSON.parse(await file.text());
  if (typeof value !== "object" || value === null) return null;
  const id = Reflect.get(value, "id");
  const customerId = Reflect.get(value, "customer_id");
  const sourceLanguage = Reflect.get(value, "source_language");
  const targetLanguage = Reflect.get(value, "target_language");
  const startedAtMs = Reflect.get(value, "started_at_ms");
  const durationMs = Reflect.get(value, "duration_ms");
  const translationText = Reflect.get(value, "translation_text");
  if (typeof id !== "string" || !validId.test(id) ||
    typeof customerId !== "string" || customerId.length === 0 ||
    !isSourceLanguageCode(sourceLanguage) || !isLanguageCode(targetLanguage) ||
    typeof startedAtMs !== "number" || !Number.isFinite(startedAtMs) ||
    typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0 ||
    typeof translationText !== "string") return null;
  return {
    customer_id: customerId, id, source_language: sourceLanguage, target_language: targetLanguage,
    started_at_ms: startedAtMs, duration_ms: durationMs, translation_text: translationText,
  };
}
