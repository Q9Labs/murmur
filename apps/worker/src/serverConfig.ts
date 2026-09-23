import type { AppConfigResponse } from "@murmur/protocol/transport/types";
import { isLanguageCode } from "@murmur/protocol/languages";
import * as Sentry from "@sentry/cloudflare";

import type { CustomerPlan } from "./billing/allowanceService";
import { freeAllowanceMs } from "./billing/catalog";
import { requiresDeviceIntegrity, type Env } from "./env";
import { defaultRateLimits } from "./limits";

export type ServerConfig = Omit<AppConfigResponse, "personal_offer"> & {
  device_integrity_required: boolean;
  free_allowance_minutes: number;
  max_session_seconds_free: number;
  max_session_seconds_paid: number;
  output_audio_enabled: boolean;
  personal_offer_enabled: boolean;
  personal_offer_hours: number;
  personal_offer_offering_id: string;
  realtime_model: string;
  source_transcript: boolean;
};

type ConfigIdentity = {
  appVersion: string | null;
  distinctId: string;
  plan: CustomerPlan;
  platform: string | null;
};

const cache = new Map<string, { expiresAt: number; value: ServerConfig }>();
const cacheTtlMs = 30_000;
let failureReported = false;

export function defaultServerConfig(env: Env): ServerConfig {
  return {
    device_integrity_required: requiresDeviceIntegrity(env),
    enabled_languages: null,
    free_allowance_minutes: freeAllowanceMs / 60_000,
    low_balance_threshold_minutes: 15,
    max_session_seconds_free: defaultRateLimits.maxSessionSeconds,
    max_session_seconds_paid: 3600,
    min_app_version_android: null,
    min_app_version_ios: null,
    output_audio_enabled: true,
    paywall_offering_id: null,
    personal_offer_enabled: false,
    personal_offer_hours: 48,
    personal_offer_offering_id: "personal_offer",
    realtime_model: env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime-translate",
    sessions_disabled_message: "Sessions are temporarily unavailable. Please try again later.",
    sessions_enabled: true,
    source_transcript: false,
  };
}

export async function getServerConfig(env: Env, identity: ConfigIdentity): Promise<ServerConfig> {
  const defaults = defaultServerConfig(env);
  const token = env.POSTHOG_PROJECT_TOKEN?.trim();
  if (!token) {
    return defaults;
  }
  const key = JSON.stringify([identity.distinctId, identity.plan, identity.platform, identity.appVersion]);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  try {
    const response = await fetch("https://us.i.posthog.com/flags/", {
      body: JSON.stringify({
        distinct_id: identity.distinctId,
        person_properties: {
          app_platform: identity.platform,
          app_version: identity.appVersion,
          plan: identity.plan,
        },
        token,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(800),
    });
    if (!response.ok) {
      throw new Error(`posthog_flags_http_${response.status}`);
    }
    const { flags, payloads } = readPostHogFlags(await response.json());
    const config = parseServerConfigFlags(defaults, flags, payloads);
    if (cache.size >= 256) {
      cache.clear();
    }
    cache.set(key, { expiresAt: Date.now() + cacheTtlMs, value: config });
    return config;
  } catch (failure) {
    if (!failureReported) {
      failureReported = true;
      Sentry.captureException(failure, { tags: { operation: "posthog_server_config" } });
    }
    return defaults;
  }
}

function parseServerConfigFlags(defaults: ServerConfig, flags: object, payloads: unknown): ServerConfig {
  const value = (name: keyof ServerConfig): unknown => {
    const flag = Object.entries(flags).find(([key]) => key === name)?.[1];
    // PostHog reports a flag that doesn't match this user as false, which must mean
    // "use the default"; an explicit false value comes from the payload instead.
    if (flag === undefined || flag === false) {
      return undefined;
    }
    return flagPayload(payloads, name) ?? flag;
  };
  const boolean = (name: keyof ServerConfig, fallback: boolean): boolean =>
    typeof value(name) === "boolean" ? value(name) === true : fallback;
  const number = (name: keyof ServerConfig, fallback: number): number => {
    const candidate = value(name);
    return typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0
      ? candidate
      : fallback;
  };
  const string = (name: keyof ServerConfig, fallback: string): string => {
    const candidate = value(name);
    return typeof candidate === "string" ? candidate : fallback;
  };
  const optionalString = (name: keyof ServerConfig): string | null => {
    const candidate = value(name);
    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
  };
  const languages = value("enabled_languages");
  return {
    device_integrity_required: boolean("device_integrity_required", defaults.device_integrity_required),
    enabled_languages: Array.isArray(languages) && languages.every(isLanguageCode)
      ? languages
      : defaults.enabled_languages,
    free_allowance_minutes: number("free_allowance_minutes", defaults.free_allowance_minutes),
    low_balance_threshold_minutes: number("low_balance_threshold_minutes", defaults.low_balance_threshold_minutes),
    max_session_seconds_free: number("max_session_seconds_free", defaults.max_session_seconds_free),
    max_session_seconds_paid: number("max_session_seconds_paid", defaults.max_session_seconds_paid),
    min_app_version_android: optionalString("min_app_version_android"),
    min_app_version_ios: optionalString("min_app_version_ios"),
    output_audio_enabled: boolean("output_audio_enabled", defaults.output_audio_enabled),
    paywall_offering_id: optionalString("paywall_offering_id"),
    personal_offer_enabled: boolean("personal_offer_enabled", defaults.personal_offer_enabled),
    personal_offer_hours: number("personal_offer_hours", defaults.personal_offer_hours),
    personal_offer_offering_id: optionalString("personal_offer_offering_id") ?? defaults.personal_offer_offering_id,
    realtime_model: string("realtime_model", defaults.realtime_model),
    sessions_disabled_message: string("sessions_disabled_message", defaults.sessions_disabled_message),
    sessions_enabled: boolean("sessions_enabled", defaults.sessions_enabled),
    source_transcript: boolean("source_transcript", defaults.source_transcript),
  };
}

export function sessionLimitSeconds(config: ServerConfig, plan: CustomerPlan): number {
  return Math.min(plan === "free" ? config.max_session_seconds_free : config.max_session_seconds_paid, 3600);
}

export function appConfig(
  config: ServerConfig,
  personalOffer: AppConfigResponse["personal_offer"] = null,
  nowMs = Date.now(),
): AppConfigResponse {
  const activePersonalOffer = personalOffer && Date.parse(personalOffer.expires_at) > nowMs
    ? personalOffer
    : null;
  return {
    enabled_languages: config.enabled_languages,
    low_balance_threshold_minutes: config.low_balance_threshold_minutes,
    min_app_version_android: config.min_app_version_android,
    min_app_version_ios: config.min_app_version_ios,
    paywall_offering_id: activePersonalOffer?.offering_id ?? config.paywall_offering_id,
    personal_offer: activePersonalOffer,
    sessions_disabled_message: config.sessions_disabled_message,
    sessions_enabled: config.sessions_enabled,
  };
}

export function isBelowMinimumVersion(version: string | null, minimum: string | null): boolean {
  if (!minimum) {
    return false;
  }
  if (!version) {
    return true;
  }
  if (!/^\d+(?:\.\d+)*$/.test(version) || !/^\d+(?:\.\d+)*$/.test(minimum)) {
    return true;
  }
  const current = version.split(".").map(Number);
  const required = minimum.split(".").map(Number);
  if (current.some((part) => !Number.isInteger(part)) || required.some((part) => !Number.isInteger(part))) {
    return true;
  }
  for (let index = 0; index < Math.max(current.length, required.length); index += 1) {
    if ((current[index] ?? 0) !== (required[index] ?? 0)) {
      return (current[index] ?? 0) < (required[index] ?? 0);
    }
  }
  return false;
}

function flagPayload(payloads: unknown, name: string): unknown {
  if (typeof payloads !== "object" || payloads === null) {
    return undefined;
  }
  const rawPayload = Object.entries(payloads).find(([key]) => key === name)?.[1];
  if (typeof rawPayload !== "string") {
    return rawPayload;
  }
  try {
    return JSON.parse(rawPayload);
  } catch {
    return rawPayload;
  }
}

// PostHog's /flags response: { flags: { [key]: { enabled, variant, metadata: { payload } } } }.
function readPostHogFlags(data: unknown): { flags: object; payloads: object } {
  if (typeof data !== "object" || data === null || !("flags" in data)) {
    throw new Error("posthog_flags_invalid_response");
  }
  const { flags } = data;
  if (typeof flags !== "object" || flags === null) {
    throw new Error("posthog_flags_invalid_response");
  }
  const entries = Object.entries(flags);
  return {
    flags: Object.fromEntries(entries.map(([key, flag]) => [key, postHogFlagValue(flag)])),
    payloads: Object.fromEntries(entries.flatMap(([key, flag]) => {
      const payload = postHogFlagPayload(flag);
      return payload === undefined ? [] : [[key, payload]];
    })),
  };
}

function postHogFlagValue(flag: unknown): string | boolean {
  if (objectField(flag, "enabled") !== true) {
    return false;
  }
  const variant = objectField(flag, "variant");
  return typeof variant === "string" ? variant : true;
}

function postHogFlagPayload(flag: unknown): string | undefined {
  const payload = objectField(objectField(flag, "metadata"), "payload");
  if (payload === null || payload === undefined) {
    return undefined;
  }
  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

function objectField(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return Object.entries(value).find(([key]) => key === name)?.[1];
}
