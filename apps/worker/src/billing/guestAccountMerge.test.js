import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { mergeGuestCustomer } from "./guestAccountMerge";
import { LedgerRepository } from "./ledgerRepository";

const nowMs = Date.UTC(2026, 8, 23);

function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const migrations = new URL("../../migrations/", import.meta.url);
  for (const file of readdirSync(migrations).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort()) {
    sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
  }
  const database = {
    prepare(sql) {
      return {
        bind(...values) {
          const statement = sqlite.prepare(sql);
          return {
            first: async () => statement.get(...values) ?? null,
            all: async () => ({ results: statement.all(...values) }),
            run: async () => statement.run(...values),
          };
        },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        for (const statement of statements) await statement.run();
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
      return [];
    },
  };
  return { database, sqlite };
}

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
    ["guest-1", "guest-free", 420_000],
    ...(destinationHasFreeGrant ? [["registered-1", "registered-free", 420_000]] : []),
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
