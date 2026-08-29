import { describe, expect, it } from "vitest";

import { verifyRevenueCatWebhook } from "./revenueCatWebhookVerification";

describe("RevenueCat webhook verification", () => {
  it("checks authorization, raw-body HMAC, and timestamp", async () => {
    const nowMs = 1_800_000_000_000;
    const timestamp = Math.floor(nowMs / 1_000);
    const rawBody = '{"api_version":"1.0"}';
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("signing-secret"),
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${rawBody}`),
    );
    const digestHex = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const headers = new Headers({
      authorization: "Bearer webhook-secret",
      "x-revenuecat-webhook-signature": `t=${timestamp},v1=${digestHex}`,
    });
    const env = {
      MURMUR_ENV: "production",
      REVENUECAT_WEBHOOK_AUTH: "Bearer webhook-secret",
      REVENUECAT_WEBHOOK_SIGNING_SECRET: "signing-secret",
    };

    await expect(verifyRevenueCatWebhook({ env, headers, nowMs, rawBody })).resolves.toBe(true);
    await expect(verifyRevenueCatWebhook({
      env,
      headers,
      nowMs,
      rawBody: `${rawBody} `,
    })).resolves.toBe(false);
  });
});
