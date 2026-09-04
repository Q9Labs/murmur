import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  init: vi.fn(),
}));

vi.mock("@sentry/react-native", () => sentry);

import { captureMobileFailure, sanitizeMobileEvent } from "./sentry";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mobile Sentry failure grouping", () => {
  it("groups failures by operation, stage, and a safe native error code", () => {
    const failure = new Error("private native message");
    Object.assign(failure, { code: "ERR_AUDIO_CAPTURE" });

    captureMobileFailure(failure, {
      app_session_id: "session-1",
      operation: "start_microphone_capture",
      stage: "audio_capture",
    });

    expect(sentry.captureException).toHaveBeenCalledWith(failure, {
      fingerprint: ["start_microphone_capture", "audio_capture", "ERR_AUDIO_CAPTURE"],
      tags: {
        app_session_id: "session-1",
        error_code: "ERR_AUDIO_CAPTURE",
        operation: "start_microphone_capture",
        stage: "audio_capture",
      },
    });
  });

  it("does not use arbitrary native error content as a tag or fingerprint", () => {
    const failure = new Error("private native message");
    Object.assign(failure, { code: "private user content with spaces" });

    captureMobileFailure(failure, { operation: "read_audio_state" });

    expect(sentry.captureException).toHaveBeenCalledWith(failure, {
      fingerprint: ["read_audio_state", "unknown", "none"],
      tags: {
        app_session_id: "none",
        error_code: "none",
        operation: "read_audio_state",
        stage: "unknown",
      },
    });
  });
});

describe("mobile Sentry privacy sanitizer", () => {
  it("removes content-bearing contexts and exception messages", () => {
    const event = sanitizeMobileEvent({
      breadcrumbs: [{ message: "private caption", timestamp: 1 }],
      exception: {
        values: [{ type: "ProviderError", value: "private transcript" }],
      },
      extra: { transcript: "private transcript" },
      message: "private transcript",
      request: { data: "private audio" },
      type: undefined,
      user: { id: "raw-install-id" },
    });

    expect(event.breadcrumbs).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.message).toBe("mobile_operation_failed");
    expect(event.request).toBeUndefined();
    expect(event.user).toBeUndefined();
    expect(event.exception?.values?.[0]?.value).toBe("mobile_operation_failed");
    expect(JSON.stringify(event)).not.toContain("private");
    expect(JSON.stringify(event)).not.toContain("raw-install-id");
  });
});
