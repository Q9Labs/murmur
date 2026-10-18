import { describe, expect, it } from "vitest";

import { getSentryOptions, sanitizeWorkerEvent } from "./sentry";

describe("Worker Sentry privacy controls", () => {
  it("disables content collection at the integration boundary", () => {
    expect(getSentryOptions({ SENTRY_DSN: "https://public@example.ingest.sentry.io/1" })).toMatchObject({
      dataCollection: {
        cookies: false,
        databaseQueryData: false,
        genAI: { inputs: false, outputs: false },
        graphQL: { document: false, variables: false },
        httpBodies: [],
        stackFrameVariables: false,
        urlQueryParams: false,
        userInfo: false,
      },
    });
  });

  it.each(["caption.retry_failed", "caption.recovery_exhausted"])("preserves %s without retaining content", (code) => {
    const event = sanitizeWorkerEvent({ type: undefined, message: "private caption", tags: { failure_code: code, transcript: "private caption" }, extra: { audio: "secret" } });
    expect(event.tags?.failure_code).toBe(code);
    expect(event.tags?.operation).toBe("caption_recovery");
    expect(event.message).not.toBe("Worker request did not complete");
    expect(JSON.stringify(event)).not.toContain("private");
    expect(JSON.stringify(event)).not.toContain("secret");
  });

  it("strips query strings, metadata, and exception messages", () => {
    const event = sanitizeWorkerEvent({
      breadcrumbs: [{ message: "private caption", timestamp: 1 }],
      exception: {
        values: [{ type: "ProviderError", value: "private transcript" }],
      },
      extra: { transcript: "private transcript" },
      message: "private transcript",
      request: {
        data: "private audio",
        headers: { authorization: "secret" },
        method: "GET",
        query_string: "token=secret",
        url: "https://murmur.test/v1/realtime?token=secret",
      },
      user: { id: "raw-install-id" },
      type: undefined,
    });

    expect(event.breadcrumbs).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.message).toBe("Worker request did not complete");
    expect(event.request).toBeUndefined();
    expect(event.user).toBeUndefined();
    expect(event.exception?.values?.[0]?.value).toBe("Worker request did not complete");
    expect(JSON.stringify(event)).not.toContain("private");
    expect(JSON.stringify(event)).not.toContain("secret");
  });
});
