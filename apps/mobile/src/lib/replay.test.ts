import { describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  construct: vi.fn(),
  optIn: vi.fn(async () => undefined),
  optOut: vi.fn(async () => undefined),
  stopSessionRecording: vi.fn(async () => undefined),
}));

vi.mock("react-native", () => ({ Platform: { OS: "android", Version: 30 } }));
vi.mock("@sentry/react-native", () => ({ captureException: vi.fn() }));
vi.mock("posthog-react-native", () => ({
  default: class {
    constructor(token: string, options: unknown) { sdk.construct(token, options); }
    optIn = sdk.optIn;
    optOut = sdk.optOut;
    stopSessionRecording = sdk.stopSessionRecording;
  },
}));
vi.mock("./anonymousAnalytics", () => ({
  getAnonymousAnalyticsEnabled: vi.fn(async () => true),
}));

import { initializeReplay, setReplayAnalyticsEnabled } from "./replay";

describe("session replay", () => {
  it("masks content, disables duplicate automatic events, and opts out on analytics opt-out", async () => {
    process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    const client = await initializeReplay();
    expect(client).not.toBeNull();
    expect(sdk.construct).toHaveBeenCalledWith("phc_test", expect.objectContaining({
      captureAppLifecycleEvents: false,
      enableSessionReplay: true,
      sessionReplayConfig: expect.objectContaining({
        maskAllTextInputs: true,
        captureLog: false,
        captureNetworkTelemetry: false,
      }),
    }));
    await setReplayAnalyticsEnabled(false);
    expect(sdk.stopSessionRecording).toHaveBeenCalledOnce();
    expect(sdk.optOut).toHaveBeenCalledOnce();
    delete process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN;
  });
});
