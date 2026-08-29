import { getMurmurSession } from "../auth/auth";
import { reconcileRevenueCatCustomer } from "../billing/revenueCatReconciliation";
import type { Env } from "../env";
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
  const trigger = request.headers.get("x-murmur-reconciliation-trigger") === "restore"
    ? "restore"
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
import * as Sentry from "@sentry/cloudflare";
