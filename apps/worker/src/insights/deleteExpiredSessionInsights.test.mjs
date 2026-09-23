import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { deleteExpiredRatingSurveys } from "./deleteExpiredRatingSurveys";
import { deleteExpiredSessionInsights } from "./deleteExpiredSessionInsights";

function createD1Database(sqlite) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            run: async () => ({
              meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) },
            }),
          };
        },
      };
    },
  };
}

describe("expired session insight deletion", () => {
  it("deletes insights older than 24 months and keeps newer rows", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      for (const migration of [
        "0001_billing_ledger.sql",
        "0012_session_insights.sql",
        "0014_session_insight_retention_indexes.sql",
      ]) {
        sqlite.exec(readFileSync(new URL(`../../migrations/${migration}`, import.meta.url), "utf8"));
      }
      const insertInsight = sqlite.prepare(
        "INSERT INTO session_insights " +
        "(app_session_id, customer_id, hashed_install_id, source_language, target_language, duration_ms, created_at, insight_json) " +
        "VALUES (?, NULL, 'hash', 'en', 'ar', 30000, ?, '{}')",
      );
      insertInsight.run("expired", "2022-02-28T11:59:59.999Z");
      insertInsight.run("cutoff", "2022-02-28T12:00:00.000Z");
      insertInsight.run("newer", "2022-03-01T12:00:00.000Z");
      const insertContext = sqlite.prepare(
        "INSERT INTO insight_session_context " +
        "(app_session_id, customer_id, hashed_install_id, source_language, target_language, created_at) " +
        "VALUES (?, NULL, 'hash', 'en', 'ar', ?)",
      );
      insertContext.run("expired-context", "2022-02-28T11:59:59.999Z");
      insertContext.run("newer-context", "2022-03-01T12:00:00.000Z");

      const deleted = await deleteExpiredSessionInsights(
        createD1Database(sqlite),
        Date.parse("2024-02-29T12:00:00.000Z"),
      );

      expect(deleted).toEqual({ deletedInsights: 1, deletedSessionContexts: 1 });
      expect(sqlite.prepare("SELECT app_session_id FROM session_insights ORDER BY app_session_id").all())
        .toEqual([{ app_session_id: "cutoff" }, { app_session_id: "newer" }]);
      expect(sqlite.prepare("SELECT app_session_id FROM insight_session_context").all())
        .toEqual([{ app_session_id: "newer-context" }]);
    } finally {
      sqlite.close();
    }
  });

  it("deletes rating surveys older than 24 months and keeps newer rows", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      for (const migration of [
        "0001_billing_ledger.sql",
        "0013_rating_surveys.sql",
        "0015_rating_survey_retention_index.sql",
      ]) {
        sqlite.exec(readFileSync(new URL(`../../migrations/${migration}`, import.meta.url), "utf8"));
      }
      const insertRating = sqlite.prepare(
        "INSERT INTO rating_surveys " +
        "(id, customer_id, hashed_install_id, stars, setting, other_text, created_at) " +
        "VALUES (?, NULL, 'hash', 5, 'travel', NULL, ?)",
      );
      insertRating.run("expired", "2022-02-28T11:59:59.999Z");
      insertRating.run("cutoff", "2022-02-28T12:00:00.000Z");
      insertRating.run("newer", "2022-03-01T12:00:00.000Z");

      const deleted = await deleteExpiredRatingSurveys(
        createD1Database(sqlite),
        Date.parse("2024-02-29T12:00:00.000Z"),
      );

      expect(deleted).toBe(1);
      expect(sqlite.prepare("SELECT id FROM rating_surveys ORDER BY id").all())
        .toEqual([{ id: "cutoff" }, { id: "newer" }]);
      expect(sqlite.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'rating_surveys_created_at_idx'",
      ).all()).toEqual([{ name: "rating_surveys_created_at_idx" }]);
    } finally {
      sqlite.close();
    }
  });
});
