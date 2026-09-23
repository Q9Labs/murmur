import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { processSessionInsight, recordInsightsConsent } from "./sessionInsights";

const validInsight = {
  setting: "lecture",
  event_name: null,
  topic: "Climate policy",
  domain_terms: ["emissions"],
  speakers_estimate: "1",
  user_intent: "Follow a lecture",
  translation_quality: 4,
  confusions: [],
  sentiment: "neutral",
  summary: "A speaker discussed climate policy.",
  product_signals: [],
};

function insightsDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of ["0001_billing_ledger.sql", "0012_session_insights.sql", "0013_rating_surveys.sql"]) {
    sqlite.exec(readFileSync(new URL(`../../migrations/${migration}`, import.meta.url), "utf8"));
  }
  for (const customerId of ["withdrawn", "guest", "retained"]) {
    sqlite.prepare("INSERT INTO customers VALUES (?, 'active', 0, 0, NULL)").run(customerId);
    sqlite.prepare("INSERT INTO customer_insights_consent VALUES (?, 1, '2026-09-23')").run(customerId);
    sqlite.prepare("INSERT INTO insight_session_context VALUES (?, ?, 'hash', 'en', 'ar', '2026-09-23')")
      .run(`session-${customerId}`, customerId);
    sqlite.prepare("INSERT INTO session_insights VALUES (?, ?, 'hash', 'en', 'ar', 30000, '2026-09-23', '{}')")
      .run(`session-${customerId}`, customerId);
    sqlite.prepare("INSERT INTO rating_surveys VALUES (?, ?, 'hash', 5, 'travel', NULL, '2026-09-23')")
      .run(`rating-${customerId}`, customerId);
  }
  sqlite.prepare("INSERT INTO customer_aliases VALUES ('guest', 'withdrawn', 0)").run();
  const database = {
    prepare(sql) {
      return {
        bind(...values) {
          const run = async () => ({ meta: sqlite.prepare(sql).run(...values) });
          return { first: async () => sqlite.prepare(sql).get(...values) ?? null, run };
        },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec("COMMIT");
      return results;
    },
  };
  return { database, sqlite };
}

const customerIds = (sqlite, table) =>
  sqlite.prepare(`SELECT customer_id FROM ${table} ORDER BY customer_id`).all().map((row) => row.customer_id);

afterEach(() => vi.unstubAllGlobals());

describe("insights consent withdrawal", () => {
  it("deletes the customer's and merged guest's stored insights but keeps their ratings", async () => {
    const { database, sqlite } = insightsDatabase();
    try {
      await recordInsightsConsent({ BILLING_DB: database }, {
        appSessionId: "session-new",
        consent: false,
        createdAt: "2026-09-23",
        customerId: "withdrawn",
        hashedInstallId: "hash",
        sourceLanguage: "en",
        targetLanguage: "ar",
      });
      expect(customerIds(sqlite, "session_insights")).toEqual(["retained"]);
      expect(customerIds(sqlite, "insight_session_context")).toEqual(["retained"]);
      expect(customerIds(sqlite, "rating_surveys")).toEqual(["guest", "retained", "withdrawn"]);
      expect(sqlite.prepare("SELECT consent FROM customer_insights_consent WHERE customer_id = 'withdrawn'").get())
        .toEqual({ consent: 0 });
    } finally {
      sqlite.close();
    }
  });

  it("does not store an insight when consent is withdrawn while the model is running", async () => {
    const { database, sqlite } = insightsDatabase();
    try {
      vi.stubGlobal("fetch", vi.fn(async () => {
        sqlite.prepare("UPDATE customer_insights_consent SET consent = 0 WHERE customer_id = 'retained'").run();
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validInsight) } }] }));
      }));
      await processSessionInsight({
        analyticsEnabled: false,
        configModel: "openai/gpt-6-luna",
        env: { BILLING_DB: database, OPENROUTER_API_KEY: "test-only-key" },
        session: {
          appSessionId: "session-late",
          createdAt: "2026-09-23",
          customerId: "retained",
          hashedInstallId: "hash",
          sourceLanguage: "en",
          targetLanguage: "ar",
        },
        translation: { durationMs: 30_000, text: "Private translated words" },
      });
      expect(sqlite.prepare("SELECT app_session_id FROM session_insights WHERE app_session_id = 'session-late'").get())
        .toBeUndefined();
    } finally {
      sqlite.close();
    }
  });
});
