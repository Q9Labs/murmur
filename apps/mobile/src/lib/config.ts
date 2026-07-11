import type { TranslationModelRoute } from "@murmur/protocol/transport/types";

export function getWorkerBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_MURMUR_WORKER_URL) {
    return process.env.EXPO_PUBLIC_MURMUR_WORKER_URL;
  }

  return process.env.NODE_ENV === "development"
    ? "http://localhost:8787"
    : "https://murmur.q9labs.ai";
}

export function getDevTranslationModelRouteEnv(): TranslationModelRoute | string | undefined {
  return process.env.EXPO_PUBLIC_MURMUR_DEV_MODEL_ROUTE;
}

export function isUltravoxVadEnabledByDefault(): boolean {
  return process.env.EXPO_PUBLIC_MURMUR_ULTRAVOX_VAD !== "off";
}
