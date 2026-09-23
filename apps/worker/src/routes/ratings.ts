import { isInsightSetting } from "@murmur/protocol/insights";

import { getMurmurSession } from "../auth/auth";
import type { Env } from "../env";
import { json } from "../http/response";
import { hashInstallId } from "../privacy";
import { canAcceptTelemetryDurable, isRateLimiterUnavailable } from "../rateLimitDurableObject";

export async function submitRatingSurvey(request: Request, env: Env): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRatingSurvey(body)) return json({ error: "invalid_rating_survey" }, 400);
  if (!env.BILLING_DB) return json({ error: "billing_unavailable" }, 503);
  const salt = env.SESSION_HASH_SALT ?? "local-development-salt";
  const hashedClientId = await hashInstallId(
    `rating-client:${request.headers.get("CF-Connecting-IP") ?? body.app_install_id}`, salt,
  );
  const limit = await canAcceptTelemetryDurable({
    hashed_client_id: hashedClientId,
    namespace: env.RATE_LIMITER,
    now_ms: Date.now(),
  });
  if (!limit.ok) return json({ error: limit.code }, isRateLimiterUnavailable(limit) ? 503 : 429);
  const session = await getMurmurSession(request, env);
  const hashedInstallId = await hashInstallId(body.app_install_id, salt);
  await env.BILLING_DB.prepare(
    "INSERT INTO rating_surveys (id, customer_id, hashed_install_id, stars, setting, other_text, created_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    crypto.randomUUID(), session?.user.id ?? null, hashedInstallId, body.stars, body.answer,
    body.answer === "other" ? body.other_text ?? null : null,
    new Date().toISOString(),
  ).run();
  return json({ ok: true }, 202);
}

function isRatingSurvey(value: unknown): value is {
  app_install_id: string;
  stars: 1 | 2 | 3 | 4 | 5;
  answer: string;
  other_text?: string;
} {
  return typeof value === "object" && value !== null &&
    hasRatingIdentity(value) && hasRatingAnswer(value) && hasOtherText(value);
}

function hasRatingIdentity(value: object): boolean {
  return "app_install_id" in value && typeof value.app_install_id === "string" &&
    value.app_install_id.length >= 8 && value.app_install_id.length <= 128;
}

function hasRatingAnswer(value: object): boolean {
  return "stars" in value && (value.stars === 1 || value.stars === 2 ||
    value.stars === 3 || value.stars === 4 || value.stars === 5) &&
    "answer" in value && isInsightSetting(value.answer);
}

function hasOtherText(value: object): boolean {
  if (!("other_text" in value)) return true;
  return "answer" in value && value.answer === "other" &&
    typeof value.other_text === "string" && value.other_text.length <= 500;
}
