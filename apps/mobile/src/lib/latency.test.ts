import { describe, expect, it } from "vitest";

import {
  buildLatencyEvidenceReport,
  formatLatencyEvidenceReport,
  formatLatencyPercentiles,
  percentile,
  summarizeLatency,
} from "./latency";

describe("latency percentiles", () => {
  it("calculates nearest-rank p50, p90, and p95", () => {
    const values = [100, 20, 40, 60, 80];

    expect(percentile(values, 50)).toBe(60);
    expect(percentile(values, 90)).toBe(100);
    expect(percentile(values, 95)).toBe(100);
  });

  it("groups samples by latency step", () => {
    const report = summarizeLatency([
      { name: "mic", value_ms: 20 },
      { name: "mic", value_ms: 40 },
      { name: "translation", value_ms: 300 },
    ]);

    expect(report.mic).toEqual({
      count: 2,
      p50_ms: 20,
      p90_ms: 40,
      p95_ms: 40,
    });
    expect(report.translation.count).toBe(1);
  });

  it("formats visible p50, p90, and p95 summaries", () => {
    expect(
      formatLatencyPercentiles({
        count: 3,
        p50_ms: 101.4,
        p90_ms: 220,
        p95_ms: 240.6,
      }),
    ).toBe("n=3 / p50 101ms / p90 220ms / p95 241ms");
    expect(formatLatencyPercentiles(undefined)).toBe("n/a");
  });

  it("accepts a display-only number formatter without changing report defaults", () => {
    const arabicDigits = new Intl.NumberFormat("ar-u-nu-arab", { useGrouping: false });

    expect(
      formatLatencyPercentiles(
        { count: 2, p50_ms: 120, p90_ms: 240, p95_ms: 300 },
        {
          formatCount: (count) => `العدد=${count}`,
          formatNumber: (value) => arabicDigits.format(value),
          formatPercentile: (percentile, value) =>
            `المئين ${percentile}: ${value ?? "غير متاح"}${value ? " مللي ثانية" : ""}`,
          unavailable: "غير متاح",
        },
      ),
    ).toBe(
      "العدد=٢ / المئين ٥٠: ١٢٠ مللي ثانية / المئين ٩٠: ٢٤٠ مللي ثانية / المئين ٩٥: ٣٠٠ مللي ثانية",
    );
    expect(formatLatencyPercentiles(undefined, { unavailable: "غير متاح" })).toBe("غير متاح");
  });

  it("builds an exportable evidence report with run metadata", () => {
    const report = buildLatencyEvidenceReport({
      debugLog: [
        {
          at_ms: 1235,
          data: { reason: "playback_finished" },
          level: "info",
          message: "Native speech playback ended",
          name: "audio.playback_inactive",
        },
      ],
      metadata: {
        app_session_id: "session_123",
        device_class: "android-real-device",
        generated_at_ms: 1234,
        network_type: "wifi",
        platform: "android",
        provider_route: "openai:gpt-realtime-translate",
        source_language: "en",
        target_language: "ar",
      },
      samples: [
        { name: "translation_done", value_ms: 300 },
        { name: "translation_done", value_ms: 600 },
      ],
    });

    expect(report.summary.translation_done).toEqual({
      count: 2,
      p50_ms: 300,
      p90_ms: 600,
      p95_ms: 600,
    });
    expect(formatLatencyEvidenceReport(report)).toContain("language_pair: en->ar");
    expect(formatLatencyEvidenceReport(report)).toContain(
      "- translation_done: n=2 / p50 300ms / p90 600ms / p95 600ms",
    );
    expect(formatLatencyEvidenceReport(report)).toContain("debug_log_count: 1");
    expect(formatLatencyEvidenceReport(report)).toContain(
      "[info] audio.playback_inactive: Native speech playback ended",
    );
    expect(formatLatencyEvidenceReport(report)).toContain('{"reason":"playback_finished"}');
  });
});
