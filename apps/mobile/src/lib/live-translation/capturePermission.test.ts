import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  permissionResult: "granted",
  platform: { OS: "android" },
  requestDevicePlaybackPermission: vi.fn(async () => true),
  requestMicrophonePermission: vi.fn(async () => true),
  requestPermission: vi.fn(async () => "granted"),
}));

vi.mock("react-native", () => ({
  PermissionsAndroid: {
    PERMISSIONS: { RECORD_AUDIO: "android.permission.RECORD_AUDIO" },
    RESULTS: { GRANTED: "granted" },
    request: harness.requestPermission,
  },
  Platform: harness.platform,
}));

vi.mock("../../../modules/murmur-audio", () => ({
  default: {
    requestDevicePlaybackPermission: harness.requestDevicePlaybackPermission,
    requestMicrophonePermission: harness.requestMicrophonePermission,
  },
}));

import { requestCapturePermission } from "./workerApi";

beforeEach(() => {
  harness.platform.OS = "android";
  harness.requestPermission.mockReset().mockImplementation(async () => harness.permissionResult);
  harness.requestDevicePlaybackPermission.mockReset().mockResolvedValue(true);
  harness.requestMicrophonePermission.mockReset().mockResolvedValue(true);
  harness.permissionResult = "granted";
});

describe("capture permission routing", () => {
  it("uses Android audio recording permission for microphone capture", async () => {
    await expect(requestCapturePermission("microphone")).resolves.toBe(true);

    expect(harness.requestPermission).toHaveBeenCalledWith("android.permission.RECORD_AUDIO");
    expect(harness.requestDevicePlaybackPermission).not.toHaveBeenCalled();
  });

  it("opens Android playback consent only after the runtime grant", async () => {
    await expect(requestCapturePermission("device_playback")).resolves.toBe(true);

    expect(harness.requestPermission).toHaveBeenCalledWith("android.permission.RECORD_AUDIO");
    expect(harness.requestDevicePlaybackPermission).toHaveBeenCalledOnce();
  });

  it("does not open playback consent when the runtime grant is denied", async () => {
    harness.permissionResult = "denied";

    await expect(requestCapturePermission("device_playback")).resolves.toBe(false);
    expect(harness.requestDevicePlaybackPermission).not.toHaveBeenCalled();
  });

  it("reports Device Audio as unavailable outside Android", async () => {
    harness.platform.OS = "ios";

    await expect(requestCapturePermission("device_playback")).resolves.toBe(false);
    expect(harness.requestPermission).not.toHaveBeenCalled();
    expect(harness.requestDevicePlaybackPermission).not.toHaveBeenCalled();
  });
});
