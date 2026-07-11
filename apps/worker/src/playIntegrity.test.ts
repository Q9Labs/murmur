import { describe, expect, it } from "vitest";

import { verifyPlayIntegrityIfRequired } from "./playIntegrity";

describe("verifyPlayIntegrityIfRequired", () => {
  it("allows requests when device integrity is not required", async () => {
    await expect(
      verifyPlayIntegrityIfRequired({
        device_integrity: {
          available: false,
          platform: null,
          provider: null,
        },
        env: {},
        hashed_install_id: "install_hash",
        now_ms: 1,
        required: false,
      }),
    ).resolves.toEqual({
      ok: true,
      app_verdict: null,
      device_verdicts: [],
      request_hash_verified: false,
    });
  });

  it("requires an available provider token when enforcement is on", async () => {
    await expect(
      verifyPlayIntegrityIfRequired({
        device_integrity: {
          available: false,
          platform: "android",
          provider: "play_integrity",
        },
        env: {},
        hashed_install_id: "install_hash",
        now_ms: 1,
        required: true,
      }),
    ).resolves.toEqual({ ok: false, code: "device_integrity_required", status: 403 });
  });

  it("rejects unsupported providers before calling external verifiers", async () => {
    await expect(
      verifyPlayIntegrityIfRequired({
        device_integrity: {
          available: true,
          platform: "web",
          provider: "unsupported",
          token: "token",
        },
        env: {},
        hashed_install_id: "install_hash",
        now_ms: 1,
        required: true,
      }),
    ).resolves.toEqual({
      ok: false,
      code: "device_integrity_provider_unsupported",
      status: 403,
    });
  });
});
