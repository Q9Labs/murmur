import type { SourceCaptionStatus, TranslationModelRoute } from "@murmur/protocol/transport/types";

export type TranslationProviderMetadata = {
  action_protocol?: "interpreter_v1";
  experiment?: "groq_preview_gemma";
  final_model?: string;
  final_provider?: "openrouter";
  model: string;
  preview_model?: string;
  preview_provider?: "groq";
  preview_target_action?: "commit" | "wait";
  provider: "groq" | "mixed" | "openrouter";
  reasoning_effort?: "low" | "medium" | "high";
  route_id?: TranslationModelRoute;
  source_status?: SourceCaptionStatus;
  target_action?: "commit" | "wait";
  upstream_id?: string;
  upstream_model?: string;
  upstream_provider?: string;
};

export type OpenRouterProviderPreferences = {
  allow_fallbacks?: boolean;
  data_collection?: "allow" | "deny";
  ignore?: string[];
  only?: string[];
  order?: string[];
  require_parameters?: boolean;
  sort?: "latency" | "price" | "throughput";
  zdr?: boolean;
};

export type ChatCompletionPayload = {
  include_reasoning?: boolean;
  max_tokens: number;
  messages: Array<{ content: string; role: "system" | "user" }>;
  model: string;
  provider?: OpenRouterProviderPreferences;
  reasoning_effort?: "low" | "medium" | "high";
  stream: true;
  temperature: number;
};

export type OpenRouterPayloadEnv = {
  OPENROUTER_MODEL?: string;
  OPENROUTER_PROVIDER_ALLOW_FALLBACKS?: string;
  OPENROUTER_PROVIDER_DATA_COLLECTION?: string;
  OPENROUTER_PROVIDER_IGNORE?: string;
  OPENROUTER_PROVIDER_ONLY?: string;
  OPENROUTER_PROVIDER_ORDER?: string;
  OPENROUTER_PROVIDER_REQUIRE_PARAMETERS?: string;
  OPENROUTER_PROVIDER_SORT?: string;
  OPENROUTER_PROVIDER_ZDR?: string;
};
