import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/react-native", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  init: vi.fn(),
}));

import { sanitizeMobileEvent } from "./sentry";

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
