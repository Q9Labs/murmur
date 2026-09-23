import { describe, expect, it } from "vitest";

import {
  claimPhoneAudioGift,
  getPhoneAudioGift,
  getSessionPhoneAudioGift,
  openPhoneAudioGiftSession,
  settlePhoneAudioGift,
} from "./phoneAudioGift";

function giftDatabase() {
  const gifts = new Map<string, number>();
  const sessions = new Map<string, string>();
  const settled = new Map<string, number>();
  return {
    prepare(query: string) {
      return {
        bind(...values: (string | number)[]) {
          return {
            // fallow-ignore-next-line complexity
            async first(): Promise<unknown> {
              if (query.includes("UPDATE phone_audio_gift_sessions")) {
                const total = values[0];
                const sessionId = values[1];
                if (typeof total !== "number" || typeof sessionId !== "string") return null;
                const customerId = sessions.get(sessionId);
                if (!customerId) return null;
                const delta = Math.max(0, total - (settled.get(sessionId) ?? 0));
                settled.set(sessionId, total);
                gifts.set(customerId, Math.max(0, (gifts.get(customerId) ?? 0) - delta));
                return { customer_id: customerId };
              }
              if (query.includes("JOIN phone_audio_gifts")) {
                const sessionId = values[0];
                if (typeof sessionId !== "string") return null;
                const customerId = sessions.get(sessionId);
                return customerId ? { customer_id: customerId, remaining_ms: gifts.get(customerId) } : null;
              }
              const customerId = values[0];
              return typeof customerId === "string" && gifts.has(customerId)
                ? { remaining_ms: gifts.get(customerId) }
                : null;
            },
            async run(): Promise<void> {
              if (query.includes("INSERT OR IGNORE INTO phone_audio_gifts")) {
                const customerId = values[0];
                const remaining = values[2];
                if (typeof customerId === "string" && typeof remaining === "number" && !gifts.has(customerId)) {
                  gifts.set(customerId, remaining);
                }
              }
              if (query.includes("INSERT INTO phone_audio_gift_sessions")) {
                const sessionId = values[0];
                const customerId = values[1];
                if (typeof sessionId === "string" && typeof customerId === "string") {
                  sessions.set(sessionId, customerId);
                  settled.set(sessionId, 0);
                }
              }
            },
          };
        },
      };
    },
  };
}

describe("Phone audio gift", () => {
  it("claims once, meters realtime usage, and cannot reset by claiming again", async () => {
    const database = giftDatabase();
    await expect(getPhoneAudioGift(database, "customer-1")).resolves.toEqual({
      claimable: true, remaining_ms: 0,
    });
    await expect(claimPhoneAudioGift(database, "customer-1", 1_000)).resolves.toEqual({
      claimable: false, remaining_ms: 180_000,
    });
    await openPhoneAudioGiftSession(database, "customer-1", "session-1");
    await expect(getSessionPhoneAudioGift(database, "session-1")).resolves.toEqual({
      customerId: "customer-1", remainingMs: 180_000,
    });
    await expect(settlePhoneAudioGift(database, "session-1", 45_000)).resolves.toBe(135_000);
    await expect(settlePhoneAudioGift(database, "session-1", 45_000)).resolves.toBe(135_000);
    await expect(claimPhoneAudioGift(database, "customer-1", 2_000)).resolves.toEqual({
      claimable: false, remaining_ms: 135_000,
    });
    await expect(settlePhoneAudioGift(database, "session-1", 245_000)).resolves.toBe(0);
    await expect(getPhoneAudioGift(database, "customer-1")).resolves.toEqual({
      claimable: false, remaining_ms: 0,
    });
  });
});
