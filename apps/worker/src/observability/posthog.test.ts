import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/cloudflare", () => sentry);

import { queuePostHogEvent } from "./posthog";

const fetchMock = vi.fn<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>();
const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

describe("PostHog delivery", () => {
  it("sends only the allowlisted event and privacy controls to PostHog US", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));

    queuePostHogEvent({
      context: { waitUntil },
      distinct_id: "anonymous_install_hashed",
      env: { MURMUR_ENV: "production", POSTHOG_PROJECT_TOKEN: "phc_test" },
      payload: {
        app_session_id: "session-12345678",
        event: "worker_first_translation",
        provider_elapsed_ms: 350,
        worker_elapsed_ms: 410,
      },
    });
    await waitUntil.mock.calls[0]?.[0];

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://us.i.posthog.com/i/v0/e/");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      api_key: "phc_test",
      event: "worker_first_translation",
      properties: {
        $geoip_disable: true,
        $ip: null,
        $process_person_profile: false,
        component: "worker",
        distinct_id: "anonymous_install_hashed",
        environment: "production",
        product: "murmur",
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/audio|caption|conversation|transcript/);
  });

  it("reports delivery failures without rejecting the Worker response path", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    queuePostHogEvent({
      context: { waitUntil },
      distinct_id: "anonymous_install_hashed",
      env: { POSTHOG_PROJECT_TOKEN: "phc_test" },
      payload: {
        app_session_id: "session-12345678",
        event: "worker_first_translation",
        provider_elapsed_ms: null,
        worker_elapsed_ms: 410,
      },
    });
    await waitUntil.mock.calls[0]?.[0];

    expect(sentry.captureException).toHaveBeenCalledOnce();
  });
});
