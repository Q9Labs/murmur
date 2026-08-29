/// <reference types="@cloudflare/workers-types" />

import type { Env } from "../env";
import { ensureCurrentAllowance } from "./allowanceService";
import { findBillingProduct, type BillingProduct } from "./catalog";
import { callCustomerLedger } from "./customerLedgerDurableObject";
import {
  type RevenueCatPurchase,
  type RevenueCatSubscription,
  type RevenueCatVerifiedResource,
  verifyRevenueCatEvent,
} from "./revenueCatApi";
import {
  isIgnoredRevenueCatEventType,
  revenueCatCustomerIds,
  type RevenueCatEvent,
} from "./revenueCatEvent";
import {
  RevenueCatEventRepository,
  type SubscriptionCursorClaim,
} from "./revenueCatEventRepository";

export type RevenueCatProcessResult =
  | { eventId: string; idempotent: boolean; status: "applied" | "ignored" }
  | { code: string; status: "failed" };

type RevenueCatProcessParams = {
  env: Env;
  event: RevenueCatEvent;
  nowMs: number;
  payloadHash: string;
  verifiedResource?: RevenueCatVerifiedResource;
};

type VerifiedProduct = {
  product: BillingProduct;
  purchase: RevenueCatPurchase | null;
  subscription: RevenueCatSubscription | null;
};

type EventContext = VerifiedProduct & {
  customerId: string;
  customerIsActive: boolean;
  env: Env;
  event: RevenueCatEvent;
  eventRowId: string;
  nowMs: number;
  repository: RevenueCatEventRepository;
};

type PreparedEvent =
  | { context: EventContext; kind: "context" }
  | { kind: "result"; result: RevenueCatProcessResult };

type CursorState = {
  claim: SubscriptionCursorClaim | null;
  lifecycleRank: number | null;
};

type PreparedCursor =
  | { cursor: CursorState; kind: "cursor" }
  | { kind: "result"; result: RevenueCatProcessResult };

const purchaseEventTypes = new Set([
  "INITIAL_PURCHASE",
  "NON_RENEWING_PURCHASE",
  "RENEWAL",
]);

const subscriptionStateEventTypes = new Set([
  "BILLING_ISSUE",
  "EXPIRATION",
  "SUBSCRIPTION_EXTENDED",
  "SUBSCRIPTION_PAUSED",
  "UNCANCELLATION",
]);

export async function processRevenueCatEvent(
  params: RevenueCatProcessParams,
): Promise<RevenueCatProcessResult> {
  const prepared = await prepareRevenueCatEvent(params);
  if (prepared.kind === "result") {
    return prepared.result;
  }
  const cursor = await prepareSubscriptionCursor(prepared.context);
  if (cursor.kind === "result") {
    return cursor.result;
  }
  return applyPendingEvent(prepared.context, cursor.cursor);
}

async function prepareRevenueCatEvent(params: RevenueCatProcessParams): Promise<PreparedEvent> {
  const database = params.env.BILLING_DB;
  if (!database) {
    return result({ code: "billing_unavailable", status: "failed" });
  }
  const repository = new RevenueCatEventRepository(database);
  if (isIgnoredRevenueCatEventType(params.event.type)) {
    return result(await processIgnoredEvent(params, repository));
  }
  const verifiedProduct = await verifyEventProduct(params);
  if (verifiedProduct.kind === "result") {
    return verifiedProduct;
  }
  return prepareCustomerEvent(params, repository, verifiedProduct.product);
}

async function verifyEventProduct(
  params: RevenueCatProcessParams,
): Promise<
  | { kind: "product"; product: VerifiedProduct }
  | { kind: "result"; result: RevenueCatProcessResult }
> {
  if (!params.event.provider || !params.event.productId) {
    return result({ code: "unsupported_store_event", status: "failed" });
  }
  const product = findBillingProduct(params.event.provider, params.event.productId);
  if (!product) {
    return result({ code: "unknown_product", status: "failed" });
  }
  const verified = await verifiedResourceForEvent(params);
  if (!verified) {
    return result({ code: "product_verification_failed", status: "failed" });
  }
  const verifiedProduct = classifyVerifiedProduct(product, verified);
  if (!verifiedProduct) {
    return result({ code: "product_kind_verification_failed", status: "failed" });
  }
  return { kind: "product", product: verifiedProduct };
}

async function verifiedResourceForEvent(
  params: RevenueCatProcessParams,
): Promise<RevenueCatVerifiedResource | null> {
  if (params.verifiedResource) {
    return params.verifiedResource;
  }
  return verifyRevenueCatEvent({ env: params.env, event: params.event });
}

function classifyVerifiedProduct(
  product: BillingProduct,
  resource: RevenueCatVerifiedResource,
): VerifiedProduct | null {
  if ("episodeId" in resource) {
    if (product.kind !== "subscription") {
      return null;
    }
    return { product, purchase: null, subscription: resource };
  }
  if (product.kind !== "credit_pack") {
    return null;
  }
  return { product, purchase: resource, subscription: null };
}

async function prepareCustomerEvent(
  params: RevenueCatProcessParams,
  repository: RevenueCatEventRepository,
  verified: VerifiedProduct,
): Promise<PreparedEvent> {
  const customerId = await repository.resolveCustomerId(revenueCatCustomerIds(params.event));
  if (!customerId) {
    return result({ code: "customer_not_found", status: "failed" });
  }
  const customerIsActive = await repository.customerIsActive(customerId);
  const stored = await repository.recordPending(
    params.event,
    customerId,
    params.payloadHash,
    params.nowMs,
    verified.subscription?.episodeId ?? null,
  );
  if (stored.idempotent) {
    return result({ eventId: params.event.eventId, idempotent: true, status: "applied" });
  }
  return {
    context: {
      ...verified,
      customerId,
      customerIsActive,
      env: params.env,
      event: params.event,
      eventRowId: stored.eventRowId,
      nowMs: params.nowMs,
      repository,
    },
    kind: "context",
  };
}

async function prepareSubscriptionCursor(context: EventContext): Promise<PreparedCursor> {
  const lifecycleRank = subscriptionLifecycleRank(context.event, context.product.kind);
  if (lifecycleRank === null) {
    return { cursor: { claim: null, lifecycleRank: null }, kind: "cursor" };
  }
  const claim = await context.repository.claimSubscriptionCursor(
    context.event,
    requireSubscription(context.subscription).episodeId,
    lifecycleRank,
    context.nowMs,
  );
  if (claim.advanced) {
    return { cursor: { claim, lifecycleRank }, kind: "cursor" };
  }
  if (context.event.type === "INITIAL_PURCHASE" || context.event.type === "RENEWAL") {
    await context.repository.upsertTransaction({
      customerId: context.customerId,
      event: context.event,
      eventRowId: context.eventRowId,
      product: context.product,
      status: "purchased",
    });
  }
  await context.repository.markEvent(
    context.eventRowId,
    "ignored_stale",
    "stale_subscription_event",
  );
  return result({ eventId: context.event.eventId, idempotent: false, status: "ignored" });
}

async function applyPendingEvent(
  context: EventContext,
  cursor: CursorState,
): Promise<RevenueCatProcessResult> {
  try {
    if (!await applyRevenueCatEvent(context)) {
      await context.repository.markEvent(
        context.eventRowId,
        "ignored_stale",
        "unsupported_event_type",
      );
      return { eventId: context.event.eventId, idempotent: false, status: "ignored" };
    }
    await context.repository.markEvent(context.eventRowId, "applied", null);
    return { eventId: context.event.eventId, idempotent: false, status: "applied" };
  } catch (failure) {
    await restoreCursorAfterFailure(context, cursor);
    await context.repository.markEvent(context.eventRowId, "failed", failureCode(failure));
    throw failure;
  }
}

async function processIgnoredEvent(
  params: RevenueCatProcessParams,
  repository: RevenueCatEventRepository,
): Promise<RevenueCatProcessResult> {
  const customerId = await repository.resolveCustomerId(revenueCatCustomerIds(params.event));
  if (!customerId || params.event.type === "TEST") {
    return { eventId: params.event.eventId, idempotent: false, status: "ignored" };
  }
  const stored = await repository.recordPending(
    params.event,
    customerId,
    params.payloadHash,
    params.nowMs,
    null,
  );
  if (!stored.idempotent) {
    await repository.markEvent(stored.eventRowId, "ignored_stale", "non_entitlement_event");
  }
  return { eventId: params.event.eventId, idempotent: stored.idempotent, status: "ignored" };
}

async function applyRevenueCatEvent(context: EventContext): Promise<boolean> {
  if (purchaseEventTypes.has(context.event.type)) {
    await applyPurchase(context);
    return true;
  }
  if (subscriptionStateEventTypes.has(context.event.type)) {
    await updateVerifiedSubscription(context.repository, context.event, context.subscription);
    return true;
  }
  if (context.event.type === "CANCELLATION") {
    await applyCancellation(context);
    return true;
  }
  if (context.event.type === "REFUND_REVERSED") {
    await applyRefundReversal(context);
    return true;
  }
  return false;
}

async function applyPurchase(context: EventContext): Promise<void> {
  if (context.product.kind === "credit_pack") {
    await synchronizeCreditPack(context);
    return;
  }
  const subscription = requireSubscription(context.subscription);
  const transactionRowId = await context.repository.upsertTransaction({
    customerId: context.customerId,
    event: context.event,
    eventRowId: context.eventRowId,
    product: context.product,
    status: "purchased",
  });
  await context.repository.upsertSubscription({
    customerId: context.customerId,
    event: context.event,
    state: subscriptionState(subscription),
    subscription,
  });
  if (!context.customerIsActive) {
    return;
  }
  const allowance = await ensureCurrentAllowance({
    customerId: context.customerId,
    env: context.env,
    nowMs: context.nowMs,
    principalProvider: "email",
    storeEventRowId: context.eventRowId,
    storeTransactionRowId: transactionRowId,
  });
  if (!allowance.result.ok) {
    throw new Error(`pro allowance failed: ${allowance.result.code}`);
  }
}

async function applyCancellation(context: EventContext): Promise<void> {
  if (context.product.kind === "credit_pack") {
    await synchronizeCreditPack(context);
    return;
  }
  if (context.event.cancelReason !== "CUSTOMER_SUPPORT") {
    return;
  }
  await context.repository.upsertTransaction({
    customerId: context.customerId,
    event: context.event,
    eventRowId: context.eventRowId,
    product: context.product,
    status: "refunded",
  });
  await reverseRefundedGrants(
    context.env,
    context.repository,
    context.customerId,
    context.event,
    context.subscription?.episodeId ?? null,
    context.eventRowId,
    context.nowMs,
  );
  const subscription = requireSubscription(context.subscription);
  if (subscription.givesAccess) {
    await updateVerifiedSubscription(context.repository, context.event, subscription);
    return;
  }
  await context.repository.updateSubscriptionState(
    context.event,
    subscription.episodeId,
    "revoked",
    context.event.expirationAtMs ?? subscription.paidThroughMs,
  );
}

async function applyRefundReversal(context: EventContext): Promise<void> {
  if (context.product.kind === "credit_pack") {
    await synchronizeCreditPack(context);
    return;
  }
  await context.repository.upsertTransaction({
    customerId: context.customerId,
    event: context.event,
    eventRowId: context.eventRowId,
    product: context.product,
    status: "purchased",
  });
  await restoreRefundedGrants(
    context.env,
    context.repository,
    context.customerId,
    context.event,
    context.subscription?.episodeId ?? null,
    context.eventRowId,
    context.nowMs,
  );
  await updateVerifiedSubscription(context.repository, context.event, context.subscription);
}

async function restoreCursorAfterFailure(
  context: EventContext,
  cursor: CursorState,
): Promise<void> {
  if (cursor.lifecycleRank === null || !cursor.claim?.advanced) {
    return;
  }
  await context.repository.restoreSubscriptionCursor(
    context.event,
    requireSubscription(context.subscription).episodeId,
    cursor.lifecycleRank,
    cursor.claim.previous,
    context.nowMs,
  );
}

function result(
  resultValue: RevenueCatProcessResult,
): { kind: "result"; result: RevenueCatProcessResult } {
  return { kind: "result", result: resultValue };
}

async function synchronizeCreditPack(params: {
  customerId: string;
  customerIsActive: boolean;
  env: Env;
  event: RevenueCatEvent;
  eventRowId: string;
  nowMs: number;
  product: BillingProduct;
  purchase: RevenueCatPurchase | null;
  repository: RevenueCatEventRepository;
}): Promise<void> {
  if (params.product.kind !== "credit_pack") {
    throw new Error("credit synchronization received a subscription product");
  }
  const purchase = requirePurchase(params.purchase);
  const owned = purchase.status === "owned";
  const transactionRowId = await params.repository.upsertTransaction({
    customerId: params.customerId,
    event: params.event,
    eventRowId: params.eventRowId,
    product: params.product,
    status: owned ? "purchased" : "refunded",
  });
  if (!owned) {
    await reverseRefundedGrants(
      params.env,
      params.repository,
      params.customerId,
      params.event,
      null,
      params.eventRowId,
      params.nowMs,
    );
    return;
  }
  if (params.customerIsActive) {
    const grant = await callCustomerLedger(params.env.CUSTOMER_LEDGER, params.customerId, {
      action: "grant_value",
      amountMs: params.product.grantMs,
      customerId: params.customerId,
      expiresAtMs: null,
      grantKey: `store:${params.event.provider}:${params.event.environment}:${params.event.transactionId}`,
      grantKind: "credit_pack",
      nowMs: params.nowMs,
      startsAtMs: params.event.purchasedAtMs ?? params.nowMs,
      storeEventRowId: params.eventRowId,
      storeTransactionRowId: transactionRowId,
    });
    if (!grant.result.ok) {
      throw new Error(`credit grant failed: ${grant.result.code}`);
    }
  }
  await restoreRefundedGrants(
    params.env,
    params.repository,
    params.customerId,
    params.event,
    null,
    params.eventRowId,
    params.nowMs,
  );
}

async function updateVerifiedSubscription(
  repository: RevenueCatEventRepository,
  event: RevenueCatEvent,
  subscription: RevenueCatSubscription | null,
): Promise<void> {
  const verified = requireSubscription(subscription);
  await repository.updateSubscriptionState(
    event,
    verified.episodeId,
    subscriptionState(verified),
    event.expirationAtMs ?? verified.paidThroughMs,
  );
}

function subscriptionState(
  subscription: RevenueCatSubscription,
): "active" | "expired" | "grace" | "on_hold" | "paused" {
  if (subscription.givesAccess) {
    return subscription.status === "in_grace_period" ? "grace" : "active";
  }
  if (subscription.status === "in_billing_retry") {
    return "on_hold";
  }
  return subscription.status === "paused" ? "paused" : "expired";
}

function requireSubscription(
  subscription: RevenueCatSubscription | null,
): RevenueCatSubscription {
  if (!subscription) {
    throw new Error("RevenueCat subscription verification is missing");
  }
  return subscription;
}

function requirePurchase(
  purchase: RevenueCatPurchase | null,
): RevenueCatPurchase {
  if (!purchase) {
    throw new Error("RevenueCat purchase verification is missing");
  }
  return purchase;
}

function subscriptionLifecycleRank(
  event: RevenueCatEvent,
  productKind: "subscription" | "credit_pack",
): number | null {
  if (productKind !== "subscription") {
    return null;
  }
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
      return 10;
    case "UNCANCELLATION":
    case "SUBSCRIPTION_PAUSED":
    case "SUBSCRIPTION_EXTENDED":
      return 20;
    case "BILLING_ISSUE":
      return 30;
    case "EXPIRATION":
      return 40;
    default:
      return null;
  }
}

async function reverseRefundedGrants(
  env: Env,
  repository: RevenueCatEventRepository,
  customerId: string,
  event: RevenueCatEvent,
  episodeId: string | null,
  eventRowId: string,
  nowMs: number,
): Promise<void> {
  for (const grantId of await repository.findGrantsForRefund(event, episodeId)) {
    const reversal = await callCustomerLedger(env.CUSTOMER_LEDGER, customerId, {
      action: "reverse_grant",
      customerId,
      grantId,
      nowMs,
      refundEventId: event.eventId,
      storeEventRowId: eventRowId,
    });
    if (!reversal.result.ok) {
      throw new Error(`refund reversal failed: ${reversal.result.code}`);
    }
  }
}

async function restoreRefundedGrants(
  env: Env,
  repository: RevenueCatEventRepository,
  customerId: string,
  event: RevenueCatEvent,
  episodeId: string | null,
  eventRowId: string,
  nowMs: number,
): Promise<void> {
  for (const refund of await repository.findRefundsForRestoration(event, episodeId)) {
    const restoration = await callCustomerLedger(env.CUSTOMER_LEDGER, customerId, {
      action: "restore_grant",
      customerId,
      grantId: refund.grant_id,
      nowMs,
      originalRefundEventId: refund.refund_event_id,
      restorationEventId: event.eventId,
      storeEventRowId: eventRowId,
    });
    if (!restoration.result.ok) {
      throw new Error(`refund restoration failed: ${restoration.result.code}`);
    }
  }
}

function failureCode(failure: unknown): string {
  const message = failure instanceof Error ? failure.message : "unknown_failure";
  return message.toLowerCase().replace(/[^a-z0-9_:,-]/g, "_").slice(0, 160);
}
