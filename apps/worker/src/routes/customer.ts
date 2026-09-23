/// <reference types="@cloudflare/workers-types" />

import { getMurmurSession } from "../auth/auth";
import {
  currentCustomerPlan,
  ensureCurrentAllowance,
} from "../billing/allowanceService";
import { callCustomerLedger } from "../billing/customerLedgerDurableObject";
import { freeAllowanceClaimHashFromRequest } from "../billing/freeAllowanceClaims";
import { areBillingPurchasesEnabled, isBillingFulfillmentEnabled, type Env } from "../env";
import { revenueCatCustomerId } from "../billing/revenueCatIdentity";
import { getPhoneAudioGift } from "../billing/phoneAudioGift";
import { json } from "../http/response";
import { hashInstallId } from "../privacy";
import { defaultServerConfig, getServerConfig, sessionLimitSeconds } from "../serverConfig";

type CreditPackRow = {
  expires_at_ms: number;
  grant_id: string;
  remaining_ms: number;
};

export async function getCustomer(
  request: Request,
  env: Env,
  context?: ExecutionContext,
): Promise<Response> {
  const session = await getMurmurSession(request, env, context);
  if (!session) {
    return json({ error: "authentication_required" }, 401);
  }

  const nowMs = Date.now();
  const freeClaimHash = await freeAllowanceClaimHashFromRequest(request, env);
  const bootstrap = await ensureCurrentAllowance({
    customerId: session.user.id,
    env,
    freeClaimHash,
    nowMs,
    principalProvider: session.user.isAnonymous === true ? "anonymous" : "email",
  });
  if (!bootstrap.result.ok) {
    return json({ error: bootstrap.result.code }, bootstrap.response.status);
  }

  const ledger = await callCustomerLedger(env.CUSTOMER_LEDGER, session.user.id, {
    action: "get_balance",
    customerId: session.user.id,
    nowMs,
  });
  if (!ledger.result.ok || !("balance" in ledger.result)) {
    return json({ error: ledger.result.ok ? "billing_unavailable" : ledger.result.code }, ledger.response.status);
  }
  const plan = await currentCustomerPlan(env.BILLING_DB, session.user.id, nowMs);
  const gift = env.BILLING_DB
    ? await getPhoneAudioGift(env.BILLING_DB, session.user.id)
    : { claimable: true, remaining_ms: 0 };
  const installId = request.headers.get("x-murmur-install-id");
  const config = installId && installId.length >= 8
    ? await getServerConfig(env, {
      appVersion: request.headers.get("x-murmur-app-version"),
      distinctId: `anonymous_install_${await hashInstallId(installId, env.SESSION_HASH_SALT ?? "local-development-salt")}`,
      plan,
      platform: request.headers.get("x-murmur-app-platform"),
    })
    : defaultServerConfig(env);
  const creditPacks = env.BILLING_DB
    ? (await env.BILLING_DB.prepare(
      `SELECT grant_id, remaining_ms, expires_at_ms
       FROM balance_grants
       WHERE customer_id = ? AND grant_kind = 'credit_pack'
         AND remaining_ms > 0 AND expires_at_ms > ?
       ORDER BY expires_at_ms, grant_id`,
    ).bind(session.user.id, nowMs).all<CreditPackRow>()).results
    : [];
  const paid = plan !== "free";

  return json({
    balance: {
      allowance_ms: ledger.result.balance.allowanceMs,
      available_ms: ledger.result.balance.availableMs,
      credit_ms: ledger.result.balance.creditMs,
      earliest_expiry_at_ms: ledger.result.balance.earliestExpiryAtMs,
      negative_ms: ledger.result.balance.negativeMs,
    },
    customer_id: session.user.id,
    credit_packs: creditPacks,
    entitlements: { pro: paid, pro_max: plan === "pro_max" },
    features: {
      phone_audio: paid || gift.remaining_ms > 0,
      history: paid,
      max_session_seconds: sessionLimitSeconds(config, plan),
    },
    fulfillment_enabled: isBillingFulfillmentEnabled(env),
    is_registered: session.user.isAnonymous !== true,
    gifts: { phone_audio: gift },
    plan,
    purchases_enabled: areBillingPurchasesEnabled(env),
    revenuecat_customer_id: revenueCatCustomerId(env, session.user.id),
  });
}
