import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";

import { socialProviders } from "./socialProviders";

describe("native social provider configuration", () => {
  it("does not expose providers until their credentials are configured", () => {
    expect(socialProviders({})).toEqual({ apple: undefined, google: undefined });
  });

  it("accepts native Google audiences alongside the server web client", () => {
    expect(socialProviders({
      GOOGLE_WEB_CLIENT_ID: "web-id",
      GOOGLE_IOS_CLIENT_ID: "ios-id",
      GOOGLE_ANDROID_CLIENT_ID: "android-id",
      GOOGLE_CLIENT_SECRET: "server-secret",
    }).google).toEqual({
      clientId: ["web-id", "ios-id", "android-id"],
      clientSecret: "server-secret",
    });
  });

  it("signs an Apple client secret and accepts the native bundle audience", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    const provider = socialProviders({
      APPLE_CLIENT_ID: "apple-service-id",
      APPLE_TEAM_ID: "apple-team-id",
      APPLE_KEY_ID: "apple-key-id",
      APPLE_PRIVATE_KEY: (await exportPKCS8(privateKey)).replace(/\n/g, "\\n"),
      APPLE_APP_BUNDLE_IDENTIFIER: "com.q9labsai.murmur",
    }).apple;
    if (!provider) {
      throw new Error("Apple provider was not configured");
    }
    const options = await provider();
    const verified = await jwtVerify(options.clientSecret, publicKey, {
      audience: "https://appleid.apple.com",
      issuer: "apple-team-id",
      subject: "apple-service-id",
    });

    expect(options.appBundleIdentifier).toBe("com.q9labsai.murmur");
    expect(verified.protectedHeader.kid).toBe("apple-key-id");
  });
});
