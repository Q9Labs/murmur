import { authenticatedWorkerHeaders } from "../auth/client";
import { getWorkerBaseUrl } from "../config";

export async function requestMurmurCustomer(): Promise<Response> {
  return fetch(`${getWorkerBaseUrl()}/v3/customer`, {
    headers: await authenticatedWorkerHeaders(),
  });
}

export async function requestMurmurReconciliation(
  trigger: "purchase" | "restore",
): Promise<Response> {
  return fetch(`${getWorkerBaseUrl()}/v3/billing/reconcile`, {
    headers: await authenticatedWorkerHeaders({
      "x-murmur-reconciliation-trigger": trigger,
    }),
    method: "POST",
  });
}
