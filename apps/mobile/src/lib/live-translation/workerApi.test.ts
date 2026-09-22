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

import {
  closeWorkerSession,
  createWorkerSession,
  workerSessionCloseTimeoutMs,
  workerSessionRequestTimeoutMs,
} from "./workerApi";

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

describe("closeWorkerSession", () => {
  it("sends a keepalive stop request and reports a clean close", async () => {
    let requestInit: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requestInit = init;
      return new Response(null, { status: 204 });
    }));

    await expect(closeWorkerSession("session_1", "stop")).resolves.toBe("closed");
    expect(requestInit?.keepalive).toBe(true);
    expect(requestInit?.signal).toBeDefined();
  });

  it("treats a network failure as expected instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Network request failed");
      }),
    );

    await expect(closeWorkerSession("session_1", "stop")).resolves.toBe("network_unavailable");
  });

  it("aborts a stop request that outlives the close deadline", async () => {
    vi.useFakeTimers();
    let aborted = false;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>(
      (_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("Aborted", "AbortError"));
        });
      },
    )));

    const pending = closeWorkerSession("session_1", "stop");
    await vi.advanceTimersByTimeAsync(workerSessionCloseTimeoutMs);

    await expect(pending).resolves.toBe("network_unavailable");
    expect(aborted).toBe(true);
  });

  it("propagates failures that are not network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new RangeError("unexpected");
      }),
    );

    await expect(closeWorkerSession("session_1", "stop")).rejects.toBeInstanceOf(RangeError);
  });
});
