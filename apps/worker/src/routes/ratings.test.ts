import { describe, expect, it } from "vitest";

import { submitRatingSurvey } from "./ratings";

describe("rating survey route", () => {
  it("rejects free text outside Other and unbounded survey content", async () => {
    const response = await submitRatingSurvey(
      new Request("https://murmur.test/v3/ratings", {
        body: JSON.stringify({
          app_install_id: "install_12345678",
          answer: "travel",
          other_text: "private conversation",
          stars: 5,
        }),
        method: "POST",
      }),
      {},
    );
    expect(response.status).toBe(400);
  });

  it("does not acknowledge a rating when storage is unavailable", async () => {
    const response = await submitRatingSurvey(
      new Request("https://murmur.test/v3/ratings", {
        body: JSON.stringify({ app_install_id: "install_12345678", answer: "other", stars: 3 }),
        method: "POST",
      }),
      {},
    );
    expect(response.status).toBe(503);
  });
});
