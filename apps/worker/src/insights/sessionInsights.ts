import * as Sentry from "@sentry/cloudflare";
import { insightSettings, isInsightSetting, type InsightSetting } from "@murmur/protocol/insights";

import type { Env } from "../env";
import { customerSessionInsightDeletions } from "./deleteCustomerData";
import { queuePostHogEvent, type TelemetryExecutionContext, type WorkerTelemetryEvent } from "../observability/posthog";

type SessionInsight = {
  setting: InsightSetting;
  event_name: string | null;
  topic: string;
  domain_terms: string[];
  speakers_estimate: "1" | "2" | "3+";
  user_intent: string;
  translation_quality: 1 | 2 | 3 | 4 | 5;
  confusions: string[];
  sentiment: "positive" | "neutral" | "negative";
  summary: string;
  product_signals: string[];
};

export type InsightSessionContext = {
  appSessionId: string;
  customerId: string | null;
  hashedInstallId: string;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: string;
};

const insightSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "setting", "event_name", "topic", "domain_terms", "speakers_estimate",
    "user_intent", "translation_quality", "confusions", "sentiment",
    "summary", "product_signals",
  ],
  properties: {
    setting: { type: "string", enum: insightSettings },
    event_name: { type: ["string", "null"] },
    topic: { type: "string" },
    domain_terms: { type: "array", items: { type: "string" }, maxItems: 10 },
    speakers_estimate: { type: "string", enum: ["1", "2", "3+"] },
    user_intent: { type: "string" },
    translation_quality: { type: "integer", enum: [1, 2, 3, 4, 5] },
    confusions: { type: "array", items: { type: "string" }, maxItems: 5 },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    summary: { type: "string" },
    product_signals: { type: "array", items: { type: "string" }, maxItems: 5 },
  },
};

export async function recordInsightsConsent(
  env: Env,
  params: InsightSessionContext & { consent: boolean; customerId: string | null },
): Promise<void> {
  const database = env.BILLING_DB;
  if (!database) {
    if (params.consent) throw new Error("insights_database_unavailable");
    return;
  }
  if (params.customerId) {
    await database.batch([
      database.prepare(
        "INSERT INTO customer_insights_consent (customer_id, consent, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(customer_id) DO UPDATE SET consent = excluded.consent, updated_at = excluded.updated_at",
      ).bind(params.customerId, Number(params.consent), new Date().toISOString()),
      ...(params.consent ? [] : customerSessionInsightDeletions(database, params.customerId)),
    ]);
  }
  if (!params.consent) return;
  await database.prepare("DELETE FROM insight_session_context WHERE created_at < ?")
    .bind(new Date(Date.now() - 86_400_000).toISOString()).run();
  await database.prepare(
    "INSERT INTO insight_session_context " +
    "(app_session_id, customer_id, hashed_install_id, source_language, target_language, created_at) " +
    "VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(
    params.appSessionId, params.customerId, params.hashedInstallId,
    params.sourceLanguage, params.targetLanguage, params.createdAt,
  ).run();
}

export async function loadInsightSession(
  env: Env,
  appSessionId: string,
): Promise<InsightSessionContext | null> {
  const row = await env.BILLING_DB?.prepare(
    "SELECT c.app_session_id, c.customer_id, c.hashed_install_id, c.source_language, c.target_language, c.created_at " +
    "FROM insight_session_context c LEFT JOIN customer_insights_consent p ON p.customer_id = c.customer_id " +
    "WHERE c.app_session_id = ? AND (c.customer_id IS NULL OR p.consent = 1)",
  ).bind(appSessionId).first<{
    app_session_id: string;
    customer_id: string | null;
    hashed_install_id: string;
    source_language: string;
    target_language: string;
    created_at: string;
  }>();
  return row ? {
    appSessionId: row.app_session_id,
    customerId: row.customer_id,
    hashedInstallId: row.hashed_install_id,
    sourceLanguage: row.source_language,
    targetLanguage: row.target_language,
    createdAt: row.created_at,
  } : null;
}

export function createInsightCollector() {
  let firstTranslationAtMs: number | null = null;
  let text = "";
  return {
    add(delta: string, nowMs = Date.now()): void {
      if (!delta.trim()) return;
      firstTranslationAtMs ??= nowMs;
      text += delta.slice(0, Math.max(0, 100_000 - text.length));
    },
    finish(nowMs = Date.now()): { durationMs: number; text: string } | null {
      if (firstTranslationAtMs === null || nowMs - firstTranslationAtMs < 30_000 || !text.trim()) return null;
      const result = { durationMs: nowMs - firstTranslationAtMs, text };
      text = "";
      return result;
    },
  };
}

export async function processSessionInsight(params: {
  analyticsEnabled: boolean;
  configModel: string;
  context?: TelemetryExecutionContext;
  env: Env;
  session: InsightSessionContext;
  translation: { durationMs: number; text: string };
}): Promise<void> {
  try {
    const key = params.env.OPENROUTER_API_KEY?.trim();
    const database = params.env.BILLING_DB;
    if (!key || !database) throw new Error("insights_provider_unconfigured");
    if (params.session.customerId) {
      const consent = await database.prepare(
        "SELECT consent FROM customer_insights_consent WHERE customer_id = ?",
      ).bind(params.session.customerId).first<{ consent: number }>();
      if (consent?.consent !== 1) return;
    }
    const insight = await requestSessionInsight(key, params.configModel, params.translation.text);
    // Consent is rechecked on insert, so a withdrawal during the model call still wins.
    const stored = await database.prepare(
      "INSERT INTO session_insights " +
      "(app_session_id, customer_id, hashed_install_id, source_language, target_language, duration_ms, created_at, insight_json) " +
      "SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8 WHERE ?9 IS NULL OR EXISTS " +
      "(SELECT 1 FROM customer_insights_consent WHERE customer_id = ?9 AND consent = 1) " +
      "ON CONFLICT(app_session_id) DO NOTHING",
    ).bind(
      params.session.appSessionId, params.session.customerId, params.session.hashedInstallId,
      params.session.sourceLanguage, params.session.targetLanguage,
      params.translation.durationMs, params.session.createdAt, JSON.stringify(insight),
      params.session.customerId,
    ).run();
    if (stored.meta.changes === 0) return;
    const payload = buildInsightTelemetryPayload(
      params.analyticsEnabled, insight, params.session, params.translation.durationMs,
    );
    if (payload) {
      queuePostHogEvent({
        context: params.context,
        distinct_id: `anonymous_install_${params.session.hashedInstallId}`,
        env: params.env,
        payload,
      });
    }
  } catch (failure) {
    Sentry.captureException(failure, { tags: { operation: "process_session_insight" } });
  } finally {
    await params.env.BILLING_DB?.prepare("DELETE FROM insight_session_context WHERE app_session_id = ?")
      .bind(params.session.appSessionId).run().catch((failure: unknown) => {
        Sentry.captureException(failure, { tags: { operation: "delete_insight_session_context" } });
      });
  }
}

export function buildInsightTelemetryPayload(
  analyticsEnabled: boolean,
  insight: SessionInsight,
  session: InsightSessionContext,
  durationMs: number,
): WorkerTelemetryEvent | null {
  if (!analyticsEnabled) return null;
  return {
    event: "session_insight",
    setting: insight.setting,
    speakers_estimate: insight.speakers_estimate,
    translation_quality: insight.translation_quality,
    sentiment: insight.sentiment,
    duration_ms: durationMs,
    source_language: session.sourceLanguage,
    target_language: session.targetLanguage,
  };
}

export async function requestSessionInsight(
  key: string,
  model: string,
  translationText: string,
): Promise<SessionInsight> {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Analyze this translated conversation for product insights. Return only the schema. Do not include names of private individuals. Topic <=8 words, intent <=12 words, summary <=2 sentences, and short notes only." },
          { role: "user", content: translationText },
        ],
        response_format: { type: "json_schema", json_schema: { name: "session_insight", strict: true, schema: insightSchema } },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`openrouter_insight_http_${response.status}`);
    const envelope: unknown = await response.json();
    const insight = parseInsightResponse(envelope);
    if (!insight) throw new Error("openrouter_insight_invalid_response");
    return insight;
}

export async function discardInsightSession(env: Env, appSessionId: string): Promise<void> {
  await env.BILLING_DB?.prepare("DELETE FROM insight_session_context WHERE app_session_id = ?")
    .bind(appSessionId).run();
}

export function parseInsightResponse(envelope: unknown): SessionInsight | null {
  const content = extractInsightContent(envelope);
  if (!content) return null;
  let value: unknown;
  try { value = JSON.parse(content); } catch { return null; }
  return isSessionInsight(value) ? value : null;
}

function extractInsightContent(envelope: unknown): string | null {
  if (typeof envelope !== "object" || envelope === null || !("choices" in envelope) || !Array.isArray(envelope.choices)) return null;
  return messageContent(envelope.choices[0]);
}

function messageContent(choice: unknown): string | null {
  if (typeof choice !== "object" || choice === null || !("message" in choice)) return null;
  const message: unknown = choice.message;
  if (typeof message !== "object" || message === null || !("content" in message) || typeof message.content !== "string") return null;
  return message.content;
}

function isSessionInsight(value: unknown): value is SessionInsight {
  return typeof value === "object" && value !== null &&
    hasInsightContext(value) && hasInsightAssessment(value) && hasInsightNarrative(value);
}

function hasInsightContext(value: object): boolean {
  return hasSettingAndEvent(value) && hasTopicAndTerms(value) && hasSpeakers(value);
}

function hasSettingAndEvent(value: object): boolean {
  return "setting" in value && isInsightSetting(value.setting) &&
    "event_name" in value && (value.event_name === null ||
      (typeof value.event_name === "string" && value.event_name.length <= 160));
}

function hasTopicAndTerms(value: object): boolean {
  return "topic" in value && shortText(value.topic, 8) &&
    "domain_terms" in value && stringList(value.domain_terms, 10);
}

function hasSpeakers(value: object): boolean {
  return "speakers_estimate" in value &&
    (value.speakers_estimate === "1" || value.speakers_estimate === "2" || value.speakers_estimate === "3+");
}

function hasInsightAssessment(value: object): boolean {
  return hasIntentAndQuality(value) && hasConfusionsAndSentiment(value);
}

function hasIntentAndQuality(value: object): boolean {
  return "user_intent" in value && shortText(value.user_intent, 12) &&
    "translation_quality" in value && isQuality(value.translation_quality);
}

function hasConfusionsAndSentiment(value: object): boolean {
  return "confusions" in value && stringList(value.confusions, 5) &&
    "sentiment" in value &&
    (value.sentiment === "positive" || value.sentiment === "neutral" || value.sentiment === "negative");
}

function hasInsightNarrative(value: object): boolean {
  return "summary" in value && typeof value.summary === "string" &&
    value.summary.length <= 500 &&
    value.summary.split(/[.!?]+/).filter((sentence) => sentence.trim()).length <= 2 &&
    "product_signals" in value && stringList(value.product_signals, 5);
}

function shortText(value: unknown, maxWords: number): value is string {
  return typeof value === "string" && value.length <= 160 &&
    value.trim().length > 0 && value.trim().split(/\s+/).length <= maxWords;
}

function isQuality(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function stringList(value: unknown, maxItems: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems &&
    value.every((entry: unknown) => typeof entry === "string" && entry.length <= 120);
}
