import * as Sentry from "@sentry/cloudflare";

import type { ServerConfig } from "../serverConfig";
import { isPersonalOfferProduct } from "./catalog";

type PersonalOfferRow = { expires_at_ms: number; redeemed: number };
type WaitUntilContext = { waitUntil(promise: Promise<unknown>): void };
type OfferStatement = {
  bind(...values: (string | number)[]): OfferStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};
export type OfferDatabase = { prepare(query: string): OfferStatement };

export async function startPersonalOffer(
  database: OfferDatabase,
  customerId: string,
  nowMs: number,
  hours: number,
): Promise<void> {
  await database.prepare(
    `INSERT INTO personal_offers (customer_id, started_at_ms, expires_at_ms, redeemed)
     VALUES (?, ?, ?, 0) ON CONFLICT(customer_id) DO NOTHING`,
  ).bind(customerId, nowMs, nowMs + hours * 3_600_000).run();
}

export function queuePersonalOfferStart(params: {
  config: ServerConfig;
  context?: WaitUntilContext;
  customerId: string;
  database?: OfferDatabase;
  nowMs: number;
}): void {
  if (!params.config.personal_offer_enabled || !params.database) {
    return;
  }
  const operation = startPersonalOffer(
    params.database,
    params.customerId,
    params.nowMs,
    params.config.personal_offer_hours,
  ).catch((failure: unknown) => {
    Sentry.captureException(failure, { tags: { operation: "start_personal_offer" } });
  });
  if (params.context) {
    params.context.waitUntil(operation);
  } else {
    void operation;
  }
}

export async function activePersonalOffer(
  database: OfferDatabase,
  customerId: string,
  nowMs: number,
  offeringId: string,
): Promise<{ offering_id: string; expires_at: string } | null> {
  const row = await database.prepare(
    "SELECT expires_at_ms, redeemed FROM personal_offers WHERE customer_id = ?",
  ).bind(customerId).first<PersonalOfferRow>();
  if (!row || row.redeemed !== 0 || row.expires_at_ms <= nowMs) {
    return null;
  }
  return { offering_id: offeringId, expires_at: new Date(row.expires_at_ms).toISOString() };
}

export async function redeemPersonalOffer(
  database: OfferDatabase,
  customerId: string,
  productId: string,
  offerId: string | null = null,
): Promise<void> {
  if (!isPersonalOfferProduct(productId, offerId)) {
    return;
  }
  await database.prepare(
    "UPDATE personal_offers SET redeemed = 1 WHERE customer_id = ? AND redeemed = 0",
  ).bind(customerId).run();
}
