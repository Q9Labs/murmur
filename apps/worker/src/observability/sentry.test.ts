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
    expect(event.message).toBe("worker_operation_failed");
    expect(event.request).toEqual({ method: "GET", url: "https://murmur.test/v1/realtime" });
    expect(event.user).toBeUndefined();
    expect(event.exception?.values?.[0]?.value).toBe("worker_operation_failed");
    expect(JSON.stringify(event)).not.toContain("private");
    expect(JSON.stringify(event)).not.toContain("secret");
  });
});
