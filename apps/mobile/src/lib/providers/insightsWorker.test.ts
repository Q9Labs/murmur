import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/client", () => ({
  authenticatedWorkerHeaders: vi.fn(async (headers: HeadersInit) => headers),
}));
vi.mock("../config", () => ({ getWorkerBaseUrl: () => "https://murmur.test" }));

import { deliverRatingSurvey, updateWorkerInsightsConsent } from "./insightsWorker";

afterEach(() => vi.unstubAllGlobals());

describe("insights Worker transport", () => {
  it("sends explicit consent and rejects a failed survey save", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await updateWorkerInsightsConsent(false);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ insights_consent: false });
    await expect(deliverRatingSurvey({
      app_install_id: "install_12345678",
      answer: "other",
      other_text: "At a conference",
      stars: 3,
    })).rejects.toThrow("rating_survey_http_503");
  });
});
