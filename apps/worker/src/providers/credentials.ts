import type { Env } from "../env";

export type RequiredProviderKeyName = "DEEPGRAM_API_KEY" | "OPENROUTER_API_KEY";

export function getMissingRequiredProviderKeys(env: Env): RequiredProviderKeyName[] {
  return [
    getDeepgramApiKey(env) ? null : "DEEPGRAM_API_KEY",
    getOpenRouterApiKey(env) ? null : "OPENROUTER_API_KEY",
  ].filter((item): item is RequiredProviderKeyName => Boolean(item));
}

export function getDeepgramApiKey(env: Env): string | undefined {
  return env.DEEPGRAM_API_KEY;
}

export function getGroqApiKey(env: Env): string | undefined {
  return env.GROQ_API_KEY;
}

export function getOpenRouterApiKey(env: Env): string | undefined {
  return env.OPENROUTER_API_KEY;
}
