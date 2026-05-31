import {
  getMurmurApiBaseUrl,
  requestDeepgramAuthToken,
} from "@/services/backend";

describe("backend service plumbing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_MURMUR_API_BASE_URL;
    global.fetch = jest.fn();
  });

  it("uses only the public Murmur backend URL from Expo config", async () => {
    process.env.EXPO_PUBLIC_MURMUR_API_BASE_URL =
      "https://api.murmur.test/";

    expect(getMurmurApiBaseUrl()).toBe("https://api.murmur.test");
  });

  it("fails closed when the Murmur backend URL is missing", () => {
    expect(getMurmurApiBaseUrl()).toBeNull();
  });

  it("requests a Deepgram auth token from the backend", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ token: "scoped-token" }),
    });

    const token = await requestDeepgramAuthToken("https://api.murmur.test/");

    expect(token).toBe("scoped-token");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.murmur.test/deepgram/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  });
});
