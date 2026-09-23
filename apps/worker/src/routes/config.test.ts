import { describe, expect, it, vi } from "vitest";

vi.mock("../auth/auth", () => ({
  getMurmurSession: vi.fn().mockResolvedValue({ user: { id: "customer_1" } }),
}));

import { getMurmurSession } from "../auth/auth";
import { getConfig, personalOfferOfferingId } from "./config";

describe("GET /v3/config", () => {
  it("uses the lite personal offering only in the four lite countries", () => {
    for (const country of ["IN", "PK", "ID", "TR"]) {
      expect(personalOfferOfferingId(country, "personal_offer")).toBe("lite_personal_offer");
    }
    expect(personalOfferOfferingId("US", "personal_offer")).toBe("personal_offer");
    expect(personalOfferOfferingId(undefined, "personal_offer")).toBe("personal_offer");
  });
  it("requires the same session as the customer route", async () => {
    vi.mocked(getMurmurSession).mockResolvedValueOnce(null);
    const response = await getConfig(new Request("https://worker.example/v3/config"), {});
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "authentication_required" });
  });

  it("exposes only app-facing defaults when no install ID is supplied", async () => {
    const response = await getConfig(new Request("https://worker.example/v3/config"), {});
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enabled_languages: null,
      low_balance_threshold_minutes: 15,
      min_app_version_android: null,
      min_app_version_ios: null,
      paywall_offering_id: null,
      personal_offer: null,
      sessions_disabled_message: "Sessions are temporarily unavailable. Please try again later.",
      sessions_enabled: true,
    });
  });
});
