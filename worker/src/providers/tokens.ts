import {
  autoSourceLanguageCode,
  getLanguage,
  isLanguageCode,
  type LanguageCode,
  type SourceLanguageCode,
} from "../../../lib/languages";
import type { Env } from "../env";
import { logWorkerEvent } from "../privacy";
import { getMissingRequiredProviderKeys } from "./credentials";

export type ProviderTokenResult =
  | { ok: true; cartesiaAccessToken: string | null; deepgramToken: string | null }
  | { ok: false; missing: string[] };

export type UltravoxCallResult = {
  call_id: string;
  join_url: string;
  vad_profile: "default" | "low_latency";
};

export async function mintProviderTokens(
  env: Env,
  tokenTtlSeconds: number,
  options: { includeCartesia?: boolean } = {},
): Promise<ProviderTokenResult> {
  const missing = getMissingRequiredProviderKeys(env);

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const cartesiaAccessToken = options.includeCartesia === true
    ? await mintCartesiaToken(env, tokenTtlSeconds).catch((error) => {
        logWorkerEvent({
          event: "cartesia_token_unavailable",
          reason: error instanceof Error ? error.message : "cartesia_token_failed",
          at_ms: Date.now(),
        });
        return null;
      })
    : null;

  return { ok: true, cartesiaAccessToken, deepgramToken: null };
}

export async function createUltravoxCall(params: {
  env: Env;
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
  vad_enabled: boolean;
}): Promise<UltravoxCallResult> {
  if (!params.env.ULTRAVOX_API_KEY) {
    throw new Error("missing_ultravox_api_key");
  }
  const sourceLanguageName =
    params.source_language === autoSourceLanguageCode
      ? "the detected source language"
      : getLanguage(params.source_language).openrouter_source_name;
  const targetLanguage = getLanguage(params.target_language);
  const body: Record<string, unknown> = {
    firstSpeaker: "FIRST_SPEAKER_USER",
    initialOutputMedium: "MESSAGE_MEDIUM_TEXT",
    maxDuration: "600s",
    medium: {
      serverWebSocket: {
        inputSampleRate: 16000,
        outputSampleRate: 16000,
      },
    },
    metadata: {
      experiment: "ultravox_replacement",
      source_language: params.source_language,
      target_language: params.target_language,
      vad_enabled: String(params.vad_enabled),
    },
    model: params.env.ULTRAVOX_MODEL ?? "ultravox-v0.7",
    recordingEnabled: false,
    systemPrompt: [
      `You are a live speech translator from ${sourceLanguageName} to ${targetLanguage.openrouter_target_name}.`,
      `Output only the ${targetLanguage.openrouter_target_name} translation of the user's speech.`,
      "Do not answer questions, hold a conversation, add explanations, or describe what you are doing.",
      "Preserve names, numbers, tone, and meaning. Keep output concise and suitable for live captions.",
    ].join("\n"),
    temperature: 0,
    transcriptOptional: false,
  };
  if (params.vad_enabled) {
    body.vadSettings = {
      minimumInterruptionDuration: "0.09s",
      minimumTurnDuration: "0s",
      turnEndpointDelay: "0.096s",
    };
  }

  const response = await fetch("https://api.ultravox.ai/api/calls", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": params.env.ULTRAVOX_API_KEY,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    callId?: string;
    joinUrl?: string;
  };
  if (!response.ok) {
    throw new Error(`ultravox_http_${response.status}`);
  }
  if (!payload.callId || !payload.joinUrl) {
    throw new Error("ultravox_call_missing_join_url");
  }
  return {
    call_id: payload.callId,
    join_url: payload.joinUrl,
    vad_profile: params.vad_enabled ? "low_latency" : "default",
  };
}

export function selectCartesiaVoiceId(env: Env, targetLanguage: LanguageCode): string | null {
  const voiceMap = parseVoiceMap(env.CARTESIA_VOICE_ID_BY_LANGUAGE);
  return voiceMap[targetLanguage] ?? env.CARTESIA_DEFAULT_VOICE_ID ?? null;
}

async function mintCartesiaToken(env: Env, expiresInSeconds: number): Promise<string | null> {
  if (!env.CARTESIA_API_KEY) {
    return null;
  }
  const response = await fetch("https://api.cartesia.ai/access-token", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CARTESIA_API_KEY}`,
      "Cartesia-Version": env.CARTESIA_VERSION ?? "2026-03-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grants: { tts: true },
      expires_in: expiresInSeconds,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { token?: string };
  if (!response.ok || !body.token) {
    throw new Error(`cartesia_token_http_${response.status}`);
  }
  return body.token;
}

function parseVoiceMap(raw: string | undefined): Partial<Record<LanguageCode, string>> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [LanguageCode, string] => {
        const [languageCode, voiceId] = entry;
        return typeof voiceId === "string" && voiceId.length > 0 && isKnownLanguageCode(languageCode);
      }),
    );
  } catch {
    return {};
  }
}

function isKnownLanguageCode(value: string): value is LanguageCode {
  return isLanguageCode(value);
}
