import { describe, expect, it } from "vitest";

import {
  formatLiveError,
  formatReportError,
} from "./errorCopy";
import { getLatestProviderRoute } from "./providerRoute";
import {
  getHealthText,
  getStatusText,
} from "./statusLabels";

describe("home status helpers", () => {
  it("selects the newest provider and model", () => {
    expect(
      getLatestProviderRoute([
        { provider_metadata: { model: "old", provider: "openai" } },
        { provider_metadata: null },
        {
          provider_metadata: {
            model: "gpt-realtime-translate",
            provider: "openai",
          },
        },
      ]),
    ).toBe("openai:gpt-realtime-translate");

    expect(getLatestProviderRoute([{ provider_metadata: { provider: "openai" } }])).toBeNull();
  });

  it("maps session state and errors into compact UI status labels", () => {
    expect(getStatusText("live", null)).toBe("Health OK");
    expect(getStatusText("recovering", null)).toBe("Recovering");
    expect(getStatusText("idle", "realtime_transport_error")).toBe("Network degraded");
    expect(getStatusText("requesting_mic_permission", null)).toBe("Checking microphone");
    expect(getStatusText("requesting_mic_permission", null, "checking_device")).toBe(
      "Checking device",
    );
    expect(getStatusText("checking_device", null)).toBe("Checking device");
    expect(getStatusText("creating_session", null)).toBe("Starting AI");
    expect(getStatusText("connecting_realtime", null)).toBe("Starting AI");
    expect(getStatusText("idle", null, "checking_microphone")).toBe("Checking microphone");
    expect(getStatusText("idle", null, "checking_device")).toBe("Checking device");

    expect(getHealthText("live", null)).toBe("OK");
    expect(getHealthText("network_degraded", null)).toBe("Degraded");
    expect(getHealthText("idle", "realtime_transport_error")).toBe("Degraded");
    expect(getHealthText("creating_session", null)).toBe("Connecting");
  });

  it("formats live and report errors into user-facing copy", () => {
    expect(formatLiveError("provider_unavailable")).toContain("provider is unavailable");
    expect(formatLiveError("worker_session_http_503")).toContain("translation service");
    expect(formatLiveError("realtime_server_error")).toContain("failed");
    expect(formatLiveError("unknown_code")).toContain("unknown_code");

    expect(formatReportError("report_rate_limited")).toContain("Too many reports");
    expect(formatReportError("other")).toContain("Could not send");
  });
});
