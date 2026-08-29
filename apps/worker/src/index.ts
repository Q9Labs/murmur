/// <reference types="@cloudflare/workers-types" />

import * as Sentry from "@sentry/cloudflare";

import { createMurmurAuth } from "./auth/auth";
import { CustomerLedgerDurableObject } from "./billing/customerLedgerDurableObject";
import { deleteExpiredFreeAllowanceClaims } from "./billing/freeAllowanceClaims";
import { reconcileDailyRevenueCatBatch } from "./billing/revenueCatReconciliation";
import {
  getReadiness,
  type Env,
} from "./env";
import {
  corsHeaders,
  json,
} from "./http/response";
import { renderLegalPage } from "./legalPages";
import { logWorkerEvent } from "./privacy";
import { getSentryOptions } from "./observability/sentry";
import {
  closeSessionDurable,
  RateLimitDurableObject,
} from "./rateLimitDurableObject";
import { createReport, deleteReport, listReports } from "./routes/report";
import { getCustomer } from "./routes/customer";
import { reconcileBilling } from "./routes/reconcileBilling";
import { receiveRevenueCatWebhook } from "./routes/revenueCatWebhook";
import { createSession } from "./routes/session";
import { captureMobileTelemetry } from "./routes/telemetry";
import { connectRealtimeSocket } from "./sockets/realtime";

export { CustomerLedgerDurableObject, RateLimitDurableObject };
export type { Env } from "./env";
export { getReadiness } from "./env";
export {
  createCloseMessage,
  createInputAudioMessage,
  createSessionUpdate,
  parseTranslationOutput,
} from "./providers/openaiRealtime";

const handler = {
  async fetch(request: Request, env: Env, context?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const legalPage = renderLegalPage(url.pathname);
    if (legalPage) {
      return legalPage;
    }

    if (url.pathname === "/health") {
      return json({ ok: true, env: env.MURMUR_ENV ?? "development" });
    }

    if (url.pathname === "/ready") {
      const readiness = getReadiness(env);
      return json(readiness, readiness.ok ? 200 : 503);
    }

    if (url.pathname.startsWith("/api/auth/")) {
      const auth = createMurmurAuth(env, request, context);
      return auth ? auth.handler(request) : json({ error: "billing_unavailable" }, 503);
    }

    if (url.pathname === "/v3/customer" && request.method === "GET") {
      return getCustomer(request, env, context);
    }

    if (url.pathname === "/v3/billing/reconcile" && request.method === "POST") {
      return reconcileBilling(request, env, context);
    }

    if (url.pathname === "/v3/webhooks/revenuecat" && request.method === "POST") {
      return receiveRevenueCatWebhook(request, env);
    }

    if (url.pathname === "/v1/session" && request.method === "POST") {
      return json({ error: "client_upgrade_required" }, 426);
    }

    if (url.pathname === "/v2/session" && request.method === "POST") {
      return createSession(request, env, context);
    }

    if (url.pathname === "/v2/realtime" && request.headers.get("Upgrade") === "websocket") {
      return connectRealtimeSocket(request, env, context);
    }

    if (url.pathname === "/v1/telemetry" && request.method === "POST") {
      return captureMobileTelemetry(request, env, context);
    }

    if (url.pathname === "/v1/report" && request.method === "POST") {
      return createReport(request, env);
    }

    if (url.pathname === "/v1/reports" && request.method === "GET") {
      return listReports(request, env);
    }

    if (
      url.pathname.startsWith("/v1/reports/") &&
      request.method === "DELETE"
    ) {
      const reportId = url.pathname.split("/")[3];
      return deleteReport(request, env, reportId);
    }

    if (
      url.pathname.startsWith("/v2/session/") &&
      url.pathname.endsWith("/stop") &&
      request.method === "POST"
    ) {
      const appSessionId = url.pathname.split("/")[3];
      await closeSessionDurable({
        app_session_id: appSessionId,
        namespace: env.RATE_LIMITER,
        now_ms: Date.now(),
      });
      logWorkerEvent({
        event: "session_stop",
        app_session_id: appSessionId,
        at_ms: Date.now(),
      });
      return json({ ok: true });
    }

    return json({ error: "not_found" }, 404);
  },
  async scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext) {
    const nowMs = Date.now();
    const reconciliation = reconcileDailyRevenueCatBatch(env, nowMs).then((result) => {
      logWorkerEvent({
        attempted: result.attempted,
        event: "revenuecat_reconciliation_completed",
        failed: result.failed,
      });
      if (result.failed > 0) {
        Sentry.captureMessage("revenuecat_reconciliation_partial_failure", {
          level: "error",
          tags: { operation: "revenuecat_reconciliation" },
        });
      }
    }).catch((failure: unknown) => {
      Sentry.captureException(failure, {
        tags: { operation: "revenuecat_reconciliation" },
      });
      throw failure;
    });
    const freeClaimCleanup = deleteExpiredFreeAllowanceClaims(env.BILLING_DB, nowMs)
      .catch((failure: unknown) => {
        Sentry.captureException(failure, {
          tags: { operation: "free_allowance_claim_cleanup" },
        });
        throw failure;
      });
    context.waitUntil(Promise.all([reconciliation, freeClaimCleanup]).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;

export default Sentry.withSentry(getSentryOptions, handler);
