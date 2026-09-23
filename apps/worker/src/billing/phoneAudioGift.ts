const phoneAudioGiftDurationMs = 180_000;

type GiftDatabase = {
  prepare: (query: string) => {
    bind: (...values: (string | number)[]) => {
      first: () => Promise<unknown>;
      run: () => Promise<unknown>;
    };
  };
};

export type PhoneAudioGift = {
  claimable: boolean;
  remaining_ms: number;
};

export async function getPhoneAudioGift(
  database: GiftDatabase,
  customerId: string,
): Promise<PhoneAudioGift> {
  const row = await database.prepare(
    "SELECT remaining_ms FROM phone_audio_gifts WHERE customer_id = ?",
  ).bind(customerId).first();
  if (row === null || row === undefined) return { claimable: true, remaining_ms: 0 };
  const remainingMs = integerField(row, "remaining_ms");
  if (remainingMs === null) throw new Error("phone_audio_gift_invalid_balance");
  return { claimable: false, remaining_ms: remainingMs };
}

export async function claimPhoneAudioGift(
  database: GiftDatabase,
  customerId: string,
  nowMs: number,
): Promise<PhoneAudioGift> {
  await database.prepare(
    `INSERT OR IGNORE INTO phone_audio_gifts (customer_id, claimed_at_ms, remaining_ms)
     VALUES (?, ?, ?)`,
  ).bind(customerId, nowMs, phoneAudioGiftDurationMs).run();
  return getPhoneAudioGift(database, customerId);
}

export async function openPhoneAudioGiftSession(
  database: GiftDatabase,
  customerId: string,
  usageSessionId: string,
): Promise<void> {
  await database.prepare(
    `INSERT INTO phone_audio_gift_sessions (usage_session_id, customer_id)
     VALUES (?, ?)`,
  ).bind(usageSessionId, customerId).run();
}

export async function getSessionPhoneAudioGift(
  database: GiftDatabase,
  usageSessionId: string,
): Promise<{ customerId: string; remainingMs: number } | null> {
  const row = await database.prepare(
    `SELECT s.customer_id, g.remaining_ms
     FROM phone_audio_gift_sessions s
     JOIN phone_audio_gifts g ON g.customer_id = s.customer_id
     WHERE s.usage_session_id = ?`,
  ).bind(usageSessionId).first();
  const customerId = stringField(row, "customer_id");
  const remainingMs = integerField(row, "remaining_ms");
  return customerId !== null && remainingMs !== null ? { customerId, remainingMs } : null;
}

export async function settlePhoneAudioGift(
  database: GiftDatabase,
  usageSessionId: string,
  totalMs: number,
): Promise<number> {
  const result = await database.prepare(
    `UPDATE phone_audio_gift_sessions SET settled_ms = MAX(settled_ms, ?)
     WHERE usage_session_id = ? RETURNING customer_id`,
  ).bind(totalMs, usageSessionId).first();
  if (!result) throw new Error("phone_audio_gift_missing_during_settlement");
  const customerId = stringField(result, "customer_id");
  if (!customerId) throw new Error("phone_audio_gift_invalid_settlement");
  return (await getPhoneAudioGift(database, customerId)).remaining_ms;
}

function integerField(value: unknown, key: string): number | null {
  if (typeof value !== "object" || value === null) return null;
  const field = Reflect.get(value, key);
  return typeof field === "number" && Number.isInteger(field) && field >= 0 ? field : null;
}

function stringField(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null) return null;
  const field = Reflect.get(value, key);
  return typeof field === "string" && field.length > 0 ? field : null;
}
