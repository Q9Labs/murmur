import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  directories: new Set<string>(),
  files: new Map<string, string>(),
  share: vi.fn(async () => undefined),
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" }, Share: { share: storage.share } }));
vi.mock("expo-file-system", () => {
  function pathOf(parts: (string | Directory)[]): string {
    return parts.map((part) => typeof part === "string" ? part : part.uri).join("/");
  }
  class Directory {
    readonly uri: string;
    constructor(...parts: (string | Directory)[]) {
      this.uri = pathOf(parts);
    }
    get exists() { return storage.directories.has(this.uri); }
    create() { storage.directories.add(this.uri); }
    delete() {
      storage.directories.delete(this.uri);
      for (const path of storage.files.keys()) if (path.startsWith(`${this.uri}/`)) storage.files.delete(path);
    }
    list() { return [...storage.files.keys()].filter((path) => path.startsWith(`${this.uri}/`)).map((path) => new File(path)); }
  }
  class File {
    readonly uri: string;
    constructor(...parts: (string | Directory)[]) {
      this.uri = pathOf(parts);
    }
    get exists() { return storage.files.has(this.uri); }
    write(value: string) { storage.files.set(this.uri, value); }
    async text() { return storage.files.get(this.uri) ?? ""; }
    delete() { storage.files.delete(this.uri); }
  }
  return { Directory, File, Paths: { document: "/documents" } };
});

import {
  deleteAllConversations,
  deleteConversation,
  getConversation,
  listConversations,
  saveConversation,
  shareConversation,
} from "./conversationHistory";

beforeEach(() => {
  storage.directories.clear();
  storage.files.clear();
  storage.share.mockClear();
});

const first = {
  customer_id: "customer-1",
  id: "session_12345678",
  source_language: "en" as const,
  target_language: "ar" as const,
  started_at_ms: 100,
  duration_ms: 60_000,
  translation_text: "Welcome to the conference.",
};

describe("local conversation history", () => {
  it("saves only on device, lists newest first, reads details and shares text", async () => {
    saveConversation(first);
    saveConversation({ ...first, id: "session_87654321", started_at_ms: 200, translation_text: "Hello again." });
    expect((await listConversations("customer-1")).map((entry) => entry.id)).toEqual(["session_87654321", "session_12345678"]);
    await expect(getConversation("customer-1", first.id)).resolves.toEqual(first);
    await shareConversation("customer-1", first.id);
    expect(storage.share).toHaveBeenCalledWith({ message: first.translation_text });
  });

  it("deletes one entry or all local conversation data", async () => {
    saveConversation(first);
    await deleteConversation("customer-1", first.id);
    await expect(getConversation("customer-1", first.id)).resolves.toBeNull();
    saveConversation(first);
    deleteAllConversations();
    await expect(listConversations("customer-1")).resolves.toEqual([]);
  });

  it("rejects path-like ids", async () => {
    expect(() => saveConversation({ ...first, id: "../escape" })).toThrow("invalid_conversation_id");
    await expect(getConversation("customer-1", "../escape")).resolves.toBeNull();
  });

  it("does not expose another local account's translations", async () => {
    saveConversation(first);
    await expect(listConversations("customer-2")).resolves.toEqual([]);
    await expect(getConversation("customer-2", first.id)).resolves.toBeNull();
    await expect(shareConversation("customer-2", first.id)).rejects.toThrow("conversation_not_found");
    await deleteConversation("customer-2", first.id);
    await expect(getConversation("customer-1", first.id)).resolves.toEqual(first);
  });
});
