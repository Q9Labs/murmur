import { getMurmurSession } from "../auth/auth";
import { currentCustomerPlan } from "../billing/allowanceService";
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
  const plan = await currentCustomerPlan(env.BILLING_DB, session.user.id, Date.now());
  const config = await getServerConfig(env, {
    appVersion: request.headers.get("x-murmur-app-version"),
    distinctId: `anonymous_install_${hashedInstallId}`,
    plan,
    platform: request.headers.get("x-murmur-app-platform"),
  });
  return json(appConfig(config));
}
