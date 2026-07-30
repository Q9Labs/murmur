/// <reference types="@cloudflare/workers-types" />

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
import {
  closeSessionDurable,
  RateLimitDurableObject,
} from "./rateLimitDurableObject";
import { createReport, deleteReport, listReports } from "./routes/report";
import { createSession } from "./routes/session";
import { connectRealtimeSocket } from "./sockets/realtime";

export { RateLimitDurableObject };
export type { Env } from "./env";
export { getReadiness } from "./env";
export {
  createCloseMessage,
  createInputAudioMessage,
  createSessionUpdate,
  parseTranslationOutput,
} from "./providers/openaiRealtime";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

    if (url.pathname === "/v1/session" && request.method === "POST") {
      return createSession(request, env);
    }

    if (url.pathname === "/v1/realtime" && request.headers.get("Upgrade") === "websocket") {
      return connectRealtimeSocket(request, env);
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
      url.pathname.startsWith("/v1/session/") &&
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
};
