/// <reference types="@cloudflare/workers-types" />

import type { Env } from "../env";
import { currentProAllowancePeriod, freeAllowancePeriod } from "./allowancePeriods";
import { firstProGrantMs } from "./allowanceUpgrade";
import {
  findBillingProduct,
  freeAllowanceMs,
  proMaxAllowanceMs,
  type BillingProduct,
  type StoreProvider,
} from "./catalog";
import { callCustomerLedger } from "./customerLedgerDurableObject";
import { claimFreeAllowance } from "./freeAllowanceClaims";
import type { LedgerCommandResult } from "./contracts";

type ActiveSubscriptionRow = {
  anchor_at_ms: number;
  episode_id: string;
  paid_through_ms: number;
  product_id: string;
  provider: StoreProvider;
};
type ActiveSubscription = ActiveSubscriptionRow & { product: BillingProduct };

type UsedFreeRow = { used_free_ms: number };

export type CustomerPlan = "free" | "pro" | "pro_max";

export async function currentCustomerPlan(
  database: D1Database | undefined,
  customerId: string,
  nowMs: number,
): Promise<CustomerPlan> {
  const subscription = await findActiveSubscription(database, customerId, nowMs);
  if (!subscription) {
    return "free";
  }
  return subscription.product.grantMs === proMaxAllowanceMs ? "pro_max" : "pro";
}

export async function ensureCurrentAllowance(params: {
  customerId: string;
  env: Env;
  freeAllowanceMinutes?: number;
  freeClaimHash?: string | null;
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
    const grantFreeAllowance = await claimFreeAllowance({
      claimHash: params.freeClaimHash,
      customerId: params.customerId,
      database: params.env.BILLING_DB,
      expiresAtMs: period.expiresAtMs,
      nowMs: params.nowMs,
      periodKey: period.periodKey,
    });
    return callCustomerLedger(params.env.CUSTOMER_LEDGER, params.customerId, {
      action: "bootstrap_guest",
      customerId: params.customerId,
      freeAllowanceMs: params.freeAllowanceMinutes === undefined
        ? freeAllowanceMs
        : params.freeAllowanceMinutes * 60_000,
      grantFreeAllowance,
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
      subscription.product.grantMs,
      params.nowMs,
    )
    .run();
  const grantMs = period.periodKey.endsWith(":0")
    ? firstProGrantMs(
      await usedFreeMs(database, params.customerId, period.startsAtMs),
      subscription.product.grantMs,
    )
    : subscription.product.grantMs;
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
): Promise<ActiveSubscription | null> {
  if (!database) {
    return null;
  }
  const rows = await database
    .prepare(
      `SELECT anchor_at_ms, episode_id, paid_through_ms, product_id, provider
       FROM subscriptions
       WHERE customer_id = ?
         AND state IN ('active', 'grace', 'billing_retry')
         AND paid_through_ms > ?`,
    )
    .bind(customerId, nowMs)
    .all<ActiveSubscriptionRow>();
  let selected: ActiveSubscription | null = null;
  for (const row of rows.results) {
    const product = findBillingProduct(row.provider, row.product_id);
    if (!product || product.kind !== "subscription") {
      continue;
    }
    if (!selected || product.grantMs > selected.product.grantMs ||
      (product.grantMs === selected.product.grantMs && row.paid_through_ms > selected.paid_through_ms)) {
      selected = { ...row, product };
    }
  }
  return selected;
}

function unavailable(): { response: Response; result: LedgerCommandResult } {
  const result: LedgerCommandResult = { code: "billing_unavailable", ok: false };
  return { response: Response.json(result, { status: 503 }), result };
}
