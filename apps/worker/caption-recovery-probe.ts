import { callCustomerLedger } from "./src/billing/customerLedgerDurableObject";
import type { Env } from "./src/env";
import { createSessionRecordDurable } from "./src/rateLimitDurableObject";
import { connectRealtimeSocket } from "./src/sockets/realtime";

export { CustomerLedgerDurableObject } from "./src/billing/customerLedgerDurableObject";

// Local workerd fixture: only the external provider is replaced, not proxy or billing code.
export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const id = url.searchParams.get("app_session_id") ?? crypto.randomUUID();
    const now = Date.now();
    for (const command of [
      { action: "bootstrap_guest", customerId: id, principalId: id, principalProvider: "anonymous",
        providerSubject: id, grantFreeAllowance: true, freeAllowanceMs: 60_000,
        periodKey: id, periodStartsAtMs: now, periodExpiresAtMs: now + 3_600_000, nowMs: now },
      { action: "open_usage_session", customerId: id, usageSessionId: id, nowMs: now },
    ] as const) {
      const result = await callCustomerLedger(env.CUSTOMER_LEDGER, id, command);
      if (!result.result.ok) return Response.json(result.result, { status: 500 });
    }
    await createSessionRecordDurable({
      app_session_id: id, hashed_install_id: `${url.searchParams.get("case")}_${id}`, now_ms: now,
    });
    return connectRealtimeSocket(request, env, context);
  },
};
