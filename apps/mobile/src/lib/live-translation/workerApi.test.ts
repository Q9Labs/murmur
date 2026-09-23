import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const permissionHarness = vi.hoisted(() => ({
  permissionResult: "granted",
  platform: { OS: "android" },
  requestDevicePlaybackPermission: vi.fn(async () => true),
  requestMicrophonePermission: vi.fn(async () => true),
  requestPlayIntegrityToken: vi.fn(async () => ({
    available: true,
    nonce: "encoded_nonce",
    token: "integrity_token_long_enough",
  })),
  requestPermission: vi.fn(async () => "granted"),
}));

vi.mock("react-native", () => ({
  PermissionsAndroid: {
    PERMISSIONS: { RECORD_AUDIO: "android.permission.RECORD_AUDIO" },
    RESULTS: { GRANTED: "granted" },
    request: permissionHarness.requestPermission,
  },
  Platform: permissionHarness.platform,
}));

vi.mock("../../../modules/murmur-audio", () => ({
  default: {
    requestDevicePlaybackPermission: permissionHarness.requestDevicePlaybackPermission,
    requestMicrophonePermission: permissionHarness.requestMicrophonePermission,
    requestPlayIntegrityToken: permissionHarness.requestPlayIntegrityToken,
  },
}));

vi.mock("../auth/client", () => import("../__tests__/workerClientMocks"));
vi.mock("../config", () => import("../__tests__/workerClientMocks"));
vi.mock("../appRelease", () => ({
  getAppRelease: () => ({ app_platform: "android", app_version: "1.2.3" }),
}));

import {
  closeWorkerSession,
  collectDeviceIntegrity,
  createWorkerSession,
  hasSourceTranscript,
  requestCapturePermission,
  workerSessionCloseTimeoutMs,
  workerSessionRequestTimeoutMs,
} from "./workerApi";

const request = {
  capture_source: "microphone" as const,
  analytics_enabled: false,
  app_install_id: "install_1",
  device_integrity: { available: false, platform: "android" },
  playback_enabled: true,
  source_language: "en" as const,
  target_language: "ar" as const,
};

beforeEach(() => {
  permissionHarness.platform.OS = "android";
  permissionHarness.permissionResult = "granted";
  permissionHarness.requestPermission.mockReset().mockImplementation(
    async () => permissionHarness.permissionResult,
  );
  permissionHarness.requestDevicePlaybackPermission.mockReset().mockResolvedValue(true);
  permissionHarness.requestMicrophonePermission.mockReset().mockResolvedValue(true);
  permissionHarness.requestPlayIntegrityToken.mockReset().mockResolvedValue({
    available: true,
    nonce: "encoded_nonce",
    token: "integrity_token_long_enough",
  });
});

describe("device integrity", () => {
  it("sends the encoded nonce returned by the Android provider", async () => {
    const integrity = await collectDeviceIntegrity({
      appInstallId: "install_1234567890",
      sourceLanguage: "en",
      targetLanguage: "ar",
    });
    expect(permissionHarness.requestPlayIntegrityToken).toHaveBeenCalledOnce();
    expect(integrity).toMatchObject({
      available: true,
      nonce: "encoded_nonce",
      provider: "play_integrity",
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("capture permission routing", () => {
  it("uses Android audio recording permission for microphone capture", async () => {
    await expect(requestCapturePermission("microphone")).resolves.toBe(true);

    expect(permissionHarness.requestPermission).toHaveBeenCalledWith(
      "android.permission.RECORD_AUDIO",
    );
    expect(permissionHarness.requestDevicePlaybackPermission).not.toHaveBeenCalled();
  });

  it("opens Android playback consent only after the runtime grant", async () => {
    await expect(requestCapturePermission("device_playback")).resolves.toBe(true);

    expect(permissionHarness.requestPermission).toHaveBeenCalledWith(
      "android.permission.RECORD_AUDIO",
    );
    expect(permissionHarness.requestDevicePlaybackPermission).toHaveBeenCalledOnce();
  });

  it("does not open playback consent when the runtime grant is denied", async () => {
    permissionHarness.permissionResult = "denied";

    await expect(requestCapturePermission("device_playback")).resolves.toBe(false);
    expect(permissionHarness.requestDevicePlaybackPermission).not.toHaveBeenCalled();
  });

  it("reports Phone audio as unavailable outside Android", async () => {
    permissionHarness.platform.OS = "ios";

    await expect(requestCapturePermission("device_playback")).resolves.toBe(false);
    expect(permissionHarness.requestPermission).not.toHaveBeenCalled();
    expect(permissionHarness.requestDevicePlaybackPermission).not.toHaveBeenCalled();
  });
});

describe("createWorkerSession", () => {
  async function expectDeadline(fetchResponse: () => Promise<Response>): Promise<void> {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return fetchResponse();
    }));

    const pending = createWorkerSession(request);
    await vi.advanceTimersByTimeAsync(workerSessionRequestTimeoutMs);

    await expect(pending).resolves.toEqual({ error: "worker_session_network_error" });
    expect(requestSignal?.aborted).toBe(true);
  }

  it("aborts a session request that does not settle before the connection deadline", async () => {
    await expectDeadline(() => new Promise<Response>(() => undefined));
  });

  it("keeps the deadline active while reading a stalled response body", async () => {
    await expectDeadline(async () => new Response(new ReadableStream({ start: () => undefined })));
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

    await expect(createWorkerSession({ ...request, playback_enabled: false })).resolves.toEqual(payload);
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(fetchCall?.[1]?.body))).toMatchObject({ playback_enabled: false });
  });

  it("sends the playback preference and app release the worker gates on", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ error: "app_version_unsupported" }, { status: 426 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createWorkerSession(request)).resolves.toEqual({ error: "app_version_unsupported" });
    const body: unknown = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      app_platform: "android",
      app_version: "1.2.3",
      playback_enabled: true,
    });
  });
});

describe("hasSourceTranscript", () => {
  const session = {
    app_session_id: "session_1",
    features: { source_transcript: false },
    limits: { expires_at_ms: 20_000, max_session_seconds: 300 },
    realtime_ws_url: "wss://worker.example.test/realtime",
    session_epoch: 1,
  };

  it("follows the worker's source transcript flag", () => {
    expect(hasSourceTranscript(session)).toBe(false);
    expect(hasSourceTranscript({ ...session, features: { source_transcript: true } })).toBe(true);
  });

  it("keeps the source transcript for workers that predate the flag", () => {
    const { features: _features, ...olderWorkerSession } = session;
    expect(hasSourceTranscript(olderWorkerSession)).toBe(true);
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

  it.each([401, 500])("throws when the stop response is HTTP %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));

    await expect(closeWorkerSession("session_1", "stop"))
      .rejects.toThrow(`worker_session_stop_http_${status}`);
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
