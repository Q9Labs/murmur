import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ OS: "ios" }));
const apple = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(),
  signInAsync: vi.fn(),
}));
const google = vi.hoisted(() => ({
  configure: vi.fn(),
  hasPlayServices: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "nonce-123" }));
vi.mock("expo-apple-authentication", () => ({
  ...apple,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
vi.mock("@react-native-google-signin/google-signin", () => ({ GoogleSignin: google }));

import { getAppleIdentity, getGoogleIdentity } from "./nativeProviders";

beforeEach(() => {
  vi.clearAllMocks();
  platform.OS = "ios";
  apple.isAvailableAsync.mockResolvedValue(true);
  apple.signInAsync.mockResolvedValue({
    identityToken: "apple-id-token",
    fullName: { givenName: "A", familyName: "B" },
  });
  google.signIn.mockResolvedValue({ type: "success", data: { idToken: "google-id-token" } });
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "web-client-id";
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "ios-client-id";
});

describe("native provider identity", () => {
  it("passes an Apple nonce and name with the token", async () => {
    await expect(getAppleIdentity()).resolves.toEqual({
      token: "apple-id-token",
      nonce: "nonce-123",
      user: { name: { firstName: "A", lastName: "B" } },
    });
    expect(apple.signInAsync).toHaveBeenCalledWith({ nonce: "nonce-123", requestedScopes: [0, 1] });
  });

  it("configures Google for the server audience on both platforms", async () => {
    await expect(getGoogleIdentity()).resolves.toBe("google-id-token");
    expect(google.configure).toHaveBeenCalledWith({
      webClientId: "web-client-id",
      iosClientId: "ios-client-id",
    });
    platform.OS = "android";
    await getGoogleIdentity();
    expect(google.hasPlayServices).toHaveBeenCalledOnce();
  });

  it("returns no identity when Google sign-in is cancelled", async () => {
    google.signIn.mockResolvedValue({ type: "cancelled", data: null });
    await expect(getGoogleIdentity()).resolves.toBeNull();
  });

  it("keeps a cancelled Apple request out of the auth flow", async () => {
    apple.signInAsync.mockRejectedValue(Object.assign(new Error("cancelled"), {
      code: "ERR_REQUEST_CANCELED",
    }));
    await expect(getAppleIdentity()).resolves.toBeNull();
  });

  it("rejects a provider response without an ID token", async () => {
    google.signIn.mockResolvedValue({ type: "success", data: { idToken: null } });
    await expect(getGoogleIdentity()).rejects.toThrow("Google did not return a sign-in token");
  });
});
