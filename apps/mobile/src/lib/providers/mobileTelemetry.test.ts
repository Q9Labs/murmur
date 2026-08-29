import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({ getWorkerBaseUrl: () => "https://murmur.test" }));

import { deliverMobileTelemetryRequest } from "./mobileTelemetry";

const fetchMock = vi.fn<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

describe("mobile telemetry provider", () => {
  it("delivers the closed telemetry request to the Worker", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));

    await deliverMobileTelemetryRequest({
      app_install_id: "install-id-123456",
      payload: {
        app_version: "1.2.0",
        build_number: "10",
        event: "mobile_app_opened",
        platform: "ios",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith("https://murmur.test/v1/telemetry", {
      body: JSON.stringify({
        app_install_id: "install-id-123456",
        payload: {
          app_version: "1.2.0",
          build_number: "10",
          event: "mobile_app_opened",
          platform: "ios",
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });

  it("propagates a content-free status code when delivery fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(
      deliverMobileTelemetryRequest({
        app_install_id: "install-id-123456",
        payload: {
          app_version: "1.2.0",
          build_number: "10",
          event: "mobile_app_opened",
          platform: "ios",
        },
      }),
    ).rejects.toThrow("mobile_telemetry_http_503");
  });
});
