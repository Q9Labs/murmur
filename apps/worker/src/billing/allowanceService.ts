/// <reference types="@cloudflare/workers-types" />

import type { Env } from "../env";
import { currentProAllowancePeriod, freeAllowancePeriod } from "./allowancePeriods";
import { firstProGrantMs } from "./allowanceUpgrade";
import { proAllowanceMs } from "./catalog";
import { callCustomerLedger } from "./customerLedgerDurableObject";
import type { LedgerCommandResult } from "./contracts";

type ActiveSubscriptionRow = {
  anchor_at_ms: number;
  episode_id: string;
  paid_through_ms: number;
};

type UsedFreeRow = { used_free_ms: number };

export type CustomerPlan = "free" | "pro";

export async function currentCustomerPlan(
  database: D1Database | undefined,
  customerId: string,
  nowMs: number,
): Promise<CustomerPlan> {
  return await findActiveSubscription(database, customerId, nowMs) ? "pro" : "free";
}

export async function ensureCurrentAllowance(params: {
  customerId: string;
  env: Env;
  nowMs: number;
  principalProvider: "anonymous" | "email";
  storeEventRowId?: string;
  storeTransactionRowId?: string;
}): Promise<{ response: Response; result: LedgerCommandResult }> {
  const subscription = await findActiveSubscription(
    params.env.BILLING_DB,
    params.customerId,
    params.nowMs,
  );
  if (!subscription) {
    const period = freeAllowancePeriod(params.nowMs);
    return callCustomerLedger(params.env.CUSTOMER_LEDGER, params.customerId, {
      action: "bootstrap_guest",
      customerId: params.customerId,
      nowMs: params.nowMs,
      periodExpiresAtMs: period.expiresAtMs,
      periodKey: period.periodKey,
      periodStartsAtMs: period.startsAtMs,
      principalId: `auth:${params.customerId}`,
      principalProvider: params.principalProvider,
      providerSubject: params.customerId,
    });
  }

  const period = currentProAllowancePeriod({
    anchorAtMs: subscription.anchor_at_ms,
    episodeId: subscription.episode_id,
    nowMs: params.nowMs,
  });
  const expiresAtMs = Math.min(period.expiresAtMs, subscription.paid_through_ms);
  if (expiresAtMs <= period.startsAtMs) {
    throw new Error("active subscription has an invalid allowance period");
  }
  const database = params.env.BILLING_DB;
  if (!database) {
    return unavailable();
  }
  await database
    .prepare(
      `INSERT OR IGNORE INTO allowance_periods
        (allowance_period_id, customer_id, allowance_kind, period_key, starts_at_ms,
         expires_at_ms, allowance_ms, created_at_ms)
       VALUES (?, ?, 'pro', ?, ?, ?, ?, ?)`,
    )
    .bind(
      `period:${params.customerId}:${period.periodKey}`,
      params.customerId,
      period.periodKey,
      period.startsAtMs,
      expiresAtMs,
      proAllowanceMs,
      params.nowMs,
    )
    .run();
  const grantMs = period.periodKey.endsWith(":0")
    ? firstProGrantMs(await usedFreeMs(database, params.customerId, period.startsAtMs))
    : proAllowanceMs;
  if (grantMs <= 0) {
    throw new Error("Free usage exhausted the first Pro allowance period");
  }
  return callCustomerLedger(params.env.CUSTOMER_LEDGER, params.customerId, {
    action: "grant_value",
    amountMs: grantMs,
    customerId: params.customerId,
    expiresAtMs,
    grantKey: period.periodKey,
    grantKind: "pro",
    nowMs: params.nowMs,
    startsAtMs: period.startsAtMs,
    storeEventRowId: params.storeEventRowId ?? null,
    storeTransactionRowId: params.storeTransactionRowId ?? null,
  });
}

async function usedFreeMs(
  database: D1Database,
  customerId: string,
  proStartsAtMs: number,
): Promise<number> {
  const row = await database
    .prepare(
      `SELECT COALESCE(SUM(original_ms - MAX(remaining_ms, 0)), 0) AS used_free_ms
       FROM balance_grants
       WHERE customer_id = ?
         AND grant_kind = 'free'
         AND valid_from_ms <= ?
         AND expires_at_ms > ?`,
    )
    .bind(customerId, proStartsAtMs, proStartsAtMs)
    .first<UsedFreeRow>();
  return row?.used_free_ms ?? 0;
}

async function findActiveSubscription(
  database: D1Database | undefined,
  customerId: string,
  nowMs: number,
): Promise<ActiveSubscriptionRow | null> {
  if (!database) {
    return null;
  }
  return database
    .prepare(
      `SELECT anchor_at_ms, episode_id, paid_through_ms
       FROM subscriptions
       WHERE customer_id = ?
         AND state IN ('active', 'grace', 'billing_retry')
         AND paid_through_ms > ?
       ORDER BY paid_through_ms DESC
       LIMIT 1`,
    )
    .bind(customerId, nowMs)
    .first<ActiveSubscriptionRow>();
}

function unavailable(): { response: Response; result: LedgerCommandResult } {
  const result: LedgerCommandResult = { code: "billing_unavailable", ok: false };
  return { response: Response.json(result, { status: 503 }), result };
}
