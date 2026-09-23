import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getMurmurSession: vi.fn() }));
vi.mock("../auth/auth", () => auth);

import { updateInsightsConsent } from "./insightsConsent";

beforeEach(() => auth.getMurmurSession.mockReset());

describe("insights consent route", () => {
  it("requires an authenticated customer", async () => {
    auth.getMurmurSession.mockResolvedValue(null);
    const response = await updateInsightsConsent(
      new Request("https://murmur.test/v3/insights/consent", {
        body: JSON.stringify({ insights_consent: true }),
        method: "PUT",
      }),
      {},
    );
    expect(response.status).toBe(401);
  });

  it("rejects an invalid choice before touching storage", async () => {
    auth.getMurmurSession.mockResolvedValue({ user: { id: "customer_1" } });
    const response = await updateInsightsConsent(
      new Request("https://murmur.test/v3/insights/consent", {
        body: JSON.stringify({ insights_consent: "yes" }),
        method: "PUT",
      }),
      {},
    );
    expect(response.status).toBe(400);
  });
});
