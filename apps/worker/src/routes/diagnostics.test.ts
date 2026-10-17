import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getMurmurSession: vi.fn() }));
vi.mock("../auth/auth", () => auth);
import { captureMobileDiagnostics } from "./diagnostics";
import { RateLimitDurableObject } from "../rateLimitDurableObject";
import type { Env } from "../env";

// Run the real limiter with its storage boundary in memory. No customer/database fixtures.
const storage = new Map<string, unknown>();
const limiter = new RateLimitDurableObject({
  blockConcurrencyWhile: async (callback: () => Promise<unknown>) => callback(),
  storage: {
    get: async (key: string) => storage.get(key),
    put: async (key: string, value: unknown) => { storage.set(key, value); },
    setAlarm: async () => {},
  },
  // Test double supplies only the runtime APIs this Durable Object uses.
} as unknown as DurableObjectState);
const env: Env = {
  SESSION_HASH_SALT: "fixture-only-salt", MURMUR_ENV: "sandbox",
  // The namespace is the external Cloudflare binding, not a mocked reporting helper.
  RATE_LIMITER: {
    idFromName: () => ({ toString: () => "fixture-id" }),
    get: () => ({ fetch: (input: RequestInfo | URL, init?: RequestInit) => limiter.fetch(new Request(input, init)) }),
  } as unknown as DurableObjectNamespace,
};
function event() {
  return {
    trace_id: "1234567890abcdef1234567890abcdef", span_id: "1234567890abcdef",
    timestamp: new Date().toISOString(), release: "com.q9labsai.murmur@1.3.1+15",
    source_surface: "ios", error_code: "mobile.operation_failed", outcome: "failed", duration_ms: 10,
  };
}
function request(body: unknown) {
  return new Request("https://worker.example/v1/diagnostics", {
    method: "POST", headers: { "CF-Connecting-IP": "192.0.2.1" }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  storage.clear(); auth.getMurmurSession.mockResolvedValue({ user: { id: "PRIVATE_USER" } });
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("authenticated bounded mobile outcome relay", () => {
  it("requires the existing session before reading or exporting anything", async () => {
    auth.getMurmurSession.mockResolvedValue(null);
    expect((await captureMobileDiagnostics(request({ events: [event()] }), env)).status).toBe(401);
    expect(console.log).not.toHaveBeenCalled();
  });
  it.each(["ios", "android"])("writes one safe log line with the mobile correlation and source, never the identity (%s)", async (sourceSurface) => {
    const response = await captureMobileDiagnostics(request({ events: [{ ...event(), source_surface: sourceSurface }] }), env);
    expect(response.status).toBe(202);
    expect(console.log).toHaveBeenCalledTimes(1);
    const exported = String(vi.mocked(console.log).mock.calls[0]?.[0]);
    expect(JSON.parse(exported)).toMatchObject({ trace_id: event().trace_id,
      "service.version": event().release,
      attributes: { source_surface: sourceSurface, reason: "unknown", error_code: "mobile.operation_failed" } });
    expect(exported).not.toMatch(/PRIVATE_USER|192\.0\.2\.1|fixture-only-salt/);
  });
  it.each([
    { extra: "PRIVATE_CREDENTIAL" }, { error_code: "config.flags_credentials_invalid" },
    { source_surface: "worker" }, { trace_id: "private-email@example.test" },
    { duration_ms: Infinity }, { timestamp: "2000-01-01T00:00:00.000Z" },
    { release: "PRIVATE_TRANSCRIPT" }, { release: "murmur-worker@1.3.0+198b2da" },
    { release: "com.q9labsai.murmur@1.3.1+PRIVATE" }, { span_id: "0000000000000000" },
  ])("rejects unsafe or forged fields before any batch write: %j", async (invalid) => {
    expect((await captureMobileDiagnostics(request({ events: [event(), { ...event(), ...invalid }] }), env)).status).toBe(400);
    expect(console.log).not.toHaveBeenCalled();
  });
  it("bounds batch size, declared and chunked body size", async () => {
    expect((await captureMobileDiagnostics(request({ events: Array.from({ length: 9 }, event) }), env)).status).toBe(400);
    expect((await captureMobileDiagnostics(request({ events: [event()], extra: true }), env)).status).toBe(400);
    expect((await captureMobileDiagnostics(request("x".repeat(33 * 1024)), env)).status).toBe(413);
  });
  it("fails closed without production salt or limiter and enforces the real limiter", async () => {
    expect((await captureMobileDiagnostics(request({ events: [event()] }), { ...env, SESSION_HASH_SALT: undefined })).status).toBe(503);
    let status = 202;
    for (let count = 0; count < 121 && status === 202; count += 1) {
      status = (await captureMobileDiagnostics(request({ events: [event()] }), env)).status;
    }
    expect(status).toBe(429);
  });
  it("does not acknowledge a broken sink or retry recursively", async () => {
    vi.mocked(console.log).mockImplementation(() => { throw new Error("PRIVATE_SINK"); });
    expect((await captureMobileDiagnostics(request({ events: [event()] }), env)).status).toBe(503);
    expect(console.log).toHaveBeenCalledTimes(1);
  });
});
