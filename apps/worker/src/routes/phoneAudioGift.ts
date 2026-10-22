import { getMurmurSession } from "../auth/auth";
import { claimPhoneAudioGift, getPhoneAudioGift } from "../billing/phoneAudioGift";
import type { Env } from "../env";
import { json } from "../http/response";
import { freeAllowanceMs, getCustomerBillingPolicy } from "../serverConfig";

export async function claimPhoneAudioGiftRoute(
  request: Request,
  env: Env,
  context?: ExecutionContext,
): Promise<Response> {
  const session = await getMurmurSession(request, env, context);
  if (!session) {
    return json({ error: "authentication_required" }, 401);
  }
  if (!env.BILLING_DB) {
    return json({ error: "billing_unavailable" }, 503);
  }
  const { nowMs, config } = await getCustomerBillingPolicy(env, request, session.user.id);
  if (freeAllowanceMs(config) === 0) {
    const gift = await getPhoneAudioGift(env.BILLING_DB, session.user.id);
    return json({ phone_audio: { ...gift, claimable: false } });
  }
  const gift = await claimPhoneAudioGift(env.BILLING_DB, session.user.id, nowMs);
  return json({ phone_audio: gift });
}
