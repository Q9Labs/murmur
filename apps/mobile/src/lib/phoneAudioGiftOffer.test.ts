import { describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("./localStorage", () => ({
  deleteLocalValue: vi.fn(async (key: string) => { storage.delete(key); }),
  getLocalValue: vi.fn(async (key: string) => storage.get(key) ?? null),
  setLocalValue: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
}));

import { deletePhoneAudioGiftOffer, hasOfferedPhoneAudioGift, markPhoneAudioGiftOffered } from "./phoneAudioGiftOffer";

describe("phone audio gift offer", () => {
  it("remembers the offer once made and forgets it when deleted", async () => {
    await expect(hasOfferedPhoneAudioGift()).resolves.toBe(false);
    await markPhoneAudioGiftOffered();
    await expect(hasOfferedPhoneAudioGift()).resolves.toBe(true);
    await deletePhoneAudioGiftOffer();
    await expect(hasOfferedPhoneAudioGift()).resolves.toBe(false);
  });
});
