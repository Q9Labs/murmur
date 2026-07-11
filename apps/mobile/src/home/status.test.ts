import { describe, expect, it } from "vitest";

import {
  formatLiveError,
  formatReportError,
} from "./errorCopy";
import { isDevModelPickerEnabled } from "./modelRoute";
import { getLatestProviderRoute } from "./providerRoute";
import {
  getHealthText,
  getStatusText,
} from "./statusLabels";

describe("home status helpers", () => {
  it("selects the newest provider route with upstream details", () => {
    expect(
      getLatestProviderRoute([
        { provider_metadata: { provider: "openrouter", upstream_model: "old" } },
        { provider_metadata: null },
        {
          provider_metadata: {
            provider: "groq",
            upstream_model: "llama",
            upstream_provider: "Groq",
          },
        },
      ]),
    ).toBe("groq:Groq:llama");

    expect(getLatestProviderRoute([{ provider_metadata: { provider: "openrouter" } }])).toBeNull();
  });

  it("maps session state and errors into compact UI status labels", () => {
    expect(getStatusText("live", null)).toBe("Health OK");
    expect(getStatusText("recovering", null)).toBe("Recovering");
    expect(getStatusText("idle", "speech_unavailable:voice")).toBe("Speech unavailable");
    expect(getStatusText("idle", "translation_transport_error")).toBe("Network degraded");
    expect(getStatusText("requesting_mic_permission", null)).toBe("Microphone");

    expect(getHealthText("live", null)).toBe("OK");
    expect(getHealthText("network_degraded", null)).toBe("Degraded");
    expect(getHealthText("idle", "provider_token_refresh_retrying:5000")).toBe("Recovering");
    expect(getHealthText("creating_session", null)).toBe("Connecting");
  });

  it("formats live and report errors into user-facing copy", () => {
    expect(formatLiveError("provider_unavailable:deepgram")).toContain("Speech recognition");
    expect(formatLiveError("worker_session_http_503")).toContain("translation service");
    expect(formatLiveError("translation_timeout")).toContain("timed out");
    expect(formatLiveError("unknown_code")).toContain("unknown_code");

    expect(formatReportError("report_rate_limited")).toContain("Too many reports");
    expect(formatReportError("other")).toContain("Could not send");
  });

  it("detects dev model picker availability as a boolean runtime flag", () => {
    expect(typeof isDevModelPickerEnabled()).toBe("boolean");
  });
});
