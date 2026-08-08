import { describe, expect, it } from "vitest";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { createSession, createSpan } from "@murmur/protocol/session";
import { buildHomeViewModel } from "./viewModel";

function makeLive(overrides: Partial<LiveTranslationController> = {}): LiveTranslationController {
  return {
    cancel: async () => undefined,
    debug_log: [],
    diagnostics_snapshot: {
      runtime: {
        realtime_socket_open: false,
        source_char_count: 0,
        translated_char_count: 0,
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

  it("uses the latest partial or committed caption", () => {
    const first = { ...createSpan("hello"), status: "committed" as const };
    const second = {
      ...createSpan("where is the train"),
      partial_translated_caption: "أين",
      provider_metadata: {
        model: "gpt-realtime-translate",
        provider: "openai",
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

    expect(model.latestProviderRoute).toBe("openai:gpt-realtime-translate");
    expect(model.pendingCount).toBe(1);
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
