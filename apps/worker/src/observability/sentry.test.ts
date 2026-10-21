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


it.each(["PRIVATE_TOKEN", "503 PRIVATE_BODY", "099", "600", "503.0", 503, null])(
  "drops untrusted attribution status %s and all extra tags", (status) => {
    const event = sanitizeWorkerEvent({ type: undefined, tags: {
      failure_code: "attribution.apple_http_failed", upstream_status: status,
      operation: "PRIVATE_OPERATION", token: "PRIVATE_TOKEN", failure_step: "PRIVATE_STEP",
    } });
    expect(event.tags).toEqual({ failure_code: "attribution.apple_http_failed", operation: "apple_attribution_request" });
    expect(JSON.stringify(event)).not.toContain("PRIVATE");
  },
);

it("does not attach an Apple status to unrelated failures", () => {
  expect(sanitizeWorkerEvent({ type: undefined, tags: {
    failure_code: "worker.request_failed", upstream_status: "503", operation: "capture_install_attribution",
  } }).tags).toEqual({ failure_code: "worker.request_failed", operation: "http_request" });
});


it("keeps only bounded realtime billing cause fields after Sentry scrubbing", () => {
  const event = sanitizeWorkerEvent({ type: undefined, message: "PRIVATE_ERROR", tags: {
    failure_code: "billing.realtime_unavailable", billing_failure_operation: "periodic_settlement",
    billing_failure_stage: "ledger_result", billing_failure_code: "usage_session_closed", billing_failure_status: "409",
    account: "PRIVATE_ACCOUNT", balance: "PRIVATE_BALANCE",
  } });
  expect(event.tags).toEqual({ failure_code: "billing.realtime_unavailable", operation: "realtime_billing",
    billing_failure_operation: "periodic_settlement", billing_failure_stage: "ledger_result",
    billing_failure_code: "usage_session_closed", billing_failure_status: "409" });
  expect(JSON.stringify(event)).not.toContain("PRIVATE");
});

it.each(["PRIVATE", "503 PRIVATE", "099", "600", "503.0", 503, null])("drops untrusted billing fields %s", (value) => {
  const event = sanitizeWorkerEvent({ type: undefined, tags: { failure_code: "billing.realtime_unavailable",
    billing_failure_operation: value, billing_failure_stage: value, billing_failure_code: value, billing_failure_status: value } });
  expect(event.tags).toEqual({ failure_code: "billing.realtime_unavailable", operation: "realtime_billing" });
});

it("does not attach billing fields to other failures", () => {
  expect(sanitizeWorkerEvent({ type: undefined, tags: { failure_code: "worker.request_failed",
    billing_failure_operation: "audio_decode", billing_failure_status: "503" } }).tags)
    .toEqual({ failure_code: "worker.request_failed", operation: "http_request" });
});
