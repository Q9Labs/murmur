/// <reference types="@cloudflare/workers-types" />

import type { BillingProduct, StoreProvider } from "./catalog";
import type { RevenueCatSubscription } from "./revenueCatApi";
import type { RevenueCatEvent } from "./revenueCatEvent";
import {
  isNewerSubscriptionCursor,
  type SubscriptionCursorValue,
} from "./subscriptionCursor";

export type StoredRevenueCatEvent = {
  eventRowId: string;
  idempotent: boolean;
};

type CustomerRow = { customer_id: string };
type EventRow = { payload_hash: string; status: string };
type GrantRow = { grant_id: string };
type RefundRow = { grant_id: string; refund_event_id: string };
type SubscriptionCursorRow = {
  event_id: string;
  lifecycle_rank: number;
  occurred_at_ms: number;
};

export type SubscriptionCursorClaim = {
  advanced: boolean;
  previous: SubscriptionCursorRow | null;
};

export class RevenueCatEventRepository {
  constructor(private readonly database: D1Database) {}

  async resolveCustomerId(candidateIds: readonly string[]): Promise<string | null> {
    for (const candidateId of candidateIds) {
      const customer = await this.database
        .prepare(
          `SELECT customer_id
           FROM customers
           WHERE customer_id = ?`,
        )
        .bind(candidateId)
        .first<CustomerRow>();
      if (customer) {
        return customer.customer_id;
      }
      const alias = await this.database
        .prepare(
          `SELECT customer_aliases.canonical_customer_id AS customer_id
           FROM customer_aliases
           JOIN customers
             ON customers.customer_id = customer_aliases.canonical_customer_id
           WHERE customer_aliases.alias_customer_id = ?`,
        )
        .bind(candidateId)
        .first<CustomerRow>();
      if (alias) {
        return alias.customer_id;
      }
    }
    return null;
  }

  async customerIsActive(customerId: string): Promise<boolean> {
    const customer = await this.database
      .prepare("SELECT customer_id FROM customers WHERE customer_id = ? AND state = 'active'")
      .bind(customerId)
      .first<CustomerRow>();
    return customer !== null;
  }

  async recordPending(
    event: RevenueCatEvent,
    customerId: string,
    payloadHash: string,
    nowMs: number,
    subscriptionEpisodeId: string | null,
  ): Promise<StoredRevenueCatEvent> {
    const eventRowId = `revenuecat:${event.environment}:${event.eventId}`;
    const existing = await this.database
      .prepare(
        `SELECT payload_hash, status
         FROM store_events
         WHERE provider = 'revenuecat' AND environment = ? AND event_id = ?`,
      )
      .bind(event.environment, event.eventId)
      .first<EventRow>();
    if (existing) {
      if (existing.payload_hash !== payloadHash) {
        throw new Error("RevenueCat event payload changed across retries");
      }
      return { eventRowId, idempotent: existing.status === "applied" || existing.status === "ignored_stale" };
    }
    await this.database
      .prepare(
        `INSERT INTO store_events
          (store_event_row_id, provider, environment, event_id, event_type, customer_id,
           subscription_episode_id, occurred_at_ms, received_at_ms, payload_hash, status,
           failure_code)
         VALUES (?, 'revenuecat', ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL)`,
      )
      .bind(
        eventRowId,
        event.environment,
        event.eventId,
        event.type,
        customerId,
        subscriptionEpisodeId,
        event.eventTimestampMs,
        nowMs,
        payloadHash,
      )
      .run();
    return { eventRowId, idempotent: false };
  }

  async markEvent(
    eventRowId: string,
    status: "applied" | "failed" | "ignored_stale" | "invalid",
    failureCode: string | null,
  ): Promise<void> {
    await this.database
      .prepare("UPDATE store_events SET status = ?, failure_code = ? WHERE store_event_row_id = ?")
      .bind(status, failureCode, eventRowId)
      .run();
  }

  async upsertTransaction(params: {
    customerId: string;
    event: RevenueCatEvent;
    eventRowId: string;
    product: BillingProduct;
    status: "purchased" | "refunded" | "revoked";
  }): Promise<string> {
    if (!params.event.provider || !params.event.transactionId || params.event.purchasedAtMs === null) {
      throw new Error("RevenueCat transaction identity is incomplete");
    }
    const transactionRowId = makeTransactionRowId(
      params.event.provider,
      params.event.environment,
      params.event.transactionId,
    );
    await this.database
      .prepare(
        `INSERT INTO store_transactions
          (store_transaction_row_id, customer_id, provider, environment, transaction_id,
           original_transaction_id, product_id, product_kind, status, purchased_at_ms,
           expires_at_ms, currency, price_micros, source_event_id, created_at_ms, updated_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
         ON CONFLICT(provider, environment, transaction_id) DO UPDATE SET
           customer_id = excluded.customer_id,
           product_id = excluded.product_id,
           status = excluded.status,
           expires_at_ms = excluded.expires_at_ms,
           source_event_id = excluded.source_event_id,
           updated_at_ms = excluded.updated_at_ms
         WHERE excluded.updated_at_ms > store_transactions.updated_at_ms
            OR (
              excluded.updated_at_ms = store_transactions.updated_at_ms
              AND excluded.source_event_id > COALESCE(store_transactions.source_event_id, '')
            )`,
      )
      .bind(
        transactionRowId,
        params.customerId,
        params.event.provider,
        params.event.environment,
        params.event.transactionId,
        params.event.originalTransactionId,
        params.event.productId,
        params.product.kind,
        params.status,
        params.event.purchasedAtMs,
        params.event.expirationAtMs,
        params.eventRowId,
        params.event.eventTimestampMs,
        params.event.eventTimestampMs,
      )
      .run();
    return transactionRowId;
  }

  // RevenueCat lifecycle application calls this method through a typed context.
  // fallow-ignore-next-line unused-class-member
  async upsertSubscription(params: {
    customerId: string;
    event: RevenueCatEvent;
    state: "active" | "billing_retry" | "expired" | "grace" | "on_hold" | "paused" | "revoked";
    subscription: RevenueCatSubscription;
  }): Promise<void> {
    const event = params.event;
    if (!event.provider || !event.originalTransactionId || !event.productId || event.purchasedAtMs === null) {
      throw new Error("RevenueCat subscription identity is incomplete");
    }
    const subscriptionId = subscriptionRowId(
      event.provider,
      event.environment,
      params.subscription.episodeId,
    );
    const anchorAtMs = params.subscription.originalPurchasedAtMs;
    const paidThroughMs = event.expirationAtMs ?? params.subscription.paidThroughMs;
    await this.database
      .prepare(
        `INSERT INTO subscriptions
          (subscription_id, customer_id, provider, environment, original_transaction_id,
           episode_id, product_id, state, started_at_ms, paid_through_ms, anchor_at_ms,
           provider_updated_at_ms, created_at_ms, updated_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, environment, original_transaction_id) DO UPDATE SET
           customer_id = excluded.customer_id,
           product_id = excluded.product_id,
           state = excluded.state,
           paid_through_ms = excluded.paid_through_ms,
           provider_updated_at_ms = excluded.provider_updated_at_ms,
           updated_at_ms = excluded.updated_at_ms
         WHERE excluded.provider_updated_at_ms >= subscriptions.provider_updated_at_ms`,
      )
      .bind(
        subscriptionId,
        params.customerId,
        event.provider,
        event.environment,
        event.originalTransactionId,
        params.subscription.episodeId,
        event.productId,
        params.state,
        anchorAtMs,
        paidThroughMs,
        anchorAtMs,
        event.eventTimestampMs,
        event.eventTimestampMs,
        event.eventTimestampMs,
      )
      .run();
  }

  // RevenueCat lifecycle application calls this method through a typed context.
  // fallow-ignore-next-line unused-class-member
  async claimSubscriptionCursor(
    event: RevenueCatEvent,
    episodeId: string,
    lifecycleRank: number,
    nowMs: number,
  ): Promise<SubscriptionCursorClaim> {
    if (!event.provider) {
      throw new Error("RevenueCat subscription cursor identity is incomplete");
    }
    const previous = await this.database
      .prepare(
        `SELECT event_id, lifecycle_rank, occurred_at_ms
         FROM subscription_cursors
         WHERE provider = ? AND environment = ? AND episode_id = ?`,
      )
      .bind(event.provider, event.environment, episodeId)
      .first<SubscriptionCursorRow>();
    if (previous && !isNewerSubscriptionCursor(
      {
        eventId: event.eventId,
        lifecycleRank,
        occurredAtMs: event.eventTimestampMs,
      },
      cursorValue(previous),
    )) {
      return { advanced: false, previous };
    }
    const result = await this.database
      .prepare(
        `INSERT INTO subscription_cursors
          (provider, environment, episode_id, occurred_at_ms, event_id, lifecycle_rank, updated_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, environment, episode_id) DO UPDATE SET
           occurred_at_ms = excluded.occurred_at_ms,
           event_id = excluded.event_id,
           lifecycle_rank = excluded.lifecycle_rank,
           updated_at_ms = excluded.updated_at_ms
         WHERE excluded.occurred_at_ms > subscription_cursors.occurred_at_ms
            OR (
              excluded.occurred_at_ms = subscription_cursors.occurred_at_ms
              AND excluded.lifecycle_rank > subscription_cursors.lifecycle_rank
            )
            OR (
              excluded.occurred_at_ms = subscription_cursors.occurred_at_ms
              AND excluded.lifecycle_rank = subscription_cursors.lifecycle_rank
              AND excluded.event_id > subscription_cursors.event_id
            )`,
      )
      .bind(
        event.provider,
        event.environment,
        episodeId,
        event.eventTimestampMs,
        event.eventId,
        lifecycleRank,
        nowMs,
      )
      .run();
    return { advanced: result.meta.changes === 1, previous };
  }

  // RevenueCat lifecycle rollback calls this method through a typed context.
  // fallow-ignore-next-line unused-class-member
  async restoreSubscriptionCursor(
    event: RevenueCatEvent,
    episodeId: string,
    lifecycleRank: number,
    previous: SubscriptionCursorRow | null,
    nowMs: number,
  ): Promise<void> {
    if (!event.provider) {
      return;
    }
    if (!previous) {
      await this.database
        .prepare(
          `DELETE FROM subscription_cursors
           WHERE provider = ? AND environment = ? AND episode_id = ?
             AND occurred_at_ms = ? AND lifecycle_rank = ? AND event_id = ?`,
        )
        .bind(
          event.provider,
          event.environment,
          episodeId,
          event.eventTimestampMs,
          lifecycleRank,
          event.eventId,
        )
        .run();
      return;
    }
    await this.database
      .prepare(
        `UPDATE subscription_cursors
         SET occurred_at_ms = ?, lifecycle_rank = ?, event_id = ?, updated_at_ms = ?
         WHERE provider = ? AND environment = ? AND episode_id = ?
           AND occurred_at_ms = ? AND lifecycle_rank = ? AND event_id = ?`,
      )
      .bind(
        previous.occurred_at_ms,
        previous.lifecycle_rank,
        previous.event_id,
        nowMs,
        event.provider,
        event.environment,
        episodeId,
        event.eventTimestampMs,
        lifecycleRank,
        event.eventId,
      )
      .run();
  }

  async updateSubscriptionState(
    event: RevenueCatEvent,
    episodeId: string,
    state: "active" | "billing_retry" | "expired" | "grace" | "on_hold" | "paused" | "revoked",
    paidThroughMs: number | null,
  ): Promise<void> {
    if (!event.provider) {
      return;
    }
    await this.database
      .prepare(
        `UPDATE subscriptions
         SET state = ?, paid_through_ms = COALESCE(?, paid_through_ms),
             provider_updated_at_ms = ?, updated_at_ms = ?
         WHERE provider = ? AND environment = ? AND episode_id = ?
           AND provider_updated_at_ms <= ?`,
      )
      .bind(
        state,
        paidThroughMs,
        event.eventTimestampMs,
        event.eventTimestampMs,
        event.provider,
        event.environment,
        episodeId,
        event.eventTimestampMs,
      )
      .run();
  }

  async findGrantsForRefund(event: RevenueCatEvent, episodeId: string | null): Promise<string[]> {
    return this.findGrantIds(event, episodeId, false);
  }

  async findRefundsForRestoration(
    event: RevenueCatEvent,
    episodeId: string | null,
  ): Promise<RefundRow[]> {
    const grants = await this.findGrantIds(event, episodeId, true);
    const refunds: RefundRow[] = [];
    for (const grantId of grants) {
      const result = await this.database
        .prepare(
          `SELECT refund_event_id, grant_id
           FROM refund_reversals
           WHERE grant_id = ?
             AND NOT EXISTS (
               SELECT 1 FROM refund_restorations
               WHERE refund_restorations.refund_event_id = refund_reversals.refund_event_id
                 AND refund_restorations.grant_id = refund_reversals.grant_id
             )
           ORDER BY created_at_ms DESC`,
        )
        .bind(grantId)
        .all<RefundRow>();
      refunds.push(...result.results);
    }
    return refunds;
  }

  private async findGrantIds(
    event: RevenueCatEvent,
    episodeId: string | null,
    includeReversed: boolean,
  ): Promise<string[]> {
    const availableGrantClause = includeReversed ? "" : "AND balance_grants.state != 'reversed'";
    if (event.provider && event.transactionId && episodeId) {
      const result = await this.database
        .prepare(
          `SELECT balance_grants.grant_id
           FROM balance_grants
           JOIN allowance_periods
             ON allowance_periods.customer_id = balance_grants.customer_id
            AND allowance_periods.period_key = balance_grants.grant_key
           JOIN store_transactions
             ON store_transactions.customer_id = balance_grants.customer_id
            AND store_transactions.provider = ?
            AND store_transactions.environment = ?
            AND store_transactions.transaction_id = ?
           WHERE balance_grants.grant_key LIKE ?
             AND allowance_periods.starts_at_ms < COALESCE(store_transactions.expires_at_ms, 9223372036854775807)
             AND allowance_periods.expires_at_ms > store_transactions.purchased_at_ms
             ${availableGrantClause}`,
        )
        .bind(event.provider, event.environment, event.transactionId, `pro:${episodeId}:%`)
        .all<GrantRow>();
      if (result.results.length > 0) {
        return result.results.map((grant) => grant.grant_id);
      }
    }
    if (!event.provider || !event.transactionId) {
      return [];
    }
    const transactionGrantClause = includeReversed ? "" : "AND state != 'reversed'";
    const result = await this.database
      .prepare(
        `SELECT grant_id FROM balance_grants
         WHERE source_transaction_row_id = ? ${transactionGrantClause}`,
      )
      .bind(makeTransactionRowId(event.provider, event.environment, event.transactionId))
      .all<GrantRow>();
    return result.results.map((grant) => grant.grant_id);
  }
}

function cursorValue(row: SubscriptionCursorRow): SubscriptionCursorValue {
  return {
    eventId: row.event_id,
    lifecycleRank: row.lifecycle_rank,
    occurredAtMs: row.occurred_at_ms,
  };
}

function makeTransactionRowId(
  provider: StoreProvider,
  environment: RevenueCatEvent["environment"],
  transactionId: string,
): string {
  return `transaction:${provider}:${environment}:${transactionId}`;
}

function subscriptionRowId(
  provider: StoreProvider,
  environment: RevenueCatEvent["environment"],
  episodeId: string,
): string {
  return `subscription:${provider}:${environment}:${episodeId}`;
}
