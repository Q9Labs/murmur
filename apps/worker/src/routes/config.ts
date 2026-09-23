import * as Sentry from "@sentry/cloudflare";

import { getMurmurSession } from "../auth/auth";
import { currentCustomerPlan } from "../billing/allowanceService";
import { activePersonalOffer } from "../billing/personalOffer";
import type { Env } from "../env";
import { json } from "../http/response";
import { hashInstallId } from "../privacy";
import { appConfig, defaultServerConfig, getServerConfig } from "../serverConfig";

export async function getConfig(request: Request, env: Env, context?: ExecutionContext): Promise<Response> {
  const session = await getMurmurSession(request, env, context);
  if (!session) {
    return json({ error: "authentication_required" }, 401);
  }
  const installId = request.headers.get("x-murmur-install-id");
  if (!installId || installId.length < 8) {
    return json(appConfig(defaultServerConfig(env)));
  }
  const hashedInstallId = await hashInstallId(installId, env.SESSION_HASH_SALT ?? "local-development-salt");
  const nowMs = Date.now();
  const plan = await currentCustomerPlan(env.BILLING_DB, session.user.id, nowMs);
  const config = await getServerConfig(env, {
    appVersion: request.headers.get("x-murmur-app-version"),
    distinctId: `anonymous_install_${hashedInstallId}`,
    plan,
    platform: request.headers.get("x-murmur-app-platform"),
  });
  let personalOffer = null;
  if (config.personal_offer_enabled && env.BILLING_DB) {
    try {
      const country = request.cf?.country;
      const offeringId = personalOfferOfferingId(
        typeof country === "string" ? country : undefined,
        config.personal_offer_offering_id,
      );
      personalOffer = await activePersonalOffer(
        env.BILLING_DB,
        session.user.id,
        nowMs,
        offeringId,
      );
    } catch (failure) {
      Sentry.captureException(failure, { tags: { operation: "read_personal_offer" } });
    }
  }
  return json(appConfig(config, personalOffer, nowMs));
}

export function personalOfferOfferingId(country: string | undefined, configuredId: string): string {
  return country === "IN" || country === "PK" || country === "ID" || country === "TR"
    ? "lite_personal_offer"
    : configuredId;
}
