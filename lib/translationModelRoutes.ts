import type { TranslationModelRoute } from "./transport/types";

export const defaultTranslationModelRoute: TranslationModelRoute = "worker_default";

export const devTranslationModelRouteOptions = [
  {
    id: "worker_default",
    label: "Worker default",
    detail: "Gemma route from Worker config",
  },
  {
    id: "openrouter_gemma_deepinfra",
    label: "Gemma DeepInfra",
    detail: "OpenRouter pinned to DeepInfra",
  },
  {
    id: "groq_gpt_oss_120b_low",
    label: "GPT-OSS Groq low",
    detail: "Groq GPT-OSS 120B",
  },
  {
    id: "openrouter_gpt_oss_120b_cerebras",
    label: "GPT-OSS Cerebras",
    detail: "OpenRouter pinned to Cerebras",
  },
  {
    id: "experiment_groq_preview_gemma",
    label: "Experiment: Groq preview + Gemma final",
    detail: "Groq GPT-OSS 20B W/C preview, Gemma DeepInfra final",
  },
  {
    id: "experiment_ultravox_replacement",
    label: "Experiment: Ultravox replacement",
    detail: "Ultravox realtime ASR + LLM full replacement",
  },
] as const satisfies readonly {
  detail: string;
  id: TranslationModelRoute;
  label: string;
}[];

export function isTranslationModelRoute(value: unknown): value is TranslationModelRoute {
  return devTranslationModelRouteOptions.some((option) => option.id === value);
}

export function getTranslationModelRouteLabel(route: TranslationModelRoute): string {
  return devTranslationModelRouteOptions.find((option) => option.id === route)?.label ?? "Worker default";
}

export function isGroqPreviewGemmaRoute(route: TranslationModelRoute | undefined): boolean {
  return route === "experiment_groq_preview_gemma";
}

export function isUltravoxReplacementRoute(route: TranslationModelRoute | undefined): boolean {
  return route === "experiment_ultravox_replacement";
}
