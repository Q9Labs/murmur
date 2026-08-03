import { describe, expect, it, vi } from "vitest";

vi.mock("expo-linking", () => ({
  parse: vi.fn(),
}));

import { getAcquisitionContextFromQuery } from "./acquisition";

describe("mobile acquisition context", () => {
  it("maps standard campaign parameters and a known landing page", () => {
    expect(getAcquisitionContextFromQuery({
      partner: "Museum Guide",
      utm_campaign: "UAE Travel",
      utm_content: "QR Card",
      utm_medium: "offline",
      utm_source: "tour-operator",
    }, "/live-translation-for-travel/")).toEqual({
      campaign: "uae-travel",
      content: "qr-card",
      landing: "travel",
      medium: "offline",
      partner: "museum-guide",
      source: "tour-operator",
    });
  });

  it("does not invent attribution for an untagged launch", () => {
    expect(getAcquisitionContextFromQuery({}, "/")).toBeUndefined();
  });

  it("prefers standard campaign parameters over shorthand aliases", () => {
    expect(getAcquisitionContextFromQuery({
      campaign: "fallback",
      source: "fallback",
      utm_campaign: "primary",
      utm_source: "partner",
    })).toEqual({
      campaign: "primary",
      source: "partner",
    });
  });
});
