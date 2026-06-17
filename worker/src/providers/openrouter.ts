import {
  autoSourceLanguageCode,
  getLanguage,
} from "../../../lib/languages";
import {
  defaultTranslationModelRoute,
} from "../../../lib/translationModelRoutes";
import type { TranslationModelRoute, TranslationRequest } from "../../../lib/transport/types";
import {
  buildInterpreterSystemPrompt,
  buildInterpreterUserPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  shouldUseTargetActionProtocol,
} from "../translation/prompts";
import type {
  ChatCompletionPayload,
  OpenRouterPayloadEnv,
  OpenRouterProviderPreferences,
} from "./types";

const defaultOpenRouterProviderOrder = ["deepinfra/fp8"];

export function buildOpenRouterChatPayload(
  request: TranslationRequest,
  env: OpenRouterPayloadEnv,
): ChatCompletionPayload {
  const sourceLanguageName =
    request.source_language === autoSourceLanguageCode
      ? "the detected source language"
      : getLanguage(request.source_language).openrouter_source_name;
  const targetLanguage = getLanguage(request.target_language);
  return {
    model: selectOpenRouterModel(request, env),
    messages: [
      {
        role: "system",
        content: shouldUseTargetActionProtocol(request)
          ? buildInterpreterSystemPrompt(sourceLanguageName, targetLanguage.openrouter_target_name)
          : buildSystemPrompt(
              sourceLanguageName,
              targetLanguage.openrouter_target_name,
            ),
      },
      {
        role: "user",
        content: shouldUseTargetActionProtocol(request)
          ? buildInterpreterUserPrompt(request)
          : buildUserPrompt(request),
      },
    ],
    temperature: shouldUseTargetActionProtocol(request) ? 0 : 0.1,
    max_tokens: 300,
    stream: true,
    provider: buildOpenRouterProviderPreferences(env, request.translation_model_route),
  };
}

export function buildOpenRouterProviderPreferences(
  env: OpenRouterPayloadEnv,
  route: TranslationModelRoute = defaultTranslationModelRoute,
): OpenRouterProviderPreferences {
  if (route === "openrouter_gemma_deepinfra") {
    return {
      allow_fallbacks: false,
      data_collection: parseDataCollection(env.OPENROUTER_PROVIDER_DATA_COLLECTION),
      only: ["deepinfra/fp8"],
      order: ["deepinfra/fp8"],
      require_parameters: true,
      sort: parseProviderSort(env.OPENROUTER_PROVIDER_SORT),
    };
  }
  if (route === "openrouter_gpt_oss_120b_cerebras") {
    return {
      allow_fallbacks: false,
      data_collection: parseDataCollection(env.OPENROUTER_PROVIDER_DATA_COLLECTION),
      only: ["cerebras"],
      order: ["cerebras"],
      require_parameters: true,
      sort: parseProviderSort(env.OPENROUTER_PROVIDER_SORT),
    };
  }

  const preferences: OpenRouterProviderPreferences = {
    allow_fallbacks: parseBooleanEnv(env.OPENROUTER_PROVIDER_ALLOW_FALLBACKS, false),
    data_collection: parseDataCollection(env.OPENROUTER_PROVIDER_DATA_COLLECTION),
    order: parseCsvEnv(env.OPENROUTER_PROVIDER_ORDER) ?? defaultOpenRouterProviderOrder,
    require_parameters: parseBooleanEnv(env.OPENROUTER_PROVIDER_REQUIRE_PARAMETERS, true),
    sort: parseProviderSort(env.OPENROUTER_PROVIDER_SORT),
  };
  const only = parseCsvEnv(env.OPENROUTER_PROVIDER_ONLY);
  const ignore = parseCsvEnv(env.OPENROUTER_PROVIDER_IGNORE);
  const zdr = parseOptionalBooleanEnv(env.OPENROUTER_PROVIDER_ZDR);
  if (only) {
    preferences.only = only;
  }
  if (ignore) {
    preferences.ignore = ignore;
  }
  if (typeof zdr === "boolean") {
    preferences.zdr = zdr;
  }
  return preferences;
}

export function selectOpenRouterModel(request: TranslationRequest, env: OpenRouterPayloadEnv): string {
  return request.translation_model_route === "openrouter_gpt_oss_120b_cerebras"
    ? "openai/gpt-oss-120b"
    : env.OPENROUTER_MODEL ?? "google/gemma-4-26b-a4b-it";
}

function parseCsvEnv(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  return parseOptionalBooleanEnv(value) ?? fallback;
}

function parseOptionalBooleanEnv(value: string | undefined): boolean | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  if (["1", "true", "yes"].includes(value.toLowerCase())) {
    return true;
  }
  if (["0", "false", "no"].includes(value.toLowerCase())) {
    return false;
  }
  return undefined;
}

function parseDataCollection(value: string | undefined): "allow" | "deny" {
  return value === "allow" ? "allow" : "deny";
}

function parseProviderSort(value: string | undefined): "latency" | "price" | "throughput" {
  if (value === "price" || value === "throughput") {
    return value;
  }
  return "latency";
}
