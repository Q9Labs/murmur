import { describe, expect, it } from "vitest";

import { mergeGuestCustomer } from "./guestAccountMerge";

function mergeDatabase() {
  const batched = [];
  const database = {
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
        async first() {
          if (sql.includes("customer_aliases")) return null;
          if (sql.includes("sqlite_master")) return { name: "phone_audio_gifts" };
          if (sql.includes("SELECT state FROM customers")) return { state: "active" };
          if (sql.includes("grant_kind = 'free'")) {
            return {
              grant_id: `free-${this.values[0]}`,
              original_ms: 420_000,
              remaining_ms: 300_000,
            };
          }
          throw new Error(`Unexpected merge query: ${sql}`);
        },
        async all() {
          if (sql.includes("grant_kind != 'free'")) {
            return { results: [{ grant_id: "credit-1", remaining_ms: 120_000 }] };
          }
          throw new Error(`Unexpected merge query: ${sql}`);
        },
      };
      return statement;
    },
    async batch(statements) {
      batched.push(...statements);
      return [];
    },
  };
  return { database, batched };
}

describe("paid guest account merge", () => {
  it("moves paid grants and purchase ownership in the same batch as the customer alias", async () => {
    const { database, batched } = mergeDatabase();

    await mergeGuestCustomer({
      database,
      destinationCustomerId: "registered-1",
      nowMs: Date.UTC(2026, 8, 23),
      sourceCustomerId: "guest-1",
    });

    const queries = batched.map((statement) => statement.sql);
    expect(queries.some((sql) => sql.includes("UPDATE balance_grants") && sql.includes("SET customer_id"))).toBe(true);
    expect(queries.some((sql) => sql.includes("UPDATE subscriptions SET customer_id"))).toBe(true);
    expect(queries.some((sql) => sql.includes("UPDATE store_transactions SET customer_id"))).toBe(true);
    expect(queries.some((sql) => sql.includes("INSERT INTO customer_aliases"))).toBe(true);
    expect(queries.some((sql) => sql.includes("INSERT INTO phone_audio_gifts") && sql.includes("remaining_ms = MIN"))).toBe(true);
    expect(queries.some((sql) => sql.includes("UPDATE phone_audio_gift_sessions SET customer_id"))).toBe(true);
    const paidMovements = batched.filter((statement) =>
      statement.sql.includes("INSERT INTO ledger_entries") &&
      statement.values.some((value) => typeof value === "string" && value.includes(":paid:credit-1"))
    );
    expect(paidMovements).toHaveLength(2);
    expect(paidMovements.map((statement) => statement.values[2])).toEqual([-120_000, 120_000]);
  });
});
