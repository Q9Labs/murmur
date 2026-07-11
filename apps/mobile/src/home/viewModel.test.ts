import { describe, expect, it } from "vitest";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { createSession, createSpan } from "@murmur/protocol/session";
import { buildHomeViewModel } from "./viewModel";

function makeLive(overrides: Partial<LiveTranslationController> = {}): LiveTranslationController {
  return {
    cancel: async () => undefined,
    debug_log: [],
    diagnostics_snapshot: {
      continuous_memory: {
        memory_version: 1,
        rolling_source_char_count: 0,
        rolling_span_count: 0,
        summary_job_running: false,
        summary_length: 0,
        summary_updated_through_span_id: null,
      },
      runtime: {
        last_committed_source_caption: null,
        pending_wait_prefix: null,
        tentative_source_caption: "",
        translation_socket_open: false,
      },
      translation_scheduler: {
        counts: { in_flight: 0, queued: 0 },
        in_flight: [],
        queued: [],
      },
    },
    error: null,
    latency_report: {},
    latency_samples: [],
    report_error: null,
    report_receipt_id: null,
    reportSpan: async () => undefined,
    session: createSession({ source_language: "en", target_language: "ar" }),
    spans: [],
    start: async () => undefined,
    status: "idle",
    stop: async () => undefined,
    tentative_source_caption: "",
    ...overrides,
  };
}

describe("home view model", () => {
  it("derives initial ready state and language controls", () => {
    const model = buildHomeViewModel({
      live: makeLive(),
      sourceLanguageCode: "en",
      targetLanguageCode: "ar",
    });

    expect(model).toMatchObject({
      canChangeLanguages: true,
      canStart: true,
      canSwapLanguages: true,
      healthText: "Ready",
      primaryCanvasText: "Ready to translate",
      secondaryCanvasText: "Choose a direction, then tap Listen.",
      sourceLanguageDisplayName: "English",
      statusText: "Ready",
    });
  });

  it("uses latest partial or committed caption for the phrase canvas", () => {
    const first = createSpan("hello");
    const second = {
      ...createSpan("where is the train"),
      partial_translated_caption: "أين",
      provider_metadata: {
        provider: "openrouter",
        upstream_model: "gemma",
        upstream_provider: "DeepInfra",
      },
      status: "translating" as const,
    };

    const model = buildHomeViewModel({
      live: makeLive({
        spans: [first, second],
        status: "live",
      }),
      sourceLanguageCode: "en",
      targetLanguageCode: "ar",
    });

    expect(model.latestProviderRoute).toBe("openrouter:DeepInfra:gemma");
    expect(model.continuousPendingCount).toBe(1);
    expect(model.hasContinuousTimeline).toBe(true);
    expect(model.latestTranslationIsPartial).toBe(true);
    expect(model.primaryCanvasText).toBe("أين");
    expect(model.secondaryCanvasText).toBe("where is the train");
  });

  it("blocks same-language starts unless source is auto-detect", () => {
    expect(
      buildHomeViewModel({
        live: makeLive(),
        sourceLanguageCode: "en",
        targetLanguageCode: "en",
      }).canStart,
    ).toBe(false);

    expect(
      buildHomeViewModel({
        live: makeLive(),
        sourceLanguageCode: "auto",
        targetLanguageCode: "en",
      }).canStart,
    ).toBe(true);
  });
});
