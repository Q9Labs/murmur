/// <reference types="@cloudflare/workers-types" />

import { type Env, isBillingEnforced } from "../env";
import { findBillingProduct } from "./catalog";
import {
  fetchRevenueCatCustomerState,
  type RevenueCatPurchase,
  type RevenueCatSubscription,
  type RevenueCatVerifiedResource,
} from "./revenueCatApi";
import type { RevenueCatEvent } from "./revenueCatEvent";
import { processRevenueCatEvent } from "./revenueCatProcessor";

export type ReconciliationTrigger = "daily" | "purchase" | "restore";

type CursorRow = { last_customer_id: string | null };
type CustomerRow = { customer_id: string };
type ResourceStateRow = {
  fingerprint: string;
  state: "applied" | "pending";
  transition_sequence: number;
};
type ResourceTransition = {
  fingerprint: string;
  resourceKey: string;
  transitionSequence: number;
};
type ReconciliationContext = {
  customerId: string;
  env: Env;
  nowMs: number;
};

export async function reconcileRevenueCatCustomer(params: {
  customerId: string;
  env: Env;
  nowMs: number;
  trigger: ReconciliationTrigger;
}): Promise<{ purchaseCount: number; subscriptionCount: number }> {
  const database = params.env.BILLING_DB;
  if (!database) {
    throw new Error("billing database is unavailable for reconciliation");
  }
  const runId = `reconciliation:${crypto.randomUUID()}`;
  await database
    .prepare(
      `INSERT INTO reconciliation_runs
        (reconciliation_run_id, customer_id, trigger_kind, status, subscription_count,
         purchase_count, failure_code, started_at_ms, completed_at_ms)
       VALUES (?, ?, ?, 'running', 0, 0, NULL, ?, NULL)`,
    )
    .bind(runId, params.customerId, params.trigger, params.nowMs)
    .run();
  try {
    const state = await fetchRevenueCatCustomerState({
      appUserId: params.customerId,
      env: params.env,
    });
    let subscriptionCount = 0;
    for (const subscription of state.subscriptions) {
      if (!findBillingProduct(subscription.provider, subscription.productId)) {
        continue;
      }
      await applyReconciledResource(params, subscription);
      subscriptionCount += 1;
    }
    let purchaseCount = 0;
    for (const purchase of state.purchases) {
      if (!findBillingProduct(purchase.provider, purchase.productId)) {
        continue;
      }
      await applyReconciledResource(params, purchase);
      purchaseCount += 1;
    }
    await database
      .prepare(
        `UPDATE reconciliation_runs
         SET status = 'succeeded', subscription_count = ?, purchase_count = ?,
             completed_at_ms = ?
         WHERE reconciliation_run_id = ?`,
      )
      .bind(subscriptionCount, purchaseCount, Date.now(), runId)
      .run();
    return { purchaseCount, subscriptionCount };
  } catch (failure) {
    await database
      .prepare(
        `UPDATE reconciliation_runs
         SET status = 'failed', failure_code = ?, completed_at_ms = ?
         WHERE reconciliation_run_id = ?`,
      )
      .bind(failureCode(failure), Date.now(), runId)
      .run();
    throw failure;
  }
}

export async function reconcileDailyRevenueCatBatch(
  env: Env,
  nowMs: number,
): Promise<{ attempted: number; failed: number }> {
  const database = env.BILLING_DB;
  if (!database || !isBillingEnforced(env)) {
    return { attempted: 0, failed: 0 };
  }
  const cursor = await database
    .prepare("SELECT last_customer_id FROM reconciliation_cursors WHERE job_key = 'revenuecat_daily'")
    .first<CursorRow>();
  const result = await database
    .prepare(
      `SELECT customer_id
       FROM customers
       WHERE state = 'active' AND customer_id > ?
       ORDER BY customer_id
       LIMIT 101`,
    )
    .bind(cursor?.last_customer_id ?? "")
    .all<CustomerRow>();
  const customers = result.results.slice(0, 100);
  let failed = 0;
  for (const customer of customers) {
    try {
      await reconcileRevenueCatCustomer({
        customerId: customer.customer_id,
        env,
        nowMs,
        trigger: "daily",
      });
    } catch {
      failed += 1;
    }
  }
  const lastCustomerId = result.results.length > 100
    ? customers.at(-1)?.customer_id ?? null
    : null;
  await database
    .prepare(
      `INSERT INTO reconciliation_cursors (job_key, last_customer_id, updated_at_ms)
       VALUES ('revenuecat_daily', ?, ?)
       ON CONFLICT(job_key) DO UPDATE SET
         last_customer_id = excluded.last_customer_id,
         updated_at_ms = excluded.updated_at_ms`,
    )
    .bind(lastCustomerId, Date.now())
    .run();
  return { attempted: customers.length, failed };
}

async function applyReconciledResource(
  params: ReconciliationContext,
  resource: RevenueCatVerifiedResource,
): Promise<void> {
  const database = params.env.BILLING_DB;
  if (!database) {
    throw new Error("billing database is unavailable for reconciliation");
  }
  const transition = await prepareResourceTransition(database, params, resource);
  if (!transition) {
    return;
  }
  const event = "episodeId" in resource
    ? subscriptionEvent(params.customerId, resource, transition.transitionSequence, params.nowMs)
    : purchaseEvent(params.customerId, resource, transition.transitionSequence, params.nowMs);
  const result = await processRevenueCatEvent({
    env: params.env,
    event,
    nowMs: params.nowMs,
    payloadHash: `reconciliation:${event.eventId}`,
    verifiedResource: resource,
  });
  if (result.status === "failed") {
    throw new Error(`RevenueCat reconciliation failed: ${result.code}`);
  }
  await markResourceApplied(database, transition);
}

async function prepareResourceTransition(
  database: D1Database,
  params: ReconciliationContext,
  resource: RevenueCatVerifiedResource,
): Promise<ResourceTransition | null> {
  const resourceKey = revenueCatResourceKey(resource);
  const fingerprint = revenueCatResourceFingerprint(resource);
  const existing = await database
    .prepare(
      `SELECT fingerprint, state, transition_sequence
       FROM reconciliation_resource_states
       WHERE resource_key = ?`,
    )
    .bind(resourceKey)
    .first<ResourceStateRow>();
  if (existing?.fingerprint === fingerprint && existing.state === "applied") {
    return null;
  }
  const transitionSequence = existing?.fingerprint === fingerprint
    ? existing.transition_sequence
    : (existing?.transition_sequence ?? 0) + 1;
  const resourceKind = "episodeId" in resource ? "subscription" : "purchase";
  await database
    .prepare(
      `INSERT INTO reconciliation_resource_states
        (resource_key, customer_id, resource_kind, fingerprint, transition_sequence,
         state, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)
       ON CONFLICT(resource_key) DO UPDATE SET
         customer_id = excluded.customer_id,
         resource_kind = excluded.resource_kind,
         fingerprint = excluded.fingerprint,
         transition_sequence = excluded.transition_sequence,
         state = 'pending',
         updated_at_ms = excluded.updated_at_ms`,
    )
    .bind(
      resourceKey,
      params.customerId,
      resourceKind,
      fingerprint,
      transitionSequence,
      params.nowMs,
    )
    .run();
  return { fingerprint, resourceKey, transitionSequence };
}

async function markResourceApplied(
  database: D1Database,
  transition: ResourceTransition,
): Promise<void> {
  const marked = await database
    .prepare(
      `UPDATE reconciliation_resource_states
       SET state = 'applied', updated_at_ms = ?
       WHERE resource_key = ? AND fingerprint = ? AND transition_sequence = ?`,
    )
    .bind(
      Date.now(),
      transition.resourceKey,
      transition.fingerprint,
      transition.transitionSequence,
    )
    .run();
  if (marked.meta.changes !== 1) {
    throw new Error("RevenueCat reconciliation resource state changed concurrently");
  }
}

function subscriptionEvent(
  customerId: string,
  subscription: RevenueCatSubscription,
  transitionSequence: number,
  verifiedAtMs: number,
): RevenueCatEvent {
  return {
    aliases: [],
    appUserId: customerId,
    cancelReason: null,
    environment: subscription.environment,
    eventId: `reconcile:subscription:${subscription.episodeId}:${transitionSequence}`,
    eventTimestampMs: verifiedAtMs,
    expirationAtMs: subscription.paidThroughMs,
    originalAppUserId: customerId,
    originalPurchasedAtMs: subscription.originalPurchasedAtMs,
    originalTransactionId: subscription.storeSubscriptionId,
    productId: subscription.productId,
    provider: subscription.provider,
    purchasedAtMs: subscription.currentPeriodStartsAtMs,
    transactionId: `${subscription.storeSubscriptionId}:${subscription.currentPeriodStartsAtMs}`,
    type: subscription.givesAccess ? "RENEWAL" : "EXPIRATION",
  };
}

function purchaseEvent(
  customerId: string,
  purchase: RevenueCatPurchase,
  transitionSequence: number,
  verifiedAtMs: number,
): RevenueCatEvent {
  const owned = purchase.status === "owned";
  return {
    aliases: [],
    appUserId: customerId,
    cancelReason: owned ? null : "CUSTOMER_SUPPORT",
    environment: purchase.environment,
    eventId: `reconcile:purchase:${purchase.purchaseId}:${transitionSequence}`,
    eventTimestampMs: verifiedAtMs,
    expirationAtMs: null,
    originalAppUserId: customerId,
    originalPurchasedAtMs: purchase.purchasedAtMs,
    originalTransactionId: purchase.storeTransactionId,
    productId: purchase.productId,
    provider: purchase.provider,
    purchasedAtMs: purchase.purchasedAtMs,
    transactionId: purchase.storeTransactionId,
    type: owned ? "NON_RENEWING_PURCHASE" : "CANCELLATION",
  };
}

export function revenueCatResourceKey(resource: RevenueCatVerifiedResource): string {
  return "episodeId" in resource
    ? `${resource.provider}:${resource.environment}:subscription:${resource.episodeId}`
    : `${resource.provider}:${resource.environment}:purchase:${resource.purchaseId}`;
}

export function revenueCatResourceFingerprint(resource: RevenueCatVerifiedResource): string {
  return "episodeId" in resource
    ? [
      resource.productId,
      resource.status,
      resource.givesAccess ? "access" : "no-access",
      resource.currentPeriodStartsAtMs,
      resource.paidThroughMs ?? "none",
      resource.storeSubscriptionId,
    ].join(":")
    : [
      resource.productId,
      resource.status,
      resource.purchasedAtMs,
      resource.storeTransactionId,
    ].join(":");
}

function failureCode(failure: unknown): string {
  const message = failure instanceof Error ? failure.message : "unknown_failure";
  return message.toLowerCase().replace(/[^a-z0-9_:,-]/g, "_").slice(0, 160);
}
