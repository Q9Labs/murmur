// cspell:ignore EUNSPECIFIED
import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  openURL: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));
vi.mock("expo-linking", () => ({ openURL: boundary.openURL }));
vi.mock("@sentry/react-native", () => boundary);

import { openLegalLink } from "./legalLinks";
import { sanitizeMobileEvent } from "./observability/sentry";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("legal link native boundary", () => {
  it.each(["privacy", "support", "terms"] as const)("hands %s to the OS once without failure telemetry on success", async (target) => {
    boundary.openURL.mockResolvedValueOnce(true);
    await openLegalLink(target, "settings");
    expect(boundary.openURL).toHaveBeenCalledExactlyOnceWith(`https://murmur.q9labs.ai/${target}`);
    expect(boundary.captureException).not.toHaveBeenCalled();
    expect(boundary.captureMessage).not.toHaveBeenCalled();
  });

  it.each([
    { code: "EUNSPECIFIED", message: "Unable to open URL: https://murmur.q9labs.ai/privacy", classification: "native_open_rejected", errorCode: "EUNSPECIFIED" },
    { code: "EUNSPECIFIED", message: "private-native-detail", classification: "unspecified", errorCode: "EUNSPECIFIED" },
    { code: "private_native_code", message: "private-native-detail", classification: "unknown", errorCode: "external_link_unknown" },
    { code: "EUNSPECIFIED", message: "Unable to open URL: https://murmur.q9labs.ai/privacy?private-native-detail", classification: "unspecified", errorCode: "EUNSPECIFIED" },
  ])("retains only a closed classification for $classification", async ({ code, message, classification, errorCode }) => {
    const failure = Object.assign(new Error(message), { code });
    boundary.openURL.mockRejectedValueOnce(failure);
    await openLegalLink("privacy", "billing");
    expect(boundary.openURL).toHaveBeenCalledOnce();
    const hint = boundary.captureException.mock.calls[0]?.[1];
    const event = sanitizeMobileEvent({
      ...hint,
      exception: { values: [{ value: failure.message }] },
      type: undefined,
    });
    expect(event.tags).toMatchObject({
      error_code: errorCode, link_target: "privacy", link_step: "open_url", link_failure: classification,
    });
    expect(JSON.stringify(event)).not.toContain("https://");
    expect(JSON.stringify(event)).not.toContain("private");
    expect(JSON.stringify(event)).not.toContain("Unable to open URL");
  });

  it("handles a synchronous bridge throw without exposing its content", async () => {
    boundary.openURL.mockImplementationOnce(() => { throw "private-native-detail"; });
    await expect(openLegalLink("terms", "settings")).resolves.toBeUndefined();
    expect(boundary.captureMessage).toHaveBeenCalledWith("open_settings_link", expect.objectContaining({
      tags: expect.objectContaining({ error_code: "external_link_unknown", link_failure: "unknown", link_target: "terms" }),
    }));
    expect(JSON.stringify(boundary.captureMessage.mock.calls)).not.toContain("private");
  });
});
