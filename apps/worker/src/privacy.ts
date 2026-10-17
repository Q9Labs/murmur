export async function hashInstallId(installId: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${installId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function logWorkerEvent(event: Record<string, unknown>): void {
  console.log(JSON.stringify(redactWorkerEvent(event)));
}

export function redactWorkerEvent(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactWorkerEvent(item));
  }
  if (!isRecord(value)) {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveLogKey(key)) {
      redacted[key] = "[redacted]";
      continue;
    }
    if (isLogIdKey(key)) {
      redacted[key] = isSafeLogId(key, child) ? child : "[redacted]";
      continue;
    }
    redacted[key] = redactWorkerEvent(child);
  }
  return redacted;
}

function isLogIdKey(key: string): boolean {
  const normalized = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  return /(?:^|[_.-])ids?$/.test(normalized) || /IDs?$/.test(key);
}

function isSafeLogId(key: string, value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (key === "trace_id" || key === "sentry_event_id") return /^(?!0{32}$)[a-f0-9]{32}$/.test(value);
  if (key === "translation_span_id") return /^span_[a-z0-9]{8}_[a-z0-9]{8}$/.test(value);
  if (key === "span_id") return /^(?!0{16}$)[a-f0-9]{16}$/.test(value);
  if (key === "hashed_install_id") return /^[a-f0-9]{64}$/.test(value);
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ||
    /^(?:[a-f0-9]{16}|[a-f0-9]{32}|[a-f0-9]{64})$/.test(value);
}

function isSensitiveLogKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.includes("api_key") ||
    normalized.includes("authorization") ||
    normalized.includes("audio") ||
    normalized === "source_caption" ||
    normalized === "translated_caption" ||
    normalized === "optional_source_text_snapshot" ||
    normalized === "optional_translated_text_snapshot" ||
    normalized === "optional_user_note" ||
    normalized === "transcript" ||
    normalized === "translation"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
