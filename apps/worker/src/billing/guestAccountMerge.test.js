import { describe, expect, it } from "vitest";

import { createDatabase } from "./__tests__/billingDatabase.mjs";
import { mergeGuestCustomer } from "./guestAccountMerge";
import { LedgerRepository } from "./ledgerRepository";

const nowMs = Date.UTC(2026, 8, 23);


function seedPaidGuest(sqlite, destinationHasFreeGrant = true) {
  const customer = sqlite.prepare(
    "INSERT INTO customers (customer_id, state, created_at_ms, updated_at_ms) VALUES (?, 'active', ?, ?)",
  );
  customer.run("guest-1", nowMs, nowMs);
  customer.run("registered-1", nowMs, nowMs);
  sqlite.prepare(
    "INSERT INTO store_transactions (store_transaction_row_id, customer_id, provider, environment, transaction_id, product_id, product_kind, status, purchased_at_ms, expires_at_ms, created_at_ms, updated_at_ms) VALUES ('purchase-1', 'guest-1', 'apple', 'production', 'transaction-1', 'com.q9labsai.murmur.credits.60', 'credit_pack', 'purchased', ?, ?, ?, ?)",
  ).run(nowMs, nowMs + 90 * 24 * 60 * 60_000, nowMs, nowMs);
  for (const [customerId, grantId, amountMs] of [
    ["guest-1", "guest-free", 300_000],
    ...(destinationHasFreeGrant ? [["registered-1", "registered-free", 300_000]] : []),
    ["guest-1", "guest-pack", 3_600_000],
  ]) {
    sqlite.prepare(
      "INSERT INTO ledger_entries (ledger_entry_id, customer_id, entry_kind, amount_ms, idempotency_key, metadata_json, created_at_ms) VALUES (?, ?, 'grant', ?, ?, '{}', ?)",
    ).run(`ledger-${grantId}`, customerId, amountMs, `grant-${grantId}`, nowMs);
    sqlite.prepare(
      "INSERT INTO balance_grants (grant_id, customer_id, grant_kind, grant_key, original_ms, remaining_ms, valid_from_ms, expires_at_ms, state, source_ledger_entry_id, source_transaction_row_id, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)",
    ).run(
      grantId, customerId, grantId === "guest-pack" ? "credit_pack" : "free",
      grantId === "guest-pack" ? "transaction-1" : "free:2026-09", amountMs, amountMs, nowMs,
      grantId === "guest-pack" ? nowMs + 90 * 24 * 60 * 60_000 : Date.UTC(2026, 9, 1),
      `ledger-${grantId}`, grantId === "guest-pack" ? "purchase-1" : null, nowMs, nowMs,
    );
  }
  sqlite.prepare("INSERT INTO phone_audio_gifts (customer_id, claimed_at_ms, remaining_ms) VALUES (?, ?, ?)")
    .run("guest-1", nowMs, 120_000);
  sqlite.prepare("INSERT INTO phone_audio_gifts (customer_id, claimed_at_ms, remaining_ms) VALUES (?, ?, ?)")
    .run("registered-1", nowMs + 1, 60_000);
  sqlite.prepare("INSERT INTO phone_audio_gift_sessions (usage_session_id, customer_id, settled_ms) VALUES (?, ?, 0)")
    .run("gift-session-1", "guest-1");
}

describe("guest merge with billing and runtime migrations", () => {
  it.each([
    ["source only", 180_000, null, 180_000],
    ["both", 180_000, 240_000, 120_000],
    ["destination only", null, 240_000, 240_000],
    ["neither", null, null, 0],
    ["exhausted source only", 0, null, 0],
  ])("preserves Free balance for %s and makes retries a no-op", async (_kind, sourceMs, destinationMs, expectedMs) => {
    const { database, sqlite } = createDatabase();
    try {
      seedPaidGuest(sqlite, destinationMs !== null);
      if (sourceMs === null) {
        sqlite.exec("DELETE FROM balance_grants WHERE grant_id = 'guest-free'");
      } else {
        sqlite.prepare("UPDATE balance_grants SET remaining_ms = ?, state = ? WHERE grant_id = 'guest-free'")
          .run(sourceMs, sourceMs > 0 ? "available" : "exhausted");
      }
      if (destinationMs !== null) {
        sqlite.prepare("UPDATE balance_grants SET remaining_ms = ? WHERE grant_id = 'registered-free'")
          .run(destinationMs);
      }
      const params = { database, destinationCustomerId: "registered-1", nowMs, sourceCustomerId: "guest-1" };
      await mergeGuestCustomer(params);

      const repository = new LedgerRepository(database);
      expect((await repository.getBalance("registered-1", nowMs)).allowanceMs).toBe(expectedMs);
      expect((await repository.getBalance("guest-1", nowMs)).allowanceMs).toBe(0);
      if (sourceMs > 0 && destinationMs === null) {
        expect(sqlite.prepare("SELECT customer_id, grant_key, original_ms, remaining_ms, expires_at_ms, state FROM balance_grants WHERE grant_id = 'guest-free'").get())
          .toEqual({ customer_id: "registered-1", grant_key: "free:2026-09", original_ms: 300_000, remaining_ms: sourceMs, expires_at_ms: Date.UTC(2026, 9, 1), state: "available" });
        expect(sqlite.prepare("SELECT customer_id, amount_ms FROM ledger_entries WHERE entry_kind = 'merge' AND grant_id = 'guest-free' ORDER BY amount_ms").all())
          .toEqual([{ customer_id: "guest-1", amount_ms: -sourceMs }, { customer_id: "registered-1", amount_ms: sourceMs }]);
      }
      const grants = sqlite.prepare("SELECT * FROM balance_grants ORDER BY grant_id").all();
      const entries = sqlite.prepare("SELECT * FROM ledger_entries ORDER BY ledger_entry_id").all();
      const projections = sqlite.prepare("SELECT * FROM projection_versions ORDER BY customer_id").all();
      await mergeGuestCustomer(params);
      expect(sqlite.prepare("SELECT * FROM balance_grants ORDER BY grant_id").all()).toEqual(grants);
      expect(sqlite.prepare("SELECT * FROM ledger_entries ORDER BY ledger_entry_id").all()).toEqual(entries);
      expect(sqlite.prepare("SELECT * FROM projection_versions ORDER BY customer_id").all()).toEqual(projections);
    } finally {
      sqlite.close();
    }
  });

  it.each([0, 180_000])("reuses a moved Free grant with %s ms when the same-month allowance returns", async (remainingMs) => {
    const { database, sqlite } = createDatabase();
    try {
      seedPaidGuest(sqlite, false);
      sqlite.prepare("UPDATE balance_grants SET remaining_ms = ?, state = ? WHERE grant_id = 'guest-free'")
        .run(remainingMs, remainingMs > 0 ? "available" : "exhausted");
      await mergeGuestCustomer({ database, destinationCustomerId: "registered-1", nowMs, sourceCustomerId: "guest-1" });
      const grants = sqlite.prepare("SELECT * FROM balance_grants ORDER BY grant_id").all();
      const entries = sqlite.prepare("SELECT * FROM ledger_entries ORDER BY ledger_entry_id").all();
      const periods = sqlite.prepare("SELECT * FROM allowance_periods ORDER BY allowance_period_id").all();
      const projections = sqlite.prepare("SELECT * FROM projection_versions ORDER BY customer_id").all();
      const repository = new LedgerRepository(database);
      for (let retry = 0; retry < 2; retry += 1) {
        const result = await repository.bootstrapGuest({
          action: "bootstrap_guest", customerId: "registered-1", nowMs: nowMs + 1,
          grantFreeAllowance: true, freeAllowanceMs: 300_000,
          periodKey: "free:2026-09", periodStartsAtMs: Date.UTC(2026, 8, 1),
          periodExpiresAtMs: Date.UTC(2026, 9, 1), principalId: "auth:registered-1",
          principalProvider: "email", providerSubject: "registered-1",
        });
        expect(result.created).toBe(false);
        expect(result.balance.allowanceMs).toBe(remainingMs);
      }
      expect(sqlite.prepare("SELECT * FROM balance_grants ORDER BY grant_id").all()).toEqual(grants);
      expect(sqlite.prepare("SELECT * FROM ledger_entries ORDER BY ledger_entry_id").all()).toEqual(entries);
      expect(sqlite.prepare("SELECT * FROM allowance_periods ORDER BY allowance_period_id").all()).toEqual(periods);
      expect(sqlite.prepare("SELECT * FROM projection_versions ORDER BY customer_id").all()).toEqual(projections);
      expect(sqlite.prepare("SELECT grant_id, remaining_ms FROM balance_grants WHERE customer_id = 'registered-1' AND grant_kind = 'free'").all())
        .toEqual([{ grant_id: "guest-free", remaining_ms: remainingMs }]);
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM ledger_entries WHERE grant_id = 'guest-free' AND entry_kind = 'merge'").get().count)
        .toBe(remainingMs > 0 ? 2 : 0);
    } finally {
      sqlite.close();
    }
  });

  it("keeps a guest purchase when the existing paid account has no current Free grant", async () => {
    const { database, sqlite } = createDatabase();
    try {
      seedPaidGuest(sqlite, false);
      sqlite.prepare(
        "INSERT INTO subscriptions (subscription_id, customer_id, provider, environment, original_transaction_id, episode_id, product_id, state, started_at_ms, paid_through_ms, anchor_at_ms, provider_updated_at_ms, created_at_ms, updated_at_ms) VALUES ('registered-sub', 'registered-1', 'apple', 'production', 'existing-sub', 'existing-episode', 'com.q9labsai.murmur.pro.monthly', 'active', ?, ?, ?, ?, ?, ?)",
      ).run(nowMs - 30 * 24 * 60 * 60_000, nowMs + 30 * 24 * 60 * 60_000, nowMs - 30 * 24 * 60 * 60_000, nowMs, nowMs, nowMs);

      await mergeGuestCustomer({ database, destinationCustomerId: "registered-1", nowMs, sourceCustomerId: "guest-1" });

      expect(sqlite.prepare("SELECT customer_id FROM store_transactions WHERE store_transaction_row_id = 'purchase-1'").get())
        .toMatchObject({ customer_id: "registered-1" });
      expect((await new LedgerRepository(database).getBalance("registered-1", nowMs)).creditMs)
        .toBe(3_600_000);
      expect(sqlite.prepare("SELECT remaining_ms FROM phone_audio_gifts WHERE customer_id = 'registered-1'").get())
        .toMatchObject({ remaining_ms: 60_000 });
    } finally {
      sqlite.close();
    }
  });

  it("keeps a guest credit-pack purchase and merges Phone audio state into an existing account", async () => {
    const { database, sqlite } = createDatabase();
    try {
      seedPaidGuest(sqlite);
      await mergeGuestCustomer({ database, destinationCustomerId: "registered-1", nowMs, sourceCustomerId: "guest-1" });

      expect(sqlite.prepare("SELECT customer_id, remaining_ms FROM balance_grants WHERE grant_id = 'guest-pack'").get())
        .toMatchObject({ customer_id: "registered-1", remaining_ms: 3_600_000 });
      expect(sqlite.prepare("SELECT customer_id FROM store_transactions WHERE store_transaction_row_id = 'purchase-1'").get())
        .toMatchObject({ customer_id: "registered-1" });
      expect((await new LedgerRepository(database).getBalance("registered-1", nowMs)).creditMs)
        .toBe(3_600_000);
      expect(sqlite.prepare("SELECT remaining_ms FROM phone_audio_gifts WHERE customer_id = 'registered-1'").get())
        .toMatchObject({ remaining_ms: 60_000 });
      expect(sqlite.prepare("SELECT customer_id FROM phone_audio_gift_sessions WHERE usage_session_id = 'gift-session-1'").get())
        .toMatchObject({ customer_id: "registered-1" });
      expect(sqlite.prepare("SELECT canonical_customer_id FROM customer_aliases WHERE alias_customer_id = 'guest-1'").get())
        .toMatchObject({ canonical_customer_id: "registered-1" });

      sqlite.exec("UPDATE phone_audio_gift_sessions SET settled_ms = 30000 WHERE usage_session_id = 'gift-session-1'");
      expect(sqlite.prepare("SELECT remaining_ms FROM phone_audio_gifts WHERE customer_id = 'registered-1'").get())
        .toMatchObject({ remaining_ms: 30_000 });
      await expect(mergeGuestCustomer({ database, destinationCustomerId: "registered-1", nowMs, sourceCustomerId: "guest-1" }))
        .resolves.toBeUndefined();
    } finally {
      sqlite.close();
    }
  });
});
