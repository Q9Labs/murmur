/// <reference types="@cloudflare/workers-types" />

import {
  AssertionError,
  AttestationError,
  verifyAssertion,
  verifyAttestation,
} from "@bradford-tech/supabase-integrity-attest";

import {
  getAppAttestDeviceDurable,
  storeAppAttestDeviceDurable,
  updateAppAttestSignCountDurable,
} from "./rateLimitDurableObject";

export type PlayIntegrityEnv = {
  APPLE_APP_ATTEST_APP_ID?: string;
  APPLE_APP_ATTEST_ENVIRONMENT?: string;
  GOOGLE_PLAY_INTEGRITY_ACCESS_TOKEN?: string;
  GOOGLE_PLAY_INTEGRITY_REQUIRED_DEVICE_VERDICT?: string;
  GOOGLE_PLAY_PACKAGE_NAME?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
};

export type DeviceIntegrityInput = {
  available: boolean;
  key_id?: string;
  kind?: string;
  nonce?: string;
  platform: string | null;
  provider: string | null;
  token?: string;
};

export type PlayIntegrityVerificationResult =
  | {
      ok: true;
      app_verdict: string | null;
      device_verdicts: string[];
      request_hash_verified: boolean;
    }
  | {
      ok: false;
      code:
        | "device_integrity_required"
        | "device_integrity_verifier_unconfigured"
        | "device_integrity_provider_unsupported"
        | "app_attest_verifier_unconfigured"
        | "app_attest_device_not_registered"
        | "app_attest_replay_detected"
        | "app_attest_verification_failed"
        | "play_integrity_app_mismatch"
        | "play_integrity_decode_failed"
        | "play_integrity_nonce_mismatch"
        | "play_integrity_token_expired"
        | "play_integrity_verdict_failed";
      status: number;
    };

type DecodedPlayIntegrityResponse = {
  tokenPayloadExternal?: {
    accountDetails?: {
      appLicensingVerdict?: string;
    };
    appIntegrity?: {
      appRecognitionVerdict?: string;
      certificateSha256Digest?: string[];
      packageName?: string;
      versionCode?: string;
    };
    deviceIntegrity?: {
      deviceRecognitionVerdict?: string[];
    };
    requestDetails?: {
      nonce?: string;
      requestHash?: string;
      requestPackageName?: string;
      timestampMillis?: string;
    };
  };
};

const playIntegrityScope = "https://www.googleapis.com/auth/playintegrity";

export async function verifyPlayIntegrityIfRequired(params: {
  device_integrity: DeviceIntegrityInput;
  env: PlayIntegrityEnv;
  hashed_install_id: string;
  namespace?: DurableObjectNamespace;
  now_ms: number;
  required: boolean;
}): Promise<PlayIntegrityVerificationResult> {
  if (!params.required) {
    return {
      ok: true,
      app_verdict: null,
      device_verdicts: [],
      request_hash_verified: false,
    };
  }

  const integrity = params.device_integrity;
  if (!integrity.available || !integrity.token) {
    return { ok: false, code: "device_integrity_required", status: 403 };
  }

  if (integrity.platform === "ios" && integrity.provider === "app_attest") {
    return verifyAppAttest({
      device_integrity: integrity,
      env: params.env,
      hashed_install_id: params.hashed_install_id,
      namespace: params.namespace,
      now_ms: params.now_ms,
    });
  }

  if (integrity.platform !== "android" || integrity.provider !== "play_integrity") {
    return { ok: false, code: "device_integrity_provider_unsupported", status: 403 };
  }

  if (!params.env.GOOGLE_PLAY_PACKAGE_NAME) {
    return { ok: false, code: "device_integrity_verifier_unconfigured", status: 503 };
  }

  const accessToken = await getGoogleAccessToken(params.env);
  if (!accessToken) {
    return { ok: false, code: "device_integrity_verifier_unconfigured", status: 503 };
  }

  const decoded = await decodePlayIntegrityToken({
    accessToken,
    integrityToken: integrity.token,
    packageName: params.env.GOOGLE_PLAY_PACKAGE_NAME,
  });
  if (!decoded) {
    return { ok: false, code: "play_integrity_decode_failed", status: 403 };
  }

  const payload = decoded.tokenPayloadExternal;
  const requestPackageName = payload?.requestDetails?.requestPackageName;
  const appPackageName = payload?.appIntegrity?.packageName;
  if (
    requestPackageName !== params.env.GOOGLE_PLAY_PACKAGE_NAME ||
    (appPackageName && appPackageName !== params.env.GOOGLE_PLAY_PACKAGE_NAME)
  ) {
    return { ok: false, code: "play_integrity_app_mismatch", status: 403 };
  }

  const returnedHash = payload?.requestDetails?.requestHash ?? payload?.requestDetails?.nonce;
  if (integrity.nonce && returnedHash !== integrity.nonce) {
    return { ok: false, code: "play_integrity_nonce_mismatch", status: 403 };
  }

  const timestampMillis = Number(payload?.requestDetails?.timestampMillis ?? "0");
  const maxTokenAgeMs = 5 * 60 * 1000;
  if (
    Number.isFinite(timestampMillis) &&
    timestampMillis > 0 &&
    Math.abs(params.now_ms - timestampMillis) > maxTokenAgeMs
  ) {
    return { ok: false, code: "play_integrity_token_expired", status: 403 };
  }

  const deviceVerdicts = payload?.deviceIntegrity?.deviceRecognitionVerdict ?? [];
  const requiredVerdict =
    params.env.GOOGLE_PLAY_INTEGRITY_REQUIRED_DEVICE_VERDICT ?? "MEETS_DEVICE_INTEGRITY";
  if (!deviceVerdicts.includes(requiredVerdict)) {
    return { ok: false, code: "play_integrity_verdict_failed", status: 403 };
  }

  return {
    ok: true,
    app_verdict: payload?.appIntegrity?.appRecognitionVerdict ?? null,
    device_verdicts: deviceVerdicts,
    request_hash_verified: Boolean(integrity.nonce && returnedHash === integrity.nonce),
  };
}

async function verifyAppAttest(params: {
  device_integrity: DeviceIntegrityInput;
  env: PlayIntegrityEnv;
  hashed_install_id: string;
  namespace?: DurableObjectNamespace;
  now_ms: number;
}): Promise<PlayIntegrityVerificationResult> {
  const integrity = params.device_integrity;
  if (!params.env.APPLE_APP_ATTEST_APP_ID || !params.env.APPLE_APP_ATTEST_ENVIRONMENT) {
    return { ok: false, code: "app_attest_verifier_unconfigured", status: 503 };
  }

  if (!integrity.key_id || !integrity.kind || !integrity.nonce || !integrity.token) {
    return { ok: false, code: "device_integrity_required", status: 403 };
  }

  const appInfo = {
    appId: params.env.APPLE_APP_ATTEST_APP_ID,
    developmentEnv: params.env.APPLE_APP_ATTEST_ENVIRONMENT !== "production",
  };

  if (integrity.kind === "attestation") {
    try {
      const result = await verifyAttestation(
        appInfo,
        integrity.key_id,
        await sha256Bytes(integrity.nonce),
        integrity.token,
      );
      await storeAppAttestDeviceDurable({
        hashed_install_id: params.hashed_install_id,
        key_id: integrity.key_id,
        namespace: params.namespace,
        now_ms: params.now_ms,
        public_key_pem: result.publicKeyPem,
        sign_count: result.signCount,
      });
      return {
        ok: true,
        app_verdict: "app_attest_attested",
        device_verdicts: ["APP_ATTEST_ATTESTED"],
        request_hash_verified: true,
      };
    } catch (error) {
      if (error instanceof AttestationError) {
        return { ok: false, code: "app_attest_verification_failed", status: 403 };
      }
      throw error;
    }
  }

  if (integrity.kind !== "assertion") {
    return { ok: false, code: "device_integrity_required", status: 403 };
  }

  const device = await getAppAttestDeviceDurable({
    key_id: integrity.key_id,
    namespace: params.namespace,
  });
  if (!device) {
    return { ok: false, code: "app_attest_device_not_registered", status: 403 };
  }
  if (device.hashed_install_id !== params.hashed_install_id) {
    return { ok: false, code: "app_attest_device_not_registered", status: 403 };
  }

  try {
    const result = await verifyAssertion(
      { appId: params.env.APPLE_APP_ATTEST_APP_ID },
      integrity.token,
      integrity.nonce,
      device.public_key_pem,
      device.sign_count,
    );
    const counterUpdate = await updateAppAttestSignCountDurable({
      key_id: integrity.key_id,
      namespace: params.namespace,
      now_ms: params.now_ms,
      sign_count: result.signCount,
    });
    if (!counterUpdate.ok) {
      return { ok: false, code: "app_attest_replay_detected", status: 403 };
    }
    return {
      ok: true,
      app_verdict: "app_attest_asserted",
      device_verdicts: ["APP_ATTEST_ASSERTED"],
      request_hash_verified: true,
    };
  } catch (error) {
    if (error instanceof AssertionError) {
      return { ok: false, code: "app_attest_verification_failed", status: 403 };
    }
    throw error;
  }
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function decodePlayIntegrityToken(params: {
  accessToken: string;
  integrityToken: string;
  packageName: string;
}): Promise<DecodedPlayIntegrityResponse | null> {
  const response = await fetch(
    `https://playintegrity.googleapis.com/v1/${params.packageName}:decodeIntegrityToken`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ integrity_token: params.integrityToken }),
    },
  );
  if (!response.ok) {
    return null;
  }
  return (await response.json().catch(() => null)) as DecodedPlayIntegrityResponse | null;
}

async function getGoogleAccessToken(env: PlayIntegrityEnv): Promise<string | null> {
  if (env.GOOGLE_PLAY_INTEGRITY_ACCESS_TOKEN) {
    return env.GOOGLE_PLAY_INTEGRITY_ACCESS_TOKEN;
  }
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const assertion = await signServiceAccountJwt({
    clientEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKeyPem: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    nowSeconds,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string };
  return response.ok && body.access_token ? body.access_token : null;
}

async function signServiceAccountJwt(params: {
  clientEmail: string;
  privateKeyPem: string;
  nowSeconds: number;
}): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      aud: "https://oauth2.googleapis.com/token",
      exp: params.nowSeconds + 3600,
      iat: params.nowSeconds,
      iss: params.clientEmail,
      scope: playIntegrityScope,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(params.privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  const base64 = normalized
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function base64UrlEncode(value: string | ArrayBuffer): string {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
