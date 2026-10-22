import type { ErrorEvent } from "@sentry/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import nativeState from "../../../../../tooling/ios-capture/tests/capture-failure.json";
import sessionStates from "../../../../../tooling/ios-capture/tests/session-failures.json";

const sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn(), init: vi.fn() }));
vi.mock("@sentry/react-native", () => sentry);

import { sanitizeMobileEvent } from "../observability/sentry";

import { getDevicePlaybackCaptureError, startAudioCapture } from "./captureLifecycle";

const delivered: ErrorEvent[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  delivered.length = 0;
  sentry.captureException.mockImplementation((_failure: unknown, options: ErrorEvent) => {
    delivered.push(sanitizeMobileEvent({
      ...options,
      type: undefined,
      exception: { values: [{ value: "private native message" }] },
      extra: { transcript: "private speech" },
    }));
  });
});

describe("Device Audio lifecycle", () => {
  it("maps projection revocation separately from unexpected service stops", () => {
    expect(getDevicePlaybackCaptureError("device_playback_capture_revoked"))
      .toBe("device_playback_capture_revoked");
    expect(getDevicePlaybackCaptureError("capture_read_failed"))
      .toBe("device_playback_capture_stopped");
    expect(getDevicePlaybackCaptureError("service_destroy"))
      .toBe("device_playback_capture_stopped");
  });

  it("ignores expected user and session stop reasons", () => {
    expect(getDevicePlaybackCaptureError("user_stop")).toBeNull();
    expect(getDevicePlaybackCaptureError("session_complete")).toBeNull();
    expect(getDevicePlaybackCaptureError("notification_stop")).toBeNull();
  });
});

describe("capture startup reporting through the privacy sanitizer", () => {
  it("delivers the serialized native state without forwarding its raw content", async () => {
    const failure = new Error("private native message");
    const audio = {
      startCapture: vi.fn().mockRejectedValue(failure),
      getAudioState: vi.fn().mockResolvedValue({ ...nativeState, capture_failure: {
        ...nativeState.capture_failure, port_name: "private device", transcript: "private speech",
      } }),
    };
    await expect(startAudioCapture({ audio, source: "microphone", maxSessionSeconds: 60, appSessionId: "session-1" }))
      .rejects.toBe(failure);
    expect(audio.startCapture).toHaveBeenCalledWith("microphone", 60);
    expect(audio.getAudioState).toHaveBeenCalledOnce();
    expect(delivered[0]?.contexts?.audio_capture).toEqual(nativeState.capture_failure);
    expect(delivered[0]?.tags?.operation).toBe("start_microphone_capture");
    expect(delivered[0]?.exception?.values?.[0]?.value).toBe("mobile_operation_failed");
    expect(JSON.stringify(delivered)).not.toContain("private");
  });

  it("reports the original failure even when reading state fails", async () => {
    const failure = new Error("private");
    await expect(startAudioCapture({
      audio: { startCapture: vi.fn().mockRejectedValue(failure), getAudioState: vi.fn().mockRejectedValue(new Error("state read")) },
      source: "microphone", maxSessionSeconds: 60, appSessionId: "session-1",
    })).rejects.toBe(failure);
    expect(sentry.captureException).toHaveBeenCalledOnce();
    expect(delivered[0]?.contexts?.audio_capture).toBeUndefined();
  });

  it("does not read stale diagnostics or report when capture starts", async () => {
    const audio = { startCapture: vi.fn().mockResolvedValue({}), getAudioState: vi.fn() };
    await startAudioCapture({ audio, source: "microphone", maxSessionSeconds: 60, appSessionId: "session-1" });
    expect(audio.getAudioState).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("rejects malicious native fields before the reporting call", async () => {
    await expect(startAudioCapture({
      audio: { startCapture: vi.fn().mockRejectedValue(new Error("private")), getAudioState: vi.fn().mockResolvedValue({
        capture_failure: { ...nativeState.capture_failure, route: "private device", step: "private speech" },
      }) },
      source: "microphone", maxSessionSeconds: 60, appSessionId: "session-1",
    })).rejects.toThrow();
    expect(delivered[0]?.contexts?.audio_capture).toBeUndefined();
    expect(JSON.stringify(delivered)).not.toContain("private");
  });
});

describe("session setup failures through the privacy sanitizer", () => {
  it.each(sessionStates)("reports the native session step: $capture_failure.step", async (state) => {
    const failure = new Error("private platform error");
    const audio = {
      startCapture: vi.fn().mockRejectedValue(failure),
      getAudioState: vi.fn().mockResolvedValue(state),
    };
    await expect(startAudioCapture({ audio, source: "microphone", maxSessionSeconds: 60, appSessionId: "session-1" }))
      .rejects.toBe(failure);
    expect(delivered[0]?.contexts?.audio_capture).toEqual(state.capture_failure);
    expect(delivered[0]?.exception?.values?.[0]?.value).toBe("mobile_operation_failed");
    expect(JSON.stringify(delivered)).not.toContain("private");
  });
});
