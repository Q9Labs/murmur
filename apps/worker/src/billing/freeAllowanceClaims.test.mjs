import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { transferFreeAllowanceClaim } from "./freeAllowanceClaims";

const databases = [];
afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

function transferFixture(owner) {
  const sqlite = new DatabaseSync(":memory:");
  databases.push(sqlite);
  for (const migration of ["0001_billing_ledger.sql", "0005_free_allowance_claims.sql"]) {
    sqlite.exec(readFileSync(new URL(`../../migrations/${migration}`, import.meta.url), "utf8"));
  }
  for (const customerId of ["guest", "registered", "other"]) {
    sqlite.prepare("INSERT INTO customers VALUES (?, 'active', 0, 0, NULL)").run(customerId);
  }
  if (owner) {
    sqlite.prepare("INSERT INTO free_allowance_claims VALUES ('hash', '2026-10', ?, 0, 1000)").run(owner);
  }
  const database = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bind: (...values) => ({
          async first() { return statement.get(...values) ?? null; },
          async run() { return { meta: statement.run(...values) }; },
        }),
      };
    },
  };
  return {
    sqlite,
    transfer: () => transferFreeAllowanceClaim({
      claimHash: "hash", database, destinationCustomerId: "registered",
      nowMs: 1, periodKey: "2026-10", sourceCustomerId: "guest",
    }),
  };
}

describe("Free allowance claim transfer", () => {
  it("does nothing when hard mode created no claim", async () => {
    const { sqlite, transfer } = transferFixture();
    await expect(transfer()).resolves.toBeUndefined();
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM free_allowance_claims").get().count).toBe(0);
  });

  it("transfers an existing guest claim and accepts a retry", async () => {
    const { sqlite, transfer } = transferFixture("guest");
    await transfer();
    await expect(transfer()).resolves.toBeUndefined();
    expect(sqlite.prepare("SELECT customer_id, claimed_at_ms FROM free_allowance_claims").get())
      .toEqual({ customer_id: "registered", claimed_at_ms: 1 });
  });

  it("rejects a claim owned by another customer without changing it", async () => {
    const { sqlite, transfer } = transferFixture("other");
    await expect(transfer()).rejects.toThrow("Free allowance claim does not belong to the guest customer");
    expect(sqlite.prepare("SELECT customer_id FROM free_allowance_claims").get().customer_id).toBe("other");
  });
});
