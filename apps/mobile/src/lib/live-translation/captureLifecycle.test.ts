import { describe, expect, it } from "vitest";

import { getDevicePlaybackCaptureError } from "./captureLifecycle";

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
