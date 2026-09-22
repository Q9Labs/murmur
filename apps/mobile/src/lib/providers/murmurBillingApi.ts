import { authenticatedWorkerHeaders } from "../auth/client";
import { getAnonymousAnalyticsEnabled } from "../anonymousAnalytics";
import { getWorkerBaseUrl } from "../config";

export async function requestMurmurCustomer(): Promise<Response> {
  return fetch(`${getWorkerBaseUrl()}/v3/customer`, {
    headers: await authenticatedWorkerHeaders(),
  });
}

export async function requestMurmurReconciliation(
  trigger: "login" | "purchase" | "restore",
): Promise<Response> {
  return fetch(`${getWorkerBaseUrl()}/v3/billing/reconcile`, {
    body: JSON.stringify({ analytics_enabled: await getAnonymousAnalyticsEnabled() }),
    headers: await authenticatedWorkerHeaders({
      "Content-Type": "application/json",
      "x-murmur-reconciliation-trigger": trigger,
    }),
    method: "POST",
  });
}
