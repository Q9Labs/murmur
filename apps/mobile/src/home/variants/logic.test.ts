import { describe, expect, it } from "vitest";

import { createSpan } from "@murmur/protocol/session";
import type { TranslationSpan } from "@murmur/protocol/session";
import {
  deriveSignalStages,
  formatClockTime,
  formatLatencyMs,
  hasVisibleTimeline,
  isPartialSpan,
  isUiVariant,
  latestCommittedLatencyMs,
  normalizedMicLevel,
  shouldHideSpan,
  shouldKeepAutoScroll,
  timelineTranslationText,
} from "./logic";

function committedSpan(params: { createdAtMs: number; updatedAtMs: number }): TranslationSpan {
  return {
    ...createSpan("hello"),
    committed_translated_caption: "مرحبا",
    created_at_ms: params.createdAtMs,
    updated_at_ms: params.updatedAtMs,
  };
}

describe("isUiVariant", () => {
  it("accepts Bloom as the available variant", () => {
    expect(isUiVariant("bloom")).toBe(true);
  });

  it("rejects removed and non-string values", () => {
    expect(isUiVariant("aura")).toBe(false);
    expect(isUiVariant(null)).toBe(false);
    expect(isUiVariant(3)).toBe(false);
  });
});

describe("deriveSignalStages", () => {
  it("maps capture, caption, pending, and playback onto stages", () => {
    expect(deriveSignalStages({
      captureActive: true,
      hasTentativeCaption: true,
      pendingCount: 2,
      playbackActive: false,
    })).toEqual({ listen: true, speak: false, transcribe: true, translate: true });
  });

  it("keeps transcribe off while the microphone is off", () => {
    expect(deriveSignalStages({
      captureActive: false,
      hasTentativeCaption: true,
      pendingCount: 0,
      playbackActive: true,
    })).toEqual({ listen: false, speak: true, transcribe: false, translate: false });
  });
});

describe("latestCommittedLatencyMs", () => {
  it("returns the elapsed time of the newest committed span", () => {
    const spans = [
      committedSpan({ createdAtMs: 1000, updatedAtMs: 1900 }),
      { ...createSpan("pending"), status: "translating" as const },
      committedSpan({ createdAtMs: 5000, updatedAtMs: 5420 }),
    ];
    expect(latestCommittedLatencyMs(spans)).toBe(420);
  });

  it("returns null without committed spans or with clock skew", () => {
    expect(latestCommittedLatencyMs([createSpan("hello")])).toBeNull();
    expect(latestCommittedLatencyMs([committedSpan({ createdAtMs: 2000, updatedAtMs: 1000 })])).toBeNull();
  });
});

describe("formatLatencyMs", () => {
  it("formats missing, millisecond, and second latencies", () => {
    expect(formatLatencyMs(null)).toBe("--");
    expect(formatLatencyMs(412)).toBe("412ms");
    expect(formatLatencyMs(1240)).toBe("1.2s");
  });
});

describe("formatClockTime", () => {
  it("formats a local wall-clock timestamp with padded fields", () => {
    const date = new Date(2026, 6, 5, 9, 4, 7);
    expect(formatClockTime(date.getTime())).toBe("09:04:07");
  });
});

describe("span display helpers", () => {
  it("prefers committed captions, then partial, then a status fallback", () => {
    expect(timelineTranslationText({ ...createSpan("hi"), committed_translated_caption: "مرحبا" })).toBe("مرحبا");
    expect(timelineTranslationText({ ...createSpan("hi"), partial_translated_caption: "مرح" })).toBe("مرح");
    expect(timelineTranslationText({ ...createSpan("hi"), status: "failed" })).toBe("Translation failed");
    expect(timelineTranslationText(createSpan("hi"))).toBe("Translating...");
  });

  it("marks partial and translating spans as partial", () => {
    expect(isPartialSpan({ ...createSpan("hi"), partial_translated_caption: "مرح" })).toBe(true);
    expect(isPartialSpan({ ...createSpan("hi"), status: "translating" })).toBe(true);
    expect(isPartialSpan({
      ...createSpan("hi"),
      committed_translated_caption: "مرحبا",
      status: "committed",
    })).toBe(false);
  });

  it("hides only empty spans without captions", () => {
    expect(shouldHideSpan(createSpan())).toBe(true);
    expect(shouldHideSpan(createSpan("hi"))).toBe(false);
  });

  it("shows an empty timeline when every span is hidden", () => {
    expect(hasVisibleTimeline([createSpan()], "")).toBe(false);
    expect(hasVisibleTimeline([createSpan()], "listening")).toBe(true);
  });
});

describe("normalizedMicLevel", () => {
  it("scales speech-range rms into 0..1 and clamps the edges", () => {
    expect(normalizedMicLevel(0)).toBe(0);
    expect(normalizedMicLevel(0.1)).toBeCloseTo(0.4);
    expect(normalizedMicLevel(0.9)).toBe(1);
    expect(normalizedMicLevel(-0.2)).toBe(0);
  });
});

describe("shouldKeepAutoScroll", () => {
  const scrollEvent = (offsetY: number) => ({
    contentInset: { bottom: 0, left: 0, right: 0, top: 0 },
    contentOffset: { x: 0, y: offsetY },
    contentSize: { height: 1000, width: 400 },
    layoutMeasurement: { height: 600, width: 400 },
    zoomScale: 1,
  });

  it("keeps auto-scroll near the bottom and releases it when scrolled away", () => {
    expect(shouldKeepAutoScroll(scrollEvent(390))).toBe(true);
    expect(shouldKeepAutoScroll(scrollEvent(100))).toBe(false);
  });
});
