import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildBackendUrl,
  getMurmurApiBaseUrl,
  normalizeApiBaseUrl,
  requestDeepgramAuthToken,
} from "./backend";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("backend URL helpers", () => {
  it("normalizes configured backend URLs", () => {
    vi.stubEnv("EXPO_PUBLIC_MURMUR_API_BASE_URL", " https://api.example.test/// ");

    expect(getMurmurApiBaseUrl()).toBe("https://api.example.test");
    expect(buildBackendUrl("https://api.example.test/", "deepgram/token")).toBe(
      "https://api.example.test/deepgram/token",
    );
  });

  it("rejects empty or unsupported backend URLs", () => {
    expect(() => normalizeApiBaseUrl("")).toThrow("Murmur backend URL is required");
    expect(() => normalizeApiBaseUrl("ftp://api.example.test")).toThrow(
      "Murmur backend URL must use http or https",
    );
  });
});

describe("requestDeepgramAuthToken", () => {
  it("accepts token variants from the backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ access_token: "dg_token" }))),
    );

    await expect(requestDeepgramAuthToken("https://api.example.test")).resolves.toBe("dg_token");
    expect(fetch).toHaveBeenCalledWith("https://api.example.test/deepgram/token", {
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });

  it("fails closed when the backend does not return a usable token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ token: "" }))));

    await expect(requestDeepgramAuthToken("https://api.example.test")).rejects.toThrow(
      "Murmur backend did not return a Deepgram auth token",
    );
  });
});
