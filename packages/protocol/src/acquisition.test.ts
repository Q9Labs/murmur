import { describe, expect, it } from "vitest";

import { normalizeAcquisitionContext } from "./acquisition";

describe("acquisition context", () => {
  it("normalizes the allowlisted campaign fields", () => {
    expect(normalizeAcquisitionContext({
      campaign: " UAE Travel Launch ",
      content: "Guide Demo #1",
      landing: "travel",
      medium: "QR Code",
      partner: "Café Tour",
      source: "Instagram",
    })).toEqual({
      campaign: "uae-travel-launch",
      content: "guide-demo-1",
      landing: "travel",
      medium: "qr-code",
      partner: "cafe-tour",
      source: "instagram",
    });
  });

  it("drops unknown, empty, and non-string fields", () => {
    expect(normalizeAcquisitionContext({
      campaign: " ",
      source: 42,
      transcript: "must never be accepted",
    })).toBeUndefined();
  });

  it("caps values and removes log-hostile characters", () => {
    const normalized = normalizeAcquisitionContext({
      campaign: `../../${"<script>".repeat(20)}`,
    });
    const campaign = normalized?.campaign;

    expect(campaign).toBeDefined();
    expect(campaign).toMatch(/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/);
    expect(campaign?.length).toBeLessThanOrEqual(64);
    expect(campaign).not.toContain("<");
    expect(campaign).not.toContain("/");
  });

  it("uses the first string when a query parameter has repeated values", () => {
    expect(normalizeAcquisitionContext({
      source: ["Partner One", "Partner Two"],
    })).toEqual({ source: "partner-one" });
  });
});
