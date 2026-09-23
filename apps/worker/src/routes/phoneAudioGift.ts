import { getMurmurSession } from "../auth/auth";
import { claimPhoneAudioGift } from "../billing/phoneAudioGift";
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
  const gift = await claimPhoneAudioGift(env.BILLING_DB, session.user.id, Date.now());
  return json({ phone_audio: gift });
}
