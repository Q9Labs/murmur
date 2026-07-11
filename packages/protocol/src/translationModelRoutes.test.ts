import { describe, expect, it } from "vitest";

import {
  defaultTranslationModelRoute,
  devTranslationModelRouteOptions,
  getTranslationModelRouteLabel,
  isGroqPreviewGemmaRoute,
  isTranslationModelRoute,
  isUltravoxReplacementRoute,
} from "./translationModelRoutes";

describe("translation model routes", () => {
  it("keeps the default Worker route first and labelled", () => {
    expect(defaultTranslationModelRoute).toBe("worker_default");
    expect(devTranslationModelRouteOptions[0]).toMatchObject({
      id: "worker_default",
      label: "Worker default",
    });
    expect(getTranslationModelRouteLabel("worker_default")).toBe("Worker default");
  });

  it("validates known route ids and rejects unknown input", () => {
    expect(isTranslationModelRoute("experiment_groq_preview_gemma")).toBe(true);
    expect(isTranslationModelRoute("experiment_ultravox_replacement")).toBe(true);
    expect(isTranslationModelRoute("unknown")).toBe(false);
    expect(isTranslationModelRoute(null)).toBe(false);
  });

  it("detects experiment route families", () => {
    expect(isGroqPreviewGemmaRoute("experiment_groq_preview_gemma")).toBe(true);
    expect(isGroqPreviewGemmaRoute("worker_default")).toBe(false);
    expect(isUltravoxReplacementRoute("experiment_ultravox_replacement")).toBe(true);
    expect(isUltravoxReplacementRoute(undefined)).toBe(false);
  });
});
