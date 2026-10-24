import type { InsightSetting } from "@murmur/protocol/insights";

import { authenticatedWorkerHeaders } from "../auth/client";
import { getWorkerBaseUrl } from "../config";

export async function updateWorkerInsightsConsent(consent: boolean): Promise<void> {
  const headers = await authenticatedWorkerHeaders({ "Content-Type": "application/json" });
  const response = await fetch(`${getWorkerBaseUrl()}/v3/insights/consent`, {
    body: JSON.stringify({ insights_consent: consent }),
    headers,
    method: "PUT",
  });
  if (!response.ok) throw new Error(`insights_consent_http_${response.status}`);
}

export async function deliverInstallAttribution(body:
  | { app_install_id: string; platform: "android"; referrer: string }
  | { app_install_id: string; platform: "ios"; token: string },
): Promise<void> {
  await postInsights("/v3/attribution", body, "install_attribution");
}

export async function deliverRatingSurvey(body: {
  app_install_id: string;
  answer: InsightSetting;
  other_text?: string;
  stars: 1 | 2 | 3 | 4 | 5;
}): Promise<void> {
  const headers = await authenticatedWorkerHeaders({ "Content-Type": "application/json" });
  await postInsights("/v3/ratings", body, "rating_survey", headers);
}

export class InstallAttributionHttpFailure extends Error {
  readonly code: string;
  readonly responseSource: "worker_route" | "unmarked";

  constructor(response: Response) {
    const code = `install_attribution_http_${response.status}`;
    super(code);
    this.code = code;
    this.responseSource = response.headers.get("X-Murmur-Attribution-Response") === "v1"
      ? "worker_route" : "unmarked";
  }
}

async function postInsights(
  path: string,
  body: object,
  operation: "install_attribution" | "rating_survey",
  headers: HeadersInit = { "Content-Type": "application/json" },
): Promise<void> {
  const response = await fetch(`${getWorkerBaseUrl()}${path}`, {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  });
  if (!response.ok) {
    if (operation === "install_attribution") throw new InstallAttributionHttpFailure(response);
    const code = `${operation}_http_${response.status}`;
    throw Object.assign(new Error(code), { code });
  }
}
