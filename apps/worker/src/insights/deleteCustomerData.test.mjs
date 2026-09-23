import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { deleteCustomerInsightsAndRatings } from "./deleteCustomerData";

describe("customer insights deletion", () => {
  it("deletes the customer's and merged guest's insight data without touching another customer", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(readFileSync(new URL("../../migrations/0001_billing_ledger.sql", import.meta.url), "utf8"));
      sqlite.exec(readFileSync(new URL("../../migrations/0012_session_insights.sql", import.meta.url), "utf8"));
      sqlite.exec(readFileSync(new URL("../../migrations/0013_rating_surveys.sql", import.meta.url), "utf8"));
      for (const customerId of ["deleted", "guest", "retained"]) {
        sqlite.prepare("INSERT INTO customers VALUES (?, 'active', 0, 0, NULL)").run(customerId);
      }
      sqlite.prepare("INSERT INTO customer_aliases VALUES ('guest', 'deleted', 0)").run();
      for (const customerId of ["deleted", "guest", "retained"]) {
        sqlite.prepare("INSERT INTO customer_insights_consent VALUES (?, 1, '2026-09-23')").run(customerId);
        sqlite.prepare("INSERT INTO insight_session_context VALUES (?, ?, 'hash', 'en', 'ar', '2026-09-23')")
          .run(`session-${customerId}`, customerId);
        sqlite.prepare("INSERT INTO session_insights VALUES (?, ?, 'hash', 'en', 'ar', 30000, '2026-09-23', '{}')")
          .run(`session-${customerId}`, customerId);
        sqlite.prepare("INSERT INTO rating_surveys VALUES (?, ?, 'hash', 5, 'travel', NULL, '2026-09-23')")
          .run(`rating-${customerId}`, customerId);
      }
      const database = {
        prepare(sql) {
          return {
            bind(...values) {
              return { run: async () => sqlite.prepare(sql).run(...values) };
            },
          };
        },
      };
      await deleteCustomerInsightsAndRatings(database, "deleted");
      for (const table of ["session_insights", "rating_surveys", "insight_session_context", "customer_insights_consent"]) {
        expect(sqlite.prepare(`SELECT customer_id FROM ${table}`).all()).toEqual([{ customer_id: "retained" }]);
      }
    } finally {
      sqlite.close();
    }
  });
});
