import { beforeEach, describe, expect, it, vi } from "vitest";

const attestMocks = vi.hoisted(() => ({
  verifyAssertion: vi.fn(),
  verifyAttestation: vi.fn(),
}));

vi.mock("@bradford-tech/supabase-integrity-attest", () => ({
  AssertionError: class AssertionError extends Error {},
  AttestationError: class AttestationError extends Error {},
  verifyAssertion: attestMocks.verifyAssertion,
  verifyAttestation: attestMocks.verifyAttestation,
}));

import { verifyPlayIntegrityIfRequired } from "./playIntegrity";

describe("verifyPlayIntegrityIfRequired", () => {
  beforeEach(() => {
    attestMocks.verifyAssertion.mockReset();
    attestMocks.verifyAttestation.mockReset();
    vi.restoreAllMocks();
  });

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

  it("validates Android package, nonce, age, and device verdicts", async () => {
    const baseParams = {
      device_integrity: {
        available: true,
        nonce: "expected_nonce",
        platform: "android",
        provider: "play_integrity",
        token: "integrity_token_long_enough",
      },
      env: {
        GOOGLE_PLAY_INTEGRITY_ACCESS_TOKEN: "access_token",
        GOOGLE_PLAY_PACKAGE_NAME: "com.q9labsai.murmur",
      },
      hashed_install_id: "install_hash",
      now_ms: 2_000_000_000_000,
      required: true,
    };
    const responseFor = (payload: unknown, status = 200) => vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(payload, { status }));

    responseFor({}, 403);
    await expect(verifyPlayIntegrityIfRequired(baseParams)).resolves.toMatchObject({
      code: "play_integrity_decode_failed",
      ok: false,
    });

    responseFor({ tokenPayloadExternal: { requestDetails: {
      requestPackageName: "another.app",
    } } });
    await expect(verifyPlayIntegrityIfRequired(baseParams)).resolves.toMatchObject({
      code: "play_integrity_app_mismatch",
      ok: false,
    });

    responseFor({ tokenPayloadExternal: {
      appIntegrity: { packageName: "com.q9labsai.murmur" },
      requestDetails: {
        nonce: "wrong_nonce",
        requestPackageName: "com.q9labsai.murmur",
      },
    } });
    await expect(verifyPlayIntegrityIfRequired(baseParams)).resolves.toMatchObject({
      code: "play_integrity_nonce_mismatch",
      ok: false,
    });

    responseFor({ tokenPayloadExternal: {
      appIntegrity: { packageName: "com.q9labsai.murmur" },
      requestDetails: {
        nonce: "expected_nonce",
        requestPackageName: "com.q9labsai.murmur",
        timestampMillis: "1",
      },
    } });
    await expect(verifyPlayIntegrityIfRequired(baseParams)).resolves.toMatchObject({
      code: "play_integrity_token_expired",
      ok: false,
    });

    responseFor({ tokenPayloadExternal: {
      appIntegrity: { packageName: "com.q9labsai.murmur" },
      deviceIntegrity: { deviceRecognitionVerdict: [] },
      requestDetails: {
        nonce: "expected_nonce",
        requestPackageName: "com.q9labsai.murmur",
        timestampMillis: String(baseParams.now_ms),
      },
    } });
    await expect(verifyPlayIntegrityIfRequired(baseParams)).resolves.toMatchObject({
      code: "play_integrity_verdict_failed",
      ok: false,
    });

    responseFor({ tokenPayloadExternal: {
      appIntegrity: {
        appRecognitionVerdict: "PLAY_RECOGNIZED",
        packageName: "com.q9labsai.murmur",
      },
      deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"] },
      requestDetails: {
        requestHash: "expected_nonce",
        requestPackageName: "com.q9labsai.murmur",
        timestampMillis: String(baseParams.now_ms),
      },
    } });
    await expect(verifyPlayIntegrityIfRequired(baseParams)).resolves.toEqual({
      app_verdict: "PLAY_RECOGNIZED",
      device_verdicts: ["MEETS_DEVICE_INTEGRITY"],
      ok: true,
      request_hash_verified: true,
    });
  });

  it("rejects Android verification when the verifier is unconfigured", async () => {
    await expect(verifyPlayIntegrityIfRequired({
      device_integrity: {
        available: true,
        platform: "android",
        provider: "play_integrity",
        token: "integrity_token_long_enough",
      },
      env: {},
      hashed_install_id: "install_hash",
      now_ms: 1,
      required: true,
    })).resolves.toMatchObject({
      code: "device_integrity_verifier_unconfigured",
      ok: false,
    });
  });

  it("attests and then asserts an iOS device", async () => {
    attestMocks.verifyAttestation.mockResolvedValue({
      publicKeyPem: "public_key",
      signCount: 0,
    });
    attestMocks.verifyAssertion.mockResolvedValue({ signCount: 1 });
    const env = {
      APPLE_APP_ATTEST_APP_ID: "TEAM.com.q9labsai.murmur",
      APPLE_APP_ATTEST_ENVIRONMENT: "development",
    };
    const common = {
      env,
      hashed_install_id: "ios_install",
      now_ms: 2_000_000_000_000,
      required: true,
    };

    await expect(verifyPlayIntegrityIfRequired({
      ...common,
      device_integrity: {
        available: true,
        key_id: "ios_key",
        kind: "attestation",
        nonce: "nonce",
        platform: "ios",
        provider: "app_attest",
        token: "attestation_payload_long_enough",
      },
    })).resolves.toMatchObject({
      app_verdict: "app_attest_attested",
      ok: true,
      request_hash_verified: true,
    });

    await expect(verifyPlayIntegrityIfRequired({
      ...common,
      device_integrity: {
        available: true,
        key_id: "ios_key",
        kind: "assertion",
        nonce: "nonce",
        platform: "ios",
        provider: "app_attest",
        token: "assertion_payload_long_enough",
      },
    })).resolves.toMatchObject({
      app_verdict: "app_attest_asserted",
      ok: true,
      request_hash_verified: true,
    });
  });

  it("rejects incomplete and unknown iOS App Attest requests", async () => {
    const base = {
      hashed_install_id: "ios_install",
      now_ms: 1,
      required: true,
    };
    const token = "app_attest_payload_long_enough";

    await expect(verifyPlayIntegrityIfRequired({
      ...base,
      device_integrity: {
        available: true,
        platform: "ios",
        provider: "app_attest",
        token,
      },
      env: {},
    })).resolves.toMatchObject({
      code: "app_attest_verifier_unconfigured",
      ok: false,
    });

    await expect(verifyPlayIntegrityIfRequired({
      ...base,
      device_integrity: {
        available: true,
        platform: "ios",
        provider: "app_attest",
        token,
      },
      env: {
        APPLE_APP_ATTEST_APP_ID: "app",
        APPLE_APP_ATTEST_ENVIRONMENT: "production",
      },
    })).resolves.toMatchObject({
      code: "device_integrity_required",
      ok: false,
    });

    await expect(verifyPlayIntegrityIfRequired({
      ...base,
      device_integrity: {
        available: true,
        key_id: "missing",
        kind: "assertion",
        nonce: "nonce",
        platform: "ios",
        provider: "app_attest",
        token,
      },
      env: {
        APPLE_APP_ATTEST_APP_ID: "app",
        APPLE_APP_ATTEST_ENVIRONMENT: "production",
      },
    })).resolves.toMatchObject({
      code: "app_attest_device_not_registered",
      ok: false,
    });
  });
});
