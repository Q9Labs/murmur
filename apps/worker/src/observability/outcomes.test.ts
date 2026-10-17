import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/cloudflare";
import worker from "../index";
import { getServerConfig } from "../serverConfig";
import { verifyPlayIntegrityIfRequired } from "../playIntegrity";
import { queuePostHogEvent } from "./posthog";
import { getSentryOptions } from "./sentry";
import { withHttpDiagnostics } from "./outcomes";
import { createReport } from "../routes/report";
import { createSessionRecordDurable } from "../rateLimitDurableObject";
import { logWorkerEvent } from "../privacy";

// External native library is not involved in these Android/HTTP fixtures.
vi.mock("@bradford-tech/supabase-integrity-attest", () => ({
  AssertionError: class extends Error {}, AttestationError: class extends Error {},
  verifyAssertion: vi.fn(), verifyAttestation: vi.fn(),
}));

const env = {
  MURMUR_ENV: "sandbox", MURMUR_DIAGNOSTICS_FIXTURE: "a".repeat(64),
  SENTRY_DSN: "https://public@collector.example/1", SENTRY_RELEASE: "murmur-worker@1.3.0+198b2da08ce8",
};
const sentryBodies: string[] = [];
let lines: string[] = [];
let deliveryFailure: "dns" | "429" | "timeout" | undefined;
const receipts: Array<{ proof: string; envelopes: string[]; outcomes: string[] }> = [];
const providerFetch = vi.fn<typeof fetch>();
const pending: Promise<unknown>[] = [];
const context = {
  waitUntil(promise: Promise<unknown>) { pending.push(promise); },
  passThroughOnException() {}, props: {},
};
const trace = "1234567890abcdef1234567890abcdef";
function request(path = "/__diagnostics/failure") {
  return new Request(`https://worker.example${path}?private=PRIVATE_SENTINEL`, {
    headers: { Authorization: `Bearer ${env.MURMUR_DIAGNOSTICS_FIXTURE}`, traceparent: `00-${trace}-1234567890abcdef-00` },
  });
}
async function withSdk(operation: () => Promise<void>) {
  const fixture = Sentry.withSentry((_env: typeof env) => getSentryOptions(env), {
    async fetch(_request: Request, _env: typeof env, _context: ExecutionContext) { await operation(); return new Response(); },
  });
  await fixture.fetch(request("/health"), env, context);
}
function integrityFixture() {
  return {
    device_integrity: { available: true, token: "private-proof", platform: "android", provider: "play_integrity" },
    env: { ...env, GOOGLE_PLAY_PACKAGE_NAME: "com.example.app", GOOGLE_PLAY_INTEGRITY_ACCESS_TOKEN: "private-key" },
    required: false, hashed_install_id: "private-install", now_ms: Date.now(),
  } as const;
}
async function expectIntegrityOutcome(result: { ok: boolean }, code: unknown, count: unknown, privateMarker: string) {
  expect(result.ok).toBe(true);
  await drain();
  expect(exceptionCount()).toBe(count);
  expect(JSON.parse(lines[0] ?? "").attributes.error_code).toBe(code);
  expect(sentryBodies.join("") + lines.join("")).not.toContain(privateMarker);
}
async function drain() {
  await Sentry.flush(2_000);
  await Promise.all(pending);
}
function exceptionCount() {
  return sentryBodies.filter((body) => body.includes('"type":"event"')).length;
}
beforeEach(() => {
  sentryBodies.length = 0; pending.length = 0; lines = []; deliveryFailure = undefined;
  providerFetch.mockReset();
  vi.spyOn(console, "log").mockImplementation((line: string) => { lines.push(line); });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith("https://collector.example/")) {
      sentryBodies.push(typeof init?.body === "string" ? init.body : new TextDecoder().decode(init?.body instanceof Uint8Array ? init.body : undefined));
      if (deliveryFailure === "dns") throw new Error("PRIVATE_DNS_FAILURE");
      if (deliveryFailure === "429") return new Response("", { status: 429 });
      if (deliveryFailure === "timeout") return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
      return new Response("{}", { status: 200 });
    }
    return providerFetch(input, init);
  });
});
afterEach(async () => {
  await drain();
  receipts.push({ proof: expect.getState().currentTestName ?? "unknown", envelopes: [...sentryBodies], outcomes: [...lines] });
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

afterAll(() => {
  if (process.env.MURMUR_DIAGNOSTIC_PROOF !== "1") return;
  mkdirSync("../../artifacts/observability", { recursive: true });
  writeFileSync("../../artifacts/observability/sdk-proofs.json", JSON.stringify(receipts, null, 2));
});

describe("Worker diagnostic proofs (real SDK envelopes and HTTP boundary)", () => {
  it("P1: reports an unexpected HTTP failure once, with matching safe code and outcome", async () => {
    const response = await worker.fetch(request(), env, context);
    expect(response.status).toBe(500);
    expect(response.headers.get("X-Diagnostic-Code")).toBe(trace);
    expect(await response.json()).toEqual({ error: "worker_operation_failed", diagnostic_code: trace });
    await drain();
    expect(exceptionCount()).toBe(1);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      trace_id: trace, synthetic: true,
      attributes: { reason: "unknown", error_code: "worker.request_failed", outcome: "failed" },
    });
    expect(sentryBodies.join("")).toContain(trace);
    expect(sentryBodies.join("")).toContain(JSON.parse(lines[0] ?? "").sentry_event_id);
    expect(sentryBodies.join("")).not.toContain('"type":"transaction"');
  });

  it("P2: optional integrity rejection continues, logs degradation, and sends no exception", async () => {
    await withSdk(async () => {
    providerFetch.mockResolvedValue(new Response(JSON.stringify({ tokenPayloadExternal: {
      requestDetails: { nonce: "wrong", requestPackageName: "com.example.app", timestampMillis: String(Date.now()) },
      appIntegrity: { packageName: "com.example.app", appRecognitionVerdict: "PLAY_RECOGNIZED" },
    } })));
    const result = await verifyPlayIntegrityIfRequired({
      ...integrityFixture(), device_integrity: { ...integrityFixture().device_integrity, nonce: "expected" },
    });
    expect(result.ok).toBe(true);
    await drain();
    expect(exceptionCount()).toBe(0);
    expect(lines.join("")).toContain('"error_code":"integrity.optional_rejected"');
    });
  });

  it.each([
    [400, "INVALID_ARGUMENT", "integrity.optional_rejected", 0],
    [400, "UNRECOGNIZED", "integrity.optional_verification_failed", 1],
    [404, "UNRECOGNIZED", "integrity.optional_verification_failed", 1],
    [401, "UNAUTHENTICATED", "integrity.configuration_invalid", 1],
    [503, "UNAVAILABLE", "integrity.optional_unavailable", 0],
  ])("P2/P3: optional integrity status %s (%s) retains its cause without failing closed", async (status, providerStatus, code, count) => {
    await withSdk(async () => {
    providerFetch.mockResolvedValue(new Response(JSON.stringify({ error: { status: providerStatus, message: "PRIVATE_PROVIDER" } }), { status }));
    const result = await verifyPlayIntegrityIfRequired({
      ...integrityFixture(),
    });
    await expectIntegrityOutcome(result, code, count, "PRIVATE_PROVIDER");
    });
  });

  it.each([
    [401, "integrity.configuration_invalid", 1],
    [429, "integrity.optional_unavailable", 0],
    [503, "integrity.optional_unavailable", 0],
    [418, "integrity.optional_verification_failed", 1],
  ])("P3: OAuth status %s preserves credentials, outages and unknown failures", async (status, code, count) => {
    await withSdk(async () => {
      const key = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
      const bytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", key.privateKey));
      const privateKey = btoa(String.fromCharCode(...bytes));
      providerFetch.mockResolvedValue(new Response(JSON.stringify({ error: "PRIVATE_OAUTH" }), { status }));
      const fixture = integrityFixture();
      const result = await verifyPlayIntegrityIfRequired({ ...fixture, env: {
        ...env, GOOGLE_PLAY_PACKAGE_NAME: "com.example.app", GOOGLE_SERVICE_ACCOUNT_EMAIL: "fixture@example.test",
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: privateKey,
      } });
      await expectIntegrityOutcome(result, code, count, "PRIVATE_OAUTH");
    });
  });

  it.each([
    [400, "config.flags_request_invalid", "defect", 1],
    [401, "config.flags_credentials_invalid", "defect", 1],
    [403, "config.flags_credentials_invalid", "defect", 1],
    [429, "config.flags_unavailable", "dependency", 0],
    [503, "config.flags_unavailable", "dependency", 0],
    [418, "config.flags_failed", "unknown", 1],
  ])("P3: provider status %s retains its meaning and working fallback", async (status, code, reason, captures) => {
    await withSdk(async () => {
    providerFetch.mockResolvedValue(new Response("PRIVATE_PROVIDER_BODY", { status }));
    const config = await getServerConfig({ ...env, POSTHOG_PROJECT_TOKEN: "private-key" }, {
      appVersion: null, distinctId: crypto.randomUUID(), plan: "free", platform: null,
    });
    expect(config.sessions_enabled).toBe(true);
    await drain();
    expect(exceptionCount()).toBe(captures);
    expect(JSON.parse(lines[0] ?? "").attributes).toMatchObject({ error_code: code, reason, outcome: "degraded" });
    });
  });

  it("P4: a provider that never completes crosses the real 800ms deadline and becomes visible", async () => {
    await withSdk(async () => {
    providerFetch.mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    const config = await getServerConfig({ ...env, POSTHOG_PROJECT_TOKEN: "private-key" }, {
      appVersion: null, distinctId: crypto.randomUUID(), plan: "free", platform: null,
    });
    expect(config.sessions_enabled).toBe(true);
    const line = JSON.parse(lines[0] ?? "");
    expect(line.attributes.error_code).toBe("config.flags_timeout_fallback");
    expect(line.attributes.duration_ms).toBeGreaterThanOrEqual(750);
    expect(line.attributes.duration_ms).toBeLessThan(2_000);
    await drain(); expect(exceptionCount()).toBe(0);
    });
  });

  it("P5: private content and automatic enrichment cannot escape actual SDK envelopes or logs", async () => {
    const response = await worker.fetch(request(), env, context);
    await response.text();
    await drain();
    const exported = sentryBodies.join("") + lines.join("");
    expect(exceptionCount()).toBe(1);
    expect(exported).not.toMatch(/PRIVATE_SENTINEL|SYNTHETIC_PRIVATE_TRANSCRIPT|fixture-admin|secret=fixture|worker\.example|Authorization/i);
    expect(exported).toContain("Worker request did not complete");
  });

  it.each([{}, { tokenPayloadExternal: {} }, { tokenPayloadExternal: { requestDetails: "PRIVATE_MALFORMED" } }])(
    "P3: malformed Google success remains optional but reports an unknown defect (%j)", async (payload) => {
      await withSdk(async () => {
        providerFetch.mockResolvedValue(Response.json(payload));
        const result = await verifyPlayIntegrityIfRequired(integrityFixture());
        await expectIntegrityOutcome(result, "integrity.optional_verification_failed", 1, "PRIVATE_MALFORMED");
      });
    },
  );

  it("P5: real exported stop handler cannot log a private session id", async () => {
    const response = await worker.fetch(new Request(
      "https://worker.example/v2/session/PRIVATE_TRANSCRIPT_SENTINEL/stop", { method: "POST" },
    ), env, context);
    expect(response.status).toBe(200);
    await drain();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({ event: "session_stop", app_session_id: "[redacted]" });
    expect(JSON.stringify({ logs: lines, envelopes: sentryBodies })).not.toContain("PRIVATE_TRANSCRIPT_SENTINEL");
  });

  it("P5: real report parser and logger cannot log a private span id", async () => {
    const session = crypto.randomUUID();
    await createSessionRecordDurable({ app_session_id: session, now_ms: Date.now(), hashed_install_id: "a".repeat(64) });
    const response = await createReport(new Request("https://worker.example/v2/report", {
      method: "POST", body: JSON.stringify({ app_session_id: session, span_id: "PRIVATE_TRANSCRIPT_SENTINEL",
        error_category: "inaccurate", revision: 1, source_language: "en", target_language: "ar" }),
    }), env);
    expect(response.status).toBe(202);
    expect(lines.some((line) => JSON.parse(line).event === "translation_reported")).toBe(true);
    expect(JSON.stringify({ logs: lines, envelopes: sentryBodies })).not.toContain("PRIVATE_TRANSCRIPT_SENTINEL");
  });

  // One shape for every console producer, including the scheduled producers outside this pilot's HTTP scope.
  it.each([
    { event: "session_created", app_session_id: "PRIVATE_TRANSCRIPT_SENTINEL", hashed_install_id: "PRIVATE_TRANSCRIPT_SENTINEL" },
    { event: "session_stop", app_session_id: "PRIVATE_TRANSCRIPT_SENTINEL" },
    { event: "translation_reported", app_session_id: "PRIVATE_TRANSCRIPT_SENTINEL", report_id: "PRIVATE_TRANSCRIPT_SENTINEL", translation_span_id: "PRIVATE_TRANSCRIPT_SENTINEL" },
    { event: "translation_report_forward_failed", app_session_id: "PRIVATE_TRANSCRIPT_SENTINEL", report_id: "PRIVATE_TRANSCRIPT_SENTINEL", reason: "unconfigured" },
    { event: "revenuecat_reconciliation_completed", attempted: 1, failed: 0 },
    { event: "abandoned_usage_sessions_closed", closed: 1 },
    { event: "session_insight_retention_completed", deleted_insights: 1, deleted_session_contexts: 1 },
    { event: "rating_survey_retention_completed", deleted_rating_surveys: 1 },
    { event: "expired_auth_sessions_deleted", deleted_sessions: 1 },
    { trace_id: "PRIVATE_TRANSCRIPT_SENTINEL", span_id: "PRIVATE_TRANSCRIPT_SENTINEL", sentry_event_id: "PRIVATE_TRANSCRIPT_SENTINEL", body: "Worker request did not complete" },
  ])("P5: complete outgoing console record is safe for producer %j", async (record) => {
    logWorkerEvent(record);
    await drain();
    const exported = JSON.stringify({ logs: lines, envelopes: sentryBodies });
    expect(lines).toHaveLength(1);
    expect(exported).not.toContain("PRIVATE_TRANSCRIPT_SENTINEL");
  });

  it("P6: broken log sink and failed analytics export preserve success and original error", async () => {
    vi.mocked(console.log).mockImplementation(() => { throw new Error("PRIVATE_LOG_SINK"); });
    const success = await worker.fetch(request("/health"), env, context);
    expect(success.status).toBe(200); await success.text();
    const failure = await worker.fetch(request(), env, context);
    expect(failure.status).toBe(500); await failure.text();
    providerFetch.mockRejectedValue(new Error("PRIVATE_POSTHOG"));
    queuePostHogEvent({ context, env: { POSTHOG_PROJECT_TOKEN: "private-key" }, distinct_id: "private-install", payload: {
      event: "worker_first_translation", app_session_id: "private-session", provider_elapsed_ms: null, worker_elapsed_ms: 1,
    } });
    await drain();
    expect(exceptionCount()).toBe(1);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(sentryBodies.join("")).not.toMatch(/PRIVATE_LOG_SINK|PRIVATE_POSTHOG/);
  });

  it("P5: reconstructs exception chains, contexts, breadcrumbs and frame locals in the actual envelope", async () => {
    await withSdk(async () => {
    Sentry.captureEvent({
      message: "PRIVATE_SENTINEL transcript", tags: { customer: "PRIVATE_SENTINEL" },
      user: { email: "PRIVATE_SENTINEL@example.test" },
      extra: { api_key: "PRIVATE_SENTINEL", answers: "PRIVATE_SENTINEL" },
      contexts: { provider: { transcript: "PRIVATE_SENTINEL" } },
      breadcrumbs: [{ message: "PRIVATE_SENTINEL", data: { cookie: "PRIVATE_SENTINEL" } }],
      request: { url: "https://PRIVATE_SENTINEL.test/customer/PRIVATE_SENTINEL", data: "PRIVATE_SENTINEL", headers: { authorization: "PRIVATE_SENTINEL" } },
      exception: { values: [
        { type: "PRIVATE_SENTINEL", value: "PRIVATE_SENTINEL", stacktrace: { frames: [{
          filename: "/Users/PRIVATE_SENTINEL/code/murmur/apps/worker/src/index.ts", lineno: 10,
          vars: { password: "PRIVATE_SENTINEL" }, pre_context: ["PRIVATE_SENTINEL"], context_line: "PRIVATE_SENTINEL",
        }] } },
        { type: "PRIVATE_SENTINEL", value: "PRIVATE_SENTINEL" },
      ] },
    });
    await drain();
    expect(exceptionCount()).toBe(1);
    expect(sentryBodies.join("")).not.toContain("PRIVATE_SENTINEL");
    expect(sentryBodies.join("")).toContain("app:///apps/worker/src/index.ts");
    expect(sentryBodies.join("")).toContain('"lineno":10');
    });
  });

  it.each(["dns", "429", "timeout"] as const)("P6: Sentry %s failure cannot replace the original result or recurse", async (mode) => {
    deliveryFailure = mode;
    const response = await worker.fetch(request(), env, context);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ diagnostic_code: trace });
    await drain();
    expect(lines).toHaveLength(1);
    expect(exceptionCount()).toBe(1);
    expect(sentryBodies.join("")).not.toContain("PRIVATE_DNS_FAILURE");
  });

  it.each(["00", "01", "09", "fe", "ff"])("P1: preserves caller correlation with trace flags %s", async (flags) => {
    const incoming = request();
    incoming.headers.set("traceparent", `00-${trace}-1234567890abcdef-${flags}`);
    const response = await worker.fetch(incoming, env, context);
    expect(response.status).toBe(500);
    expect(response.headers.get("X-Diagnostic-Code")).toBe(trace);
    await response.text(); await drain();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "").trace_id).toBe(trace);
    expect(sentryBodies.join("")).toContain(trace);
  });

  it("ignores invalid incoming correlation and never enables a production crash route", async () => {
    const response = await worker.fetch(new Request("https://worker.example/__diagnostics/failure", {
      headers: { Authorization: `Bearer ${env.MURMUR_DIAGNOSTICS_FIXTURE}`, traceparent: "PRIVATE_SENTINEL" },
    }), { ...env, MURMUR_ENV: "production" }, context);
    expect(response.status).toBe(404);
    expect(response.headers.get("X-Diagnostic-Code")).toMatch(/^[a-f0-9]{32}$/);
    await response.text(); await drain(); expect(exceptionCount()).toBe(0);
  });

  it("does not recapture a caught HTTP rejection in outer automatic instrumentation", async () => {
    const result = await withHttpDiagnostics(request(), env, async () => { throw new TypeError("PRIVATE_SENTINEL"); });
    expect(result.status).toBe(500);
  });
});
