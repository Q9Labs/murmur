import type { TranslationModelRoute } from "./transport/types";

export function getWorkerBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_MURMUR_WORKER_URL) {
    return process.env.EXPO_PUBLIC_MURMUR_WORKER_URL;
  }

  return process.env.NODE_ENV === "development"
    ? "http://localhost:8787"
    : "https://murmur.q9labs.ai";
}

export function toWebSocketUrl(url: string): string {
  if (url.startsWith("https://")) {
    return `wss://${url.slice("https://".length)}`;
  }
  if (url.startsWith("http://")) {
    return `ws://${url.slice("http://".length)}`;
  }
  return url;
}

export function getDevTranslationModelRouteEnv(): TranslationModelRoute | string | undefined {
  return process.env.EXPO_PUBLIC_MURMUR_DEV_MODEL_ROUTE;
}

export function isUltravoxVadEnabledByDefault(): boolean {
  return process.env.EXPO_PUBLIC_MURMUR_ULTRAVOX_VAD !== "off";
}
