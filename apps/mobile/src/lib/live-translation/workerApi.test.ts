import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  PermissionsAndroid: {
    PERMISSIONS: { RECORD_AUDIO: "android.permission.RECORD_AUDIO" },
    RESULTS: { GRANTED: "granted" },
    request: vi.fn(),
  },
  Platform: { OS: "android" },
}));

vi.mock("../../../modules/murmur-audio", () => ({
  default: {},
}));

vi.mock("../auth/client", () => ({
  authenticatedWorkerHeaders: vi.fn(async (headers: HeadersInit) => new Headers(headers)),
}));

vi.mock("../config", () => ({
  getWorkerBaseUrl: () => "https://worker.example.test",
}));

import { createWorkerSession, workerSessionRequestTimeoutMs } from "./workerApi";

const request = {
  analytics_enabled: false,
  app_install_id: "install_1",
  device_integrity: { available: false, platform: "android" },
  source_language: "en" as const,
  target_language: "ar" as const,
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createWorkerSession", () => {
  it("aborts a session request that does not settle before the connection deadline", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    }));

    const pending = createWorkerSession(request);
    await vi.advanceTimersByTimeAsync(workerSessionRequestTimeoutMs);

    await expect(pending).resolves.toEqual({ error: "worker_session_network_error" });
    expect(requestSignal?.aborted).toBe(true);
  });

  it("keeps the deadline active while reading a stalled response body", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return Promise.resolve(new Response(new ReadableStream({ start: () => undefined })));
    }));

    const pending = createWorkerSession(request);
    await vi.advanceTimersByTimeAsync(workerSessionRequestTimeoutMs);

    await expect(pending).resolves.toEqual({ error: "worker_session_network_error" });
    expect(requestSignal?.aborted).toBe(true);
  });

  it("returns a successful response before the deadline", async () => {
    vi.useFakeTimers();
    const payload = {
      app_session_id: "session_1",
      limits: { expires_at_ms: 20_000 },
      realtime_ws_url: "wss://worker.example.test/realtime",
      session_epoch: 1,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );

    await expect(createWorkerSession(request)).resolves.toEqual(payload);
  });
});
