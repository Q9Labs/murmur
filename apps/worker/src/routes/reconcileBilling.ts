import * as Sentry from "@sentry/cloudflare";

import { getMurmurSession } from "../auth/auth";
import { reconcileRevenueCatCustomer } from "../billing/revenueCatReconciliation";
import { isBillingFulfillmentEnabled, type Env } from "../env";
import { json } from "../http/response";

export async function reconcileBilling(
  request: Request,
  env: Env,
  context?: ExecutionContext,
): Promise<Response> {
  const session = await getMurmurSession(request, env, context);
  if (!session) {
    return json({ error: "authentication_required" }, 401);
  }
  if (session.user.isAnonymous === true) {
    return json({ error: "registration_required" }, 403);
  }
  if (!isBillingFulfillmentEnabled(env)) {
    return json({ error: "billing_fulfillment_disabled" }, 503);
  }
  const requestedTrigger = request.headers.get("x-murmur-reconciliation-trigger");
  const trigger = requestedTrigger === "restore" || requestedTrigger === "login"
    ? requestedTrigger
    : "purchase";
  try {
    const result = await reconcileRevenueCatCustomer({
      customerId: session.user.id,
      env,
      nowMs: Date.now(),
      trigger,
    });
    return json({
      ok: true,
      purchase_count: result.purchaseCount,
      subscription_count: result.subscriptionCount,
    });
  } catch (failure) {
    Sentry.captureException(failure, {
      tags: { operation: "reconcile_billing" },
    });
    return json({ error: "reconciliation_failed" }, 503);
  }
}
