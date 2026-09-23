import { getAppRelease } from "../appRelease";
import { authenticatedWorkerHeaders } from "../auth/client";
import { getAnonymousAnalyticsEnabled } from "../anonymousAnalytics";
import { getWorkerBaseUrl } from "../config";
import { getOrCreateInstallId } from "../installIdentity";

export async function requestMurmurCustomer(): Promise<Response> {
  const release = getAppRelease();
  return fetch(`${getWorkerBaseUrl()}/v3/customer`, {
    headers: await authenticatedWorkerHeaders({
      "x-murmur-app-platform": release.app_platform,
      "x-murmur-app-version": release.app_version,
      "x-murmur-install-id": await getOrCreateInstallId(),
    }),
  });
}

export async function requestPhoneAudioGiftClaim(): Promise<Response> {
  return fetch(`${getWorkerBaseUrl()}/v3/gifts/phone-audio/claim`, {
    headers: await authenticatedWorkerHeaders(),
    method: "POST",
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

export async function requestMurmurAppConfig(): Promise<Response> {
  const release = getAppRelease();
  return fetch(`${getWorkerBaseUrl()}/v3/config`, {
    headers: await authenticatedWorkerHeaders({
      "x-murmur-app-platform": release.app_platform,
      "x-murmur-app-version": release.app_version,
      "x-murmur-install-id": await getOrCreateInstallId(),
    }),
  });
}
