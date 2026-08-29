import type { Env } from "../env";

const signatureToleranceSeconds = 5 * 60;

export async function verifyRevenueCatWebhook(params: {
  env: Env;
  headers: Headers;
  nowMs: number;
  rawBody: string;
}): Promise<boolean> {
  const expectedAuthorization = params.env.REVENUECAT_WEBHOOK_AUTH?.trim();
  if (!expectedAuthorization) {
    return false;
  }
  const authorization = params.headers.get("authorization") ?? "";
  if (!constantTimeEqual(authorization, expectedAuthorization)) {
    return false;
  }

  const signingSecret = params.env.REVENUECAT_WEBHOOK_SIGNING_SECRET?.trim();
  if (!signingSecret) {
    return params.env.MURMUR_ENV !== "production";
  }
  const signature = parseSignature(params.headers.get("x-revenuecat-webhook-signature"));
  if (!signature) {
    return false;
  }
  if (Math.abs(Math.floor(params.nowMs / 1_000) - signature.timestamp) > signatureToleranceSeconds) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${signature.timestamp}.${params.rawBody}`),
  );
  return constantTimeEqual(hex(digest), signature.digestHex);
}

function parseSignature(header: string | null): { digestHex: string; timestamp: number } | null {
  if (!header) {
    return null;
  }
  let timestampText: string | null = null;
  let digestText: string | null = null;
  for (const part of header.split(",")) {
    const [name, value] = part.trim().split("=", 2);
    if (name === "t") {
      timestampText = value ?? null;
    }
    if (name === "v1") {
      digestText = value ?? null;
    }
  }
  const timestamp = signatureTimestamp(timestampText);
  const digestHex = signatureDigest(digestText);
  return timestamp === null || digestHex === null ? null : { digestHex, timestamp };
}

function signatureTimestamp(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }
  const timestamp = Number(value);
  return Number.isSafeInteger(timestamp) ? timestamp : null;
}

function signatureDigest(value: string | null): string | null {
  return value && /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : null;
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function hex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
