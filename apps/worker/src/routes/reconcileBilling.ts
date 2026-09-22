import * as Sentry from "@sentry/cloudflare";

import { getMurmurSession } from "../auth/auth";
import { reconcileRevenueCatCustomer } from "../billing/revenueCatReconciliation";
import { isBillingFulfillmentEnabled, type Env } from "../env";
import { json } from "../http/response";
import { queuePostHogEvent } from "../observability/posthog";
import { hashInstallId } from "../privacy";

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
  let analyticsEnabled = false;
  if (request.body) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_reconciliation_request" }, 400);
    }
    analyticsEnabled = typeof body === "object" && body !== null &&
      Reflect.get(body, "analytics_enabled") === true;
  }
  const requestedTrigger = request.headers.get("x-murmur-reconciliation-trigger");
  const trigger = requestedTrigger === "restore" || requestedTrigger === "login"
    ? requestedTrigger
    : "purchase";
  const distinctId = analyticsEnabled ? `customer_${await hashInstallId(
    session.user.id,
    env.SESSION_HASH_SALT ?? "local-development-salt",
  )}` : null;
  try {
    const result = await reconcileRevenueCatCustomer({
      customerId: session.user.id,
      env,
      nowMs: Date.now(),
      trigger,
    });
    if (distinctId) {
      queuePostHogEvent({
        context,
        distinct_id: distinctId,
        env,
        payload: {
          event: "worker_billing_reconciliation",
          purchase_count: result.purchaseCount,
          status: "succeeded",
          subscription_count: result.subscriptionCount,
          trigger,
        },
      });
    }
    return json({
      ok: true,
      purchase_count: result.purchaseCount,
      subscription_count: result.subscriptionCount,
    });
  } catch (failure) {
    Sentry.captureException(failure, {
      tags: { operation: "reconcile_billing" },
    });
    if (distinctId) {
      queuePostHogEvent({
        context,
        distinct_id: distinctId,
        env,
        payload: {
          event: "worker_billing_reconciliation",
          purchase_count: 0,
          status: "failed",
          subscription_count: 0,
          trigger,
        },
      });
    }
    return json({ error: "reconciliation_failed" }, 503);
  }
}
