import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { LedgerRepository } from "./ledgerRepository";

const creditPackValidityMs = 90 * 24 * 60 * 60_000;

describe("credit pack expiry migration", () => {
  it("removes existing pack expiry without changing spent or refunded value", async () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec(readFileSync(new URL("../../migrations/0001_billing_ledger.sql", import.meta.url), "utf8"));
      database.exec("PRAGMA foreign_keys = OFF");
      database.exec(`
        INSERT INTO customers (customer_id, state, created_at_ms, updated_at_ms)
        VALUES ('customer-1', 'active', 1000, 1000);
        INSERT INTO store_transactions (
          store_transaction_row_id, customer_id, provider, environment, transaction_id,
          product_id, product_kind, status, purchased_at_ms, created_at_ms, updated_at_ms
        ) VALUES (
          'transaction-1', 'customer-1', 'apple', 'production', 'purchase-1',
          'com.q9labsai.murmur.credits.60', 'credit_pack', 'purchased', 1000, 1000, 1000
        );
        INSERT INTO balance_grants (
          grant_id, customer_id, grant_kind, grant_key, original_ms, remaining_ms,
          valid_from_ms, state, source_ledger_entry_id, created_at_ms, updated_at_ms
        ) VALUES (
          'pack-1', 'customer-1', 'credit_pack', 'purchase-1', 3600000, 3600000,
          1000, 'available', 'ledger-1', 1000, 1000
        );
      `);
      database.exec(readFileSync(new URL("../../migrations/0009_credit_pack_expiry.sql", import.meta.url), "utf8"));

      expect(database.prepare("SELECT expires_at_ms FROM store_transactions").get())
        .toMatchObject({ expires_at_ms: 1_000 + creditPackValidityMs });
      expect(database.prepare("SELECT expires_at_ms FROM balance_grants").get())
        .toMatchObject({ expires_at_ms: 1_000 + creditPackValidityMs });
      database.exec(`
        INSERT INTO balance_grants (
          grant_id, customer_id, grant_kind, grant_key, original_ms, remaining_ms,
          valid_from_ms, expires_at_ms, state, source_ledger_entry_id, created_at_ms, updated_at_ms
        ) VALUES
          ('spent', 'customer-1', 'credit_pack', 'spent', 3600000, 0, 1000, 2000, 'exhausted', 'ledger-2', 1000, 1000),
          ('refunded', 'customer-1', 'credit_pack', 'refunded', 3600000, 0, 1000, 2000, 'reversed', 'ledger-3', 1000, 1000),
          ('expired', 'customer-1', 'credit_pack', 'expired', 3600000, 60000, 1000, 2000, 'expired', 'ledger-4', 1000, 1000),
          ('allowance', 'customer-1', 'free', 'free', 300000, 300000, 1000, 2000, 'available', 'ledger-5', 1000, 1000);
      `);
      database.exec(readFileSync(new URL("../../migrations/0017_nonexpiring_credit_packs.sql", import.meta.url), "utf8"));
      expect(database.prepare("SELECT expires_at_ms FROM store_transactions").get()).toMatchObject({ expires_at_ms: null });
      expect(database.prepare("SELECT expires_at_ms FROM balance_grants WHERE grant_id = 'pack-1'").get()).toMatchObject({ expires_at_ms: null });
      expect(database.prepare("SELECT remaining_ms, state FROM balance_grants WHERE grant_id = 'spent'").get()).toMatchObject({ remaining_ms: 0, state: "exhausted" });
      expect(database.prepare("SELECT remaining_ms, state FROM balance_grants WHERE grant_id = 'refunded'").get()).toMatchObject({ remaining_ms: 0, state: "reversed" });
      expect(database.prepare("SELECT remaining_ms, state FROM balance_grants WHERE grant_id = 'expired'").get()).toMatchObject({ remaining_ms: 60000, state: "available" });
      expect(database.prepare("SELECT expires_at_ms FROM balance_grants WHERE grant_id = 'allowance'").get()).toMatchObject({ expires_at_ms: 2000 });

      const repository = new LedgerRepository({
        prepare(query) {
          const statement = database.prepare(query);
          return {
            bind(...values) {
              return { first: async () => statement.get(...values) };
            },
          };
        },
      });
      expect((await repository.getBalance("customer-1", 1_000 + creditPackValidityMs - 1)).creditMs)
        .toBe(61 * 60_000);
      expect((await repository.getBalance("customer-1", 1_000 + 10 * 365 * 24 * 60 * 60_000)).creditMs)
        .toBe(61 * 60_000);
    } finally {
      database.close();
    }
  });
});
