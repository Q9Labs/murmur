/// <reference types="@cloudflare/workers-types" />

import { getMurmurSession } from "../auth/auth";
import {
  currentCustomerPlan,
  ensureCurrentAllowance,
} from "../billing/allowanceService";
import { callCustomerLedger } from "../billing/customerLedgerDurableObject";
import type { Env } from "../env";
import { json } from "../http/response";

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
  const bootstrap = await ensureCurrentAllowance({
    customerId: session.user.id,
    env,
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

  return json({
    balance: {
      allowance_ms: ledger.result.balance.allowanceMs,
      available_ms: ledger.result.balance.availableMs,
      credit_ms: ledger.result.balance.creditMs,
      earliest_expiry_at_ms: ledger.result.balance.earliestExpiryAtMs,
      negative_ms: ledger.result.balance.negativeMs,
    },
    customer_id: session.user.id,
    is_registered: session.user.isAnonymous !== true,
    plan,
    purchases_enabled: env.BILLING_PURCHASES_ENABLED === "true",
  });
}
