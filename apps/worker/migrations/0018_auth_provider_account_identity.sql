-- Better Auth 1.7.3+ identifies accounts by providerId/accountId and no longer writes issuer.
-- Fail before changing data if legacy issuers contain ambiguous provider account keys.
CREATE UNIQUE INDEX "account_providerId_accountId_guard" ON "account" ("providerId", "accountId");

CREATE TABLE "account_compatible" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "issuer" TEXT,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" DATE,
  "refreshTokenExpiresAt" DATE,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

INSERT INTO "account_compatible" ("id", "issuer", "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", "scope", "password", "createdAt", "updatedAt")
SELECT "id", "issuer", "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", "scope", "password", "createdAt", "updatedAt" FROM "account";

DROP TABLE "account";
ALTER TABLE "account_compatible" RENAME TO "account";
CREATE INDEX "account_userId_idx" ON "account" ("userId");
CREATE UNIQUE INDEX "account_providerId_accountId_uidx" ON "account" ("providerId", "accountId");

INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (18, 'auth_provider_account_identity', unixepoch('subsec') * 1000);
