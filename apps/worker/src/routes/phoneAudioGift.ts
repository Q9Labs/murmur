import { currentCustomerPlan } from "../billing/allowanceService";
import { freeAllowanceMs, getRequestServerConfig } from "../serverConfig";
import { getMurmurSession } from "../auth/auth";
import { claimPhoneAudioGift, getPhoneAudioGift } from "../billing/phoneAudioGift";
import type { Env } from "../env";
import { json } from "../http/response";

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
  const nowMs = Date.now();
  const plan = await currentCustomerPlan(env.BILLING_DB, session.user.id, nowMs);
  const config = await getRequestServerConfig(env, request, { customerId: session.user.id, plan });
  if (freeAllowanceMs(config) === 0) {
    const gift = await getPhoneAudioGift(env.BILLING_DB, session.user.id);
    return json({ phone_audio: { ...gift, claimable: false } });
  }
  const gift = await claimPhoneAudioGift(env.BILLING_DB, session.user.id, nowMs);
  return json({ phone_audio: gift });
}
