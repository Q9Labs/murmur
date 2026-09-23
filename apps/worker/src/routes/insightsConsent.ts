import { getMurmurSession } from "../auth/auth";
import type { Env } from "../env";
import { json } from "../http/response";
import { customerSessionInsightDeletions } from "../insights/deleteCustomerData";

export async function updateInsightsConsent(request: Request, env: Env): Promise<Response> {
  const session = await getMurmurSession(request, env);
  if (!session) return json({ error: "authentication_required" }, 401);
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("insights_consent" in body) ||
      typeof body.insights_consent !== "boolean") {
    return json({ error: "invalid_insights_consent" }, 400);
  }
  if (!env.BILLING_DB) return json({ error: "billing_unavailable" }, 503);
  const database = env.BILLING_DB;
  await database.batch([
    database.prepare(
      "INSERT INTO customer_insights_consent (customer_id, consent, updated_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(customer_id) DO UPDATE SET consent = excluded.consent, updated_at = excluded.updated_at",
    ).bind(session.user.id, Number(body.insights_consent), new Date().toISOString()),
    ...(body.insights_consent ? [] : customerSessionInsightDeletions(database, session.user.id)),
  ]);
  return json({ insights_consent: body.insights_consent });
}
