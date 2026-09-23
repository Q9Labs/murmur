import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  getCookie: vi.fn(),
  getSession: vi.fn(),
  requestHook: vi.fn(),
  signInAnonymous: vi.fn(),
  signInEmailOtp: vi.fn(),
  signInSocial: vi.fn(),
  sendVerificationOtp: vi.fn(),
}));
const installIdentity = vi.hoisted(() => ({
  getOrCreateFreeAllowanceId: vi.fn(),
  getOrCreateInstallId: vi.fn(),
}));
const nativeProviders = vi.hoisted(() => ({
  getAppleIdentity: vi.fn(),
  getGoogleIdentity: vi.fn(),
}));

vi.mock("@better-auth/expo/client", () => ({ expoClient: vi.fn(() => ({})) }));
vi.mock("better-auth/client/plugins", () => ({
  anonymousClient: vi.fn(() => ({})),
  emailOTPClient: vi.fn(() => ({})),
}));
vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn((options: {
    fetchOptions: { onRequest: (context: { headers: Headers }) => Promise<unknown> };
  }) => {
    auth.requestHook.mockImplementation(options.fetchOptions.onRequest);
    return {
      deleteUser: auth.deleteUser,
      emailOtp: { sendVerificationOtp: auth.sendVerificationOtp },
      getCookie: auth.getCookie,
      getSession: auth.getSession,
      signIn: {
        anonymous: auth.signInAnonymous,
        emailOtp: auth.signInEmailOtp,
        social: auth.signInSocial,
      },
    };
  }),
}));
vi.mock("expo-secure-store", () => ({}));
vi.mock("../appRelease", () => ({
  getAppRelease: () => ({ app_platform: "android", app_version: "1.2.3" }),
}));
vi.mock("../installIdentity", () => installIdentity);
vi.mock("./nativeProviders", () => nativeProviders);

import {
  authenticatedWorkerHeaders,
  deleteMurmurAccount,
  sendEmailSignInCode,
  signInWithApple,
  signInWithGoogle,
  verifyEmailSignInCode,
} from "./client";

beforeEach(() => {
  vi.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { user: { id: "customer-1" } } });
  auth.getCookie.mockResolvedValue("murmur.session=test-cookie");
  auth.signInAnonymous.mockResolvedValue({ error: null });
  auth.sendVerificationOtp.mockResolvedValue({ error: null });
  auth.signInEmailOtp.mockResolvedValue({ error: null });
  auth.signInSocial.mockResolvedValue({ error: null });
  auth.deleteUser.mockResolvedValue({ error: null });
  installIdentity.getOrCreateFreeAllowanceId.mockResolvedValue("free_test_123");
  installIdentity.getOrCreateInstallId.mockResolvedValue("install_test_123");
  nativeProviders.getAppleIdentity.mockResolvedValue({ token: "apple-token", nonce: "nonce-1" });
  nativeProviders.getGoogleIdentity.mockResolvedValue("google-token");
});

describe("mobile Murmur authentication client", () => {
  it("passes install and release targeting through the auth request hook", async () => {
    const headers = new Headers();
    await auth.requestHook({ headers });

    expect(headers.get("x-murmur-free-allowance-id")).toBe("free_test_123");
    expect(headers.get("x-murmur-install-id")).toBe("install_test_123");
    expect(headers.get("x-murmur-app-platform")).toBe("android");
    expect(headers.get("x-murmur-app-version")).toBe("1.2.3");
  });

  it("adds the durable account cookie to Worker requests", async () => {
    const headers = await authenticatedWorkerHeaders({ "x-test": "value" });

    expect(headers.get("cookie")).toBe("murmur.session=test-cookie");
    expect(headers.get("x-murmur-free-allowance-id")).toBe("free_test_123");
    expect(headers.get("x-test")).toBe("value");
    expect(auth.signInAnonymous).not.toHaveBeenCalled();
  });

  it("shares one guest creation across concurrent cold-start requests", async () => {
    auth.getSession.mockResolvedValue({ data: null });
    let finishCreation = (): void => undefined;
    auth.signInAnonymous.mockImplementation(() => new Promise((resolve) => {
      finishCreation = () => resolve({ error: null });
    }));

    const firstRequest = authenticatedWorkerHeaders();
    const secondRequest = authenticatedWorkerHeaders();
    await vi.waitFor(() => expect(auth.signInAnonymous).toHaveBeenCalledOnce());
    finishCreation();
    await Promise.all([firstRequest, secondRequest]);

    expect(auth.signInAnonymous).toHaveBeenCalledOnce();
  });

  it("creates a guest session before reading its cookie", async () => {
    auth.getSession.mockResolvedValue({ data: null });

    await authenticatedWorkerHeaders();

    expect(auth.signInAnonymous).toHaveBeenCalledOnce();
    expect(auth.getCookie).toHaveBeenCalledOnce();
  });

  it("delegates recovery and deletion to Better Auth", async () => {
    await sendEmailSignInCode("person@example.com");
    await verifyEmailSignInCode("person@example.com", "123456");
    await deleteMurmurAccount();

    expect(auth.sendVerificationOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      type: "sign-in",
    });
    expect(auth.signInEmailOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      otp: "123456",
    });
    expect(auth.deleteUser).toHaveBeenCalledOnce();
  });

  it("passes native ID tokens and the guest cookie to Better Auth for linking", async () => {
    await signInWithApple();
    await signInWithGoogle();

    expect(auth.signInSocial).toHaveBeenNthCalledWith(1, {
      provider: "apple",
      idToken: { token: "apple-token", nonce: "nonce-1", user: undefined },
    }, { headers: { cookie: "murmur.session=test-cookie" } });
    expect(auth.signInSocial).toHaveBeenNthCalledWith(2, {
      provider: "google",
      idToken: { token: "google-token" },
    }, { headers: { cookie: "murmur.session=test-cookie" } });
  });

  it("does not change the account when native sign-in is cancelled", async () => {
    nativeProviders.getAppleIdentity.mockResolvedValue(null);
    nativeProviders.getGoogleIdentity.mockResolvedValue(null);

    await expect(signInWithApple()).resolves.toBe(false);
    await expect(signInWithGoogle()).resolves.toBe(false);
    expect(auth.signInSocial).not.toHaveBeenCalled();
  });
});
