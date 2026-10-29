import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const legacy = readFileSync(new URL("../../migrations/0002_auth_and_refund_restoration.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../migrations/0018_auth_provider_account_identity.sql", import.meta.url), "utf8");
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../../migrations/0001_billing_ledger.sql", import.meta.url), "utf8"));
  db.exec(legacy.slice(0, legacy.indexOf("CREATE TABLE refund_restorations")));
  db.exec(`INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES ('user', 'Fixture', 'fixture@example.invalid', 1, 1, 2)`);
  return db;
}
function account(db, id, provider, issuer = "fixture-issuer") {
  db.prepare(`INSERT INTO account (id, issuer, accountId, providerId, userId, accessToken, password, createdAt, updatedAt) VALUES (?, ?, 'shared-id', ?, 'user', 'fixture-token', 'fixture-hash', 1, 2)`).run(id, issuer, provider);
}

describe("Better Auth provider account migration", () => {
  it("preserves every account field, permits old/new writers, and keeps providers distinct", () => {
    const db = fixture();
    try {
      account(db, "google", "google");
      expect(() => account(db, "email-before-migration", "email-otp", null)).toThrow(/NOT NULL/);
      const before = db.prepare("SELECT * FROM account").all();
      db.exec(migration);
      expect(db.prepare("SELECT * FROM account").all()).toEqual(before);
      account(db, "apple-old-writer", "apple", "apple-issuer");
      account(db, "email-new-writer", "email-otp", null);
      expect(() => account(db, "duplicate", "google", "other-issuer")).toThrow(/UNIQUE/);
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      db.exec(`DELETE FROM "user" WHERE id = 'user'`);
      expect(db.prepare("SELECT * FROM account").all()).toEqual([]);
    } finally { db.close(); }
  });

  it("stops at duplicate provider keys without dropping or rewriting any identity data", () => {
    const db = fixture();
    try {
      account(db, "first", "google", "issuer-one");
      account(db, "second", "google", "issuer-two");
      const before = db.prepare("SELECT * FROM account").all();
      expect(() => db.exec(migration)).toThrow(/UNIQUE/);
      expect(db.prepare("SELECT * FROM account").all()).toEqual(before);
      expect(db.prepare("PRAGMA table_info(account)").all().find((column) => column.name === "issuer").notnull).toBe(1);
    } finally { db.close(); }
  });
});
