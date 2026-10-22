import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { bundleWorkerProof } from "./worker-proof-runtime.mjs";

const { root, script, splitSqlQuery } = await bundleWorkerProof({
  entryPoint: "apps/worker/src/index.ts", mainFields: ["module", "main"],
});
const provider = `const codes = new Map();
export default { async fetch(request) {
  const url = new URL(request.url);
  if (url.hostname === "api.resend.com") {
    if (url.pathname === "/test-otp") return Response.json({ otp: codes.get(url.searchParams.get("email")) });
    const body = await request.json();
    codes.set(body.to[0], body.text.match(/code is (\\d{6})/)[1]);
    return Response.json({ id: "local-test-email" });
  }
  if (url.hostname !== "us.i.posthog.com") throw new Error("unexpected external request: " + url.hostname);
  if (url.pathname !== "/flags/") return Response.json({});
  const body = await request.json();
  const version = body.person_properties.app_version;
  if (version === "1.4.503") return new Response(null, { status: 503 });
  if (version === "1.4.5") return Response.json({ flags: {} });
  const minutes = version === "1.4.0" ? 0 : 5;
  return Response.json({ flags: { free_allowance_minutes: { enabled: true, metadata: { payload: JSON.stringify(minutes) } } } });
} };`;
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
  name: "murmur", modules: true, script,
  compatibilityDate: "2026-05-16", compatibilityFlags: ["nodejs_compat"],
  outboundService: "posthog", d1Databases: ["BILLING_DB"],
  durableObjects: {
    CUSTOMER_LEDGER: { className: "CustomerLedgerDurableObject", useSQLite: true },
    RATE_LIMITER: { className: "RateLimitDurableObject" },
  },
  bindings: {
    MURMUR_ENV: "development", BETTER_AUTH_URL: "https://murmur.test",
    OPENAI_API_KEY: "fake-test-only", POSTHOG_PROJECT_TOKEN: "fake-test-only",
    RESEND_API_KEY: "fake-test-only", EMAIL_FROM: "Murmur <test@murmur.test>",
    BILLING_ENFORCEMENT_ENABLED: "true", BILLING_FULFILLMENT_ENABLED: "true",
  },
}, { name: "posthog", modules: true, script: provider, compatibilityDate: "2026-05-16" }] }));

let checks = 0;
let guestCount = 0;
function pass(message) { checks += 1; console.log(`PASS ${message}`); }
async function jsonResponse(response, status = 200) {
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body));
  return body;
}
function headers(guest, version) {
  return {
    "Content-Type": "application/json", Cookie: guest.cookie, "cf-connecting-ip": guest.ip,
    "x-murmur-install-id": guest.install, "x-murmur-free-allowance-id": guest.install,
    "x-murmur-app-version": version, "x-murmur-app-platform": "ios",
  };
}
async function guest(version, withInstall = true) {
  const value = { cookie: "", install: randomUUID(), ip: `192.0.2.${++guestCount}` };
  const requestHeaders = headers(value, version);
  if (!withInstall) delete requestHeaders["x-murmur-install-id"];
  const response = await mf.dispatchFetch("https://murmur.test/api/auth/sign-in/anonymous", {
    method: "POST", headers: requestHeaders, body: "{}",
  });
  const body = await jsonResponse(response);
  value.cookie = response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
  assert.ok(value.cookie, "anonymous sign-in sets a cookie");
  value.id = body.user.id;
  return value;
}
async function linkAccount(value, version) {
  const email = `${randomUUID()}@example.test`;
  const requestHeaders = { ...headers(value, version), Origin: "murmur://" };
  await jsonResponse(await mf.dispatchFetch("https://murmur.test/api/auth/email-otp/send-verification-otp", {
    method: "POST", headers: requestHeaders, body: JSON.stringify({ email, type: "sign-in" }),
  }));
  const mail = await mf.getWorker("posthog");
  const { otp } = await jsonResponse(await mail.fetch(`https://api.resend.com/test-otp?email=${encodeURIComponent(email)}`));
  assert.match(otp, /^\d{6}$/);
  const response = await mf.dispatchFetch("https://murmur.test/api/auth/sign-in/email-otp", {
    method: "POST", headers: requestHeaders, body: JSON.stringify({ email, otp }),
  });
  const body = await jsonResponse(response);
  assert.notEqual(body.user.id, value.id);
  assert.equal(body.user.isAnonymous, false);
  const cookie = response.headers.getSetCookie().map((entry) => entry.split(";")[0]).join("; ");
  assert.ok(cookie, "email sign-in replaces the guest cookie");
  return { ...value, cookie, id: body.user.id };
}
async function customer(value, version, withInstall = true) {
  const requestHeaders = headers(value, version);
  if (!withInstall) delete requestHeaders["x-murmur-install-id"];
  return jsonResponse(await mf.dispatchFetch("https://murmur.test/v3/customer", { headers: requestHeaders }));
}
async function session(value, version, status) {
  return jsonResponse(await mf.dispatchFetch("https://murmur.test/v2/session", {
    method: "POST", headers: headers(value, version), body: JSON.stringify({
      app_install_id: value.install, app_version: version, app_platform: "ios",
      source_language: "en", target_language: "ar", analytics_enabled: false,
    }),
  }), status);
}
async function claimGift(value, version) {
  return jsonResponse(await mf.dispatchFetch("https://murmur.test/v3/gifts/phone-audio/claim", {
    method: "POST", headers: headers(value, version), body: "{}",
  }));
}
async function grantCredit(value) {
  const namespace = await mf.getDurableObjectNamespace("CUSTOMER_LEDGER", "murmur");
  const ledger = namespace.get(namespace.idFromName(value.id));
  const now = Date.now();
  return jsonResponse(await ledger.fetch("https://ledger.internal/command", {
    method: "POST", headers: { "Content-Type": "application/json", "x-murmur-ledger-internal": "1" },
    body: JSON.stringify({
      action: "grant_value", customerId: value.id, amountMs: 3_600_000,
      grantKind: "credit_pack", grantKey: `proof:${randomUUID()}`, nowMs: now,
      startsAtMs: now, expiresAtMs: null, storeEventRowId: null, storeTransactionRowId: null,
    }),
  }));
}

try {
  const database = await mf.getD1Database("BILLING_DB", "murmur");
  const migrations = resolve(root, "apps/worker/migrations");
  for (const name of (await readdir(migrations)).sort()) {
    if (!name.endsWith(".sql")) continue;
    await database.batch(splitSqlQuery(await readFile(resolve(migrations, name), "utf8")).map((sql) => database.prepare(sql)));
  }
  const hard = await guest("1.4.0");
  const empty = await customer(hard, "1.4.0");
  assert.equal(empty.free_allowance_ms, 0);
  assert.equal(empty.balance.available_ms, 0);
  assert.deepEqual(empty.gifts.phone_audio, { claimable: false, remaining_ms: 0 });
  const rows = async (table, id) => database.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE customer_id = ?`).bind(id).first("count");
  assert.equal(await rows("customers", hard.id), 1);
  assert.equal(await rows("balance_grants", hard.id), 0);
  assert.equal(await rows("free_allowance_claims", hard.id), 0);
  pass("hard-mode sign-up and customer bootstrap create no Free balance or claim");
  assert.equal((await session(hard, "1.4.0", 402)).error, "allowance_exhausted");
  assert.equal(await rows("balance_grants", hard.id), 0);
  assert.equal((await customer(hard, "1.4.0")).balance.available_ms, 0);
  pass("POST /v2/session returns 402 and mints nothing");
  for (let index = 0; index < 2; index += 1) {
    assert.deepEqual(await claimGift(hard, "1.4.0"), { phone_audio: { claimable: false, remaining_ms: 0 } });
  }
  assert.equal(await rows("phone_audio_gifts", hard.id), 0);
  pass("hard-mode gift claims are idempotent no-ops");
  const reverted = await customer(hard, "1.4.1");
  assert.equal(reverted.balance.available_ms, 300_000);
  assert.equal(reverted.free_allowance_ms, 300_000);
  assert.equal(await rows("free_allowance_claims", hard.id), 1);
  pass("same-month rollback grants Free because hard mode did not burn the claim");
  const existing = await guest("1.4.1");
  assert.equal((await customer(existing, "1.4.1")).balance.available_ms, 300_000);
  assert.deepEqual(await claimGift(existing, "1.4.1"), { phone_audio: { claimable: false, remaining_ms: 180_000 } });
  const flipped = await customer(existing, "1.4.0");
  assert.equal(flipped.free_allowance_ms, 0);
  assert.equal(flipped.balance.available_ms, 300_000);
  assert.deepEqual(await claimGift(existing, "1.4.0"), { phone_audio: { claimable: false, remaining_ms: 180_000 } });
  await session(existing, "1.4.0", 200);
  pass("pre-flip Free and Phone audio gift survive; existing balance starts a session");
  const paid = await guest("1.4.0");
  assert.equal((await grantCredit(paid)).ok, true);
  const credit = await customer(paid, "1.4.0");
  assert.equal(credit.balance.allowance_ms, 0);
  assert.equal(credit.balance.credit_ms, 3_600_000);
  await session(paid, "1.4.0", 200);
  pass("paid credit through the ledger command path unlocks hard mode without Free");
  const buyer = await guest("1.4.0");
  assert.equal((await grantCredit(buyer)).ok, true);
  const registered = await linkAccount(buyer, "1.4.0");
  const saved = await customer(registered, "1.4.0");
  assert.equal(saved.balance.credit_ms, 3_600_000);
  assert.equal(saved.balance.available_ms, 3_600_000);
  assert.equal(saved.balance.allowance_ms, 0);
  assert.equal(await rows("free_allowance_claims", registered.id), 0);
  assert.equal(await database.prepare("SELECT COUNT(*) AS count FROM balance_grants WHERE customer_id = ? AND grant_kind = 'free'").bind(registered.id).first("count"), 0);
  assert.equal(await database.prepare("SELECT canonical_customer_id FROM customer_aliases WHERE alias_customer_id = ?").bind(buyer.id).first("canonical_customer_id"), registered.id);
  pass("hard-mode buyer saves paid credit through email OTP account linking without a Free grant");
  const beforeFlip = await guest("1.4.1");
  const namespace = await mf.getDurableObjectNamespace("CUSTOMER_LEDGER", "murmur");
  const usageSessionId = randomUUID();
  const ledgerCommand = async ({ customerId, ...command }) => jsonResponse(await namespace.get(namespace.idFromName(customerId)).fetch("https://ledger.internal/command", {
    method: "POST", headers: { "Content-Type": "application/json", "x-murmur-ledger-internal": "1" },
    body: JSON.stringify({ ...command, customerId, nowMs: Date.now() }),
  }));
  await ledgerCommand({ customerId: beforeFlip.id, action: "open_usage_session", usageSessionId });
  await ledgerCommand({ customerId: beforeFlip.id, action: "settle_usage", usageSessionId, settlementSequence: 1, amountMs: 120_000 });
  await ledgerCommand({ customerId: beforeFlip.id, action: "close_usage_session", usageSessionId, outcome: "closed" });
  assert.equal((await customer(beforeFlip, "1.4.1")).balance.allowance_ms, 180_000);
  const originalFree = await database.prepare("SELECT grant_id, grant_key, original_ms, remaining_ms, expires_at_ms FROM balance_grants WHERE customer_id = ? AND grant_kind = 'free'").bind(beforeFlip.id).first();
  const linkedAfterFlip = await linkAccount(beforeFlip, "1.4.0");
  const preserved = await customer(linkedAfterFlip, "1.4.0");
  assert.equal(preserved.free_allowance_ms, 0);
  assert.equal(preserved.balance.allowance_ms, 180_000);
  assert.equal(preserved.balance.available_ms, 180_000);
  assert.equal(preserved.balance.credit_ms, 0);
  const transferredFree = await database.prepare("SELECT grant_id, grant_key, original_ms, remaining_ms, expires_at_ms FROM balance_grants WHERE customer_id = ? AND grant_kind = 'free'").bind(linkedAfterFlip.id).all();
  const canonicalFree = { ...originalFree, grant_id: `grant:${linkedAfterFlip.id}:${originalFree.grant_key}` };
  assert.deepEqual(transferredFree.results, [canonicalFree]);
  assert.equal(await database.prepare("SELECT allowance_period_id FROM allowance_periods WHERE customer_id = ? AND period_key = ?").bind(linkedAfterFlip.id, originalFree.grant_key).first("allowance_period_id"), `period:${linkedAfterFlip.id}:${originalFree.grant_key}`);
  assert.equal(await database.prepare("SELECT COUNT(*) AS count FROM balance_grants WHERE customer_id = ? AND grant_kind = 'free'").bind(beforeFlip.id).first("count"), 1);
  assert.equal(await rows("free_allowance_claims", beforeFlip.id), 0);
  assert.equal(await rows("free_allowance_claims", linkedAfterFlip.id), 1);
  pass("pre-flip guest spends 120000 ms, then OTP linking in hard mode preserves exactly 180000 ms and a destination-canonical Free grant");
  for (let retry = 0; retry < 2; retry += 1) {
    const rolledBack = await customer(linkedAfterFlip, "1.4.1");
    assert.equal(rolledBack.free_allowance_ms, 300_000);
    assert.equal(rolledBack.balance.allowance_ms, 180_000);
    assert.equal(rolledBack.balance.available_ms, 180_000);
  }
  await session(linkedAfterFlip, "1.4.1", 200);
  const afterRollbackFree = await database.prepare("SELECT grant_id, grant_key, original_ms, remaining_ms, expires_at_ms FROM balance_grants WHERE customer_id = ? AND grant_kind = 'free'").bind(linkedAfterFlip.id).all();
  assert.deepEqual(afterRollbackFree.results, [canonicalFree]);
  assert.equal(await rows("free_allowance_claims", linkedAfterFlip.id), 1);
  pass("same-month rollback after hard-mode OTP linking reuses the canonical Free grant and starts a session without adding minutes");
  const exhausted = await guest("1.4.1");
  const exhaustedSessionId = randomUUID();
  await ledgerCommand({ customerId: exhausted.id, action: "open_usage_session", usageSessionId: exhaustedSessionId });
  await ledgerCommand({ customerId: exhausted.id, action: "settle_usage", usageSessionId: exhaustedSessionId, settlementSequence: 1, amountMs: 300_000 });
  await ledgerCommand({ customerId: exhausted.id, action: "close_usage_session", usageSessionId: exhaustedSessionId, outcome: "closed" });
  const exhaustedFree = await database.prepare("SELECT grant_id, grant_key, original_ms, remaining_ms, expires_at_ms, state FROM balance_grants WHERE customer_id = ? AND grant_kind = 'free'").bind(exhausted.id).first();
  assert.equal(exhaustedFree.remaining_ms, 0);
  const exhaustedEntryCount = await rows("ledger_entries", exhausted.id);
  const linkedExhausted = await linkAccount(exhausted, "1.4.0");
  for (let retry = 0; retry < 2; retry += 1) {
    const rolledBack = await customer(linkedExhausted, "1.4.1");
    assert.equal(rolledBack.free_allowance_ms, 300_000);
    assert.equal(rolledBack.balance.allowance_ms, 0);
    assert.equal(rolledBack.balance.available_ms, 0);
  }
  const afterExhaustedRollback = await database.prepare("SELECT grant_id, grant_key, original_ms, remaining_ms, expires_at_ms, state FROM balance_grants WHERE customer_id = ? AND grant_kind = 'free'").bind(linkedExhausted.id).all();
  assert.deepEqual(afterExhaustedRollback.results, [{ ...exhaustedFree, grant_id: `grant:${linkedExhausted.id}:${exhaustedFree.grant_key}` }]);
  assert.equal(await database.prepare("SELECT allowance_period_id FROM allowance_periods WHERE customer_id = ? AND period_key = ?").bind(linkedExhausted.id, exhaustedFree.grant_key).first("allowance_period_id"), `period:${linkedExhausted.id}:${exhaustedFree.grant_key}`);
  assert.equal(await database.prepare("SELECT COUNT(*) AS count FROM balance_grants WHERE customer_id = ? AND grant_kind = 'free'").bind(exhausted.id).first("count"), 1);
  assert.equal(await rows("free_allowance_claims", exhausted.id), 0);
  assert.equal(await rows("free_allowance_claims", linkedExhausted.id), 1);
  assert.equal(await rows("ledger_entries", exhausted.id) + await rows("ledger_entries", linkedExhausted.id), exhaustedEntryCount);
  pass("exhausted pre-flip Free grant survives hard-mode OTP linking and repeated same-month rollback without new minutes or ledger entries");
  const beforeRollback = await guest("1.4.0");
  const linkedAfterRollback = await linkAccount(beforeRollback, "1.4.1");
  assert.equal(await rows("free_allowance_claims", beforeRollback.id), 0);
  assert.equal(await rows("free_allowance_claims", linkedAfterRollback.id), 1);
  assert.equal((await customer(linkedAfterRollback, "1.4.1")).balance.allowance_ms, 300_000);
  pass("hard-mode guest linking after rollback creates and transfers the same-month Free claim");
  for (const version of ["1.4.5", "1.4.503"]) {
    const freemium = await guest(version);
    const current = await customer(freemium, version);
    assert.equal(current.free_allowance_ms, 300_000);
    assert.equal(current.balance.available_ms, 300_000);
    assert.equal(current.gifts.phone_audio.claimable, true);
    await session(freemium, version, 200);
    assert.equal((await customer(freemium, version)).balance.available_ms, 300_000);
    assert.equal(await rows("balance_grants", freemium.id), 1);
    pass(`${version === "1.4.5" ? "no flag" : "PostHog 503"} preserves new and existing freemium customers`);
  }
  const legacy = await guest("1.4.0", false);
  assert.equal((await customer(legacy, "1.4.0", false)).free_allowance_ms, 0);
  assert.equal(await rows("balance_grants", legacy.id), 0);
  pass("sign-up without install identity still evaluates hard-mode policy");
  const legacyGift = await guest("1.4.0");
  assert.deepEqual(await claimGift(legacyGift, "1.4.0"), { phone_audio: { claimable: false, remaining_ms: 0 } });
  const legacyClaim = await jsonResponse(await mf.dispatchFetch("https://murmur.test/v3/gifts/phone-audio/claim", {
    method: "POST", headers: { Cookie: legacyGift.cookie, "cf-connecting-ip": legacyGift.ip },
  }));
  assert.deepEqual(legacyClaim, { phone_audio: { claimable: false, remaining_ms: 180_000 } });
  assert.equal(await rows("phone_audio_gifts", legacyGift.id), 1);
  pass("legacy gift claim without release or install headers stays freemium under a version-targeted flag");
  console.log(`Hard paywall proof passed (${checks} scenarios).`);
} finally {
  await mf.dispose();
}
