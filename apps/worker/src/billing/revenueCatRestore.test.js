import { describe, expect, it } from "vitest";

import { createDatabase } from "./__tests__/billingDatabase.mjs";
import { LedgerRepository } from "./ledgerRepository";
import { restoreVerifiedResourceOwnership } from "./revenueCatRestore";

describe.each(["purchase", "subscription"])("restored %s ownership", (kind) => {
  it("rejects a source settlement selected before a concurrent restore", async () => {
    const { database, sqlite } = createDatabase();
    try {
      const resource = seedRestore(sqlite, kind, 1_800_000, "available");
      startPaidUsage(sqlite);
      const restore = () => restoreVerifiedResourceOwnership({
        customerId: "new-guest", database, nowMs: 2000, resource, resourceKey: "resource-1",
      });
      const repository = new LedgerRepository(restoreAfterSelection(database, restore));
      await expect(repository.settleUsage(settlement)).rejects.toThrow();
      expect((await new LedgerRepository(database).getBalance("new-guest", 2000)).availableMs).toBe(1_800_000);
      expect(sqlite.prepare("SELECT state FROM usage_sessions").get()).toMatchObject({ state: "failed" });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM usage_settlements").get()).toMatchObject({ count: 0 });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM ledger_entries WHERE entry_kind='debit'").get()).toMatchObject({ count: 0 });
    } finally {
      sqlite.close();
    }
  });

  it("keeps legitimately settled usage deducted when restoring", async () => {
    const { database, sqlite } = createDatabase();
    try {
      const resource = seedRestore(sqlite, kind, 1_800_000, "available");
      startPaidUsage(sqlite);
      await new LedgerRepository(database).settleUsage(settlement);
      await restoreVerifiedResourceOwnership({ customerId: "new-guest", database, nowMs: 2000, resource, resourceKey: "resource-1" });
      expect((await new LedgerRepository(database).getBalance("new-guest", 2000)).availableMs).toBe(1_740_000);
    } finally {
      sqlite.close();
    }
  });

  it.each([
    { remaining: 1_800_000, state: "available" },
    { remaining: 0, state: "exhausted" },
    { remaining: -60_000, state: "reversed" },
  ])("moves existing value without refilling $state minutes", async ({ remaining, state }) => {
    const { database, sqlite } = createDatabase();
    try {
      const resource = seedRestore(sqlite, kind, remaining, state);
      const params = { customerId: "new-guest", database, nowMs: 2000, resource, resourceKey: "resource-1" };
      await restoreVerifiedResourceOwnership(params);
      await restoreVerifiedResourceOwnership(params);
      expect(sqlite.prepare("SELECT customer_id, remaining_ms, state FROM balance_grants WHERE grant_id='paid'").get())
        .toMatchObject({ customer_id: "new-guest", remaining_ms: remaining, state });
      expect(sqlite.prepare("SELECT customer_id FROM store_transactions").get()).toMatchObject({ customer_id: "new-guest" });
      expect(sqlite.prepare("SELECT customer_id, state FROM reconciliation_resource_states").get())
        .toMatchObject({ customer_id: "new-guest", state: "applied" });
      expect(sqlite.prepare("SELECT customer_id FROM balance_grants WHERE grant_id='free'").get()).toMatchObject({ customer_id: "old-guest" });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM customer_aliases").get()).toMatchObject({ count: 0 });
      expect(sqlite.prepare("SELECT SUM(amount_ms) AS net FROM ledger_entries WHERE entry_kind='merge'").get())
        .toMatchObject({ net: remaining === 0 ? null : 0 });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM ledger_entries WHERE entry_kind='merge'").get())
        .toMatchObject({ count: remaining === 0 ? 0 : 2 });
      if (kind === "subscription") {
        expect(sqlite.prepare("SELECT customer_id FROM subscriptions").get()).toMatchObject({ customer_id: "new-guest" });
      }
      if (state === "available") {
        const balance = await new LedgerRepository(database).getBalance("new-guest", 2000);
        expect(balance.availableMs).toBe(remaining);
        expect((await new LedgerRepository(database).getBalance("old-guest", 2000)).availableMs).toBe(300000);
      }
    } finally {
      sqlite.close();
    }
  });
});

const settlement = {
  action: "settle_usage", amountMs: 60000, customerId: "old-guest", nowMs: 3000,
  settlementSequence: 1, usageSessionId: "old-session",
};

function startPaidUsage(sqlite) {
  sqlite.exec(`UPDATE balance_grants SET remaining_ms=0, state='exhausted' WHERE grant_id='free';
    INSERT INTO projection_versions (customer_id, version, updated_at_ms) VALUES ('old-guest', 0, 1000);
    INSERT INTO usage_sessions (usage_session_id, customer_id, generation, state, started_at_ms, updated_at_ms)
    VALUES ('old-session', 'old-guest', 1, 'open', 1000, 1000)`);
}

function restoreAfterSelection(database, restore) {
  return {
    ...database,
    prepare(sql) {
      if (!sql.includes("SELECT grant_id, remaining_ms, expires_at_ms")) return database.prepare(sql);
      return { bind(...values) {
        const statement = database.prepare(sql).bind(...values);
        return { ...statement, all: async () => {
          const selected = await statement.all();
          await restore();
          return selected;
        } };
      } };
    },
  };
}

function seedRestore(sqlite, kind, remaining, state) {
  sqlite.exec(`
    INSERT INTO customers (customer_id, state, created_at_ms, updated_at_ms)
    VALUES ('old-guest', 'active', 1000, 1000), ('new-guest', 'active', 1000, 1000);
    INSERT INTO store_transactions (
      store_transaction_row_id, customer_id, provider, environment, transaction_id,
      original_transaction_id, product_id, product_kind, status, purchased_at_ms, created_at_ms, updated_at_ms
    ) VALUES ('purchase-1', 'old-guest', 'apple', 'production', 'transaction-1',
      'transaction-1', 'product-1', '${kind === "purchase" ? "credit_pack" : "subscription"}', 'purchased', 1000, 1000, 1000);
    INSERT INTO ledger_entries (ledger_entry_id, customer_id, entry_kind, amount_ms, idempotency_key, created_at_ms)
    VALUES ('original', 'old-guest', 'grant', 3600000, 'original', 1000);
    INSERT INTO balance_grants (
      grant_id, customer_id, grant_kind, grant_key, original_ms, remaining_ms, valid_from_ms,
      expires_at_ms, state, source_ledger_entry_id, source_transaction_row_id, created_at_ms, updated_at_ms
    ) VALUES ('paid', 'old-guest', '${kind === "purchase" ? "credit_pack" : "pro"}',
      '${kind === "purchase" ? "store:apple:production:transaction-1" : "pro:episode-1:0"}',
      3600000, ${remaining}, 1000, ${kind === "purchase" ? "NULL" : "100000"}, '${state}', 'original', 'purchase-1', 1000, 1000);
    INSERT INTO balance_grants (
      grant_id, customer_id, grant_kind, grant_key, original_ms, remaining_ms,
      valid_from_ms, state, source_ledger_entry_id, created_at_ms, updated_at_ms
    ) VALUES ('free', 'old-guest', 'free', 'free:period', 300000, 300000,
      1000, 'available', 'original', 1000, 1000);
  `);
  const common = { environment: "production", productId: "product-1", provider: "apple", status: "owned" };
  const resource = kind === "purchase"
    ? { ...common, purchaseId: "purchase-1", purchasedAtMs: 1000, storeTransactionId: "transaction-1" }
    : { ...common, currentPeriodStartsAtMs: 1000, episodeId: "episode-1", givesAccess: true,
      originalPurchasedAtMs: 1000, paidThroughMs: 100000, storeSubscriptionId: "transaction-1" };
  if (kind === "subscription") {
    sqlite.exec(`INSERT INTO subscriptions (
      subscription_id, customer_id, provider, environment, original_transaction_id, episode_id,
      product_id, state, started_at_ms, paid_through_ms, anchor_at_ms, provider_updated_at_ms, created_at_ms, updated_at_ms
    ) VALUES ('subscription-1', 'old-guest', 'apple', 'production', 'transaction-1', 'episode-1',
      'product-1', 'active', 1000, 100000, 1000, 1000, 1000, 1000)`);
  }
  sqlite.exec(`INSERT INTO reconciliation_resource_states
    (resource_key, customer_id, resource_kind, fingerprint, transition_sequence, state, updated_at_ms)
    VALUES ('resource-1', 'old-guest', '${kind}', 'same-fingerprint', 1, 'applied', 1000)`);
  return resource;
}
