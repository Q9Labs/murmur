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
const release = vi.hoisted(() => ({ app_platform: "android", app_version: "1.2.3" }));
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
vi.mock("react-native", () => ({ AppState: { currentState: "active" } }));
vi.mock("../appRelease", () => ({
  getAppRelease: () => release,
}));
vi.mock("../installIdentity", () => installIdentity);
vi.mock("./nativeProviders", () => nativeProviders);

import { recordStorageFailure, getStorageFailureDiagnostics } from "../storageDiagnostics";
import { SecureStorageFailure } from "../secureStorage";
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
  release.app_platform = "android";
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
  it("propagates the typed storage failure with its diagnostics marker", async () => {
    const failure = new SecureStorageFailure("read_async");
    recordStorageFailure(failure, {
      appState: "active",
      key: "murmur_install_id",
      step: "read_async",
    });
    installIdentity.getOrCreateInstallId.mockRejectedValueOnce(failure);
    // The real onRequest hook awaits the identity read; the marked wrapper is
    // what failureCopy localizes.
    await expect(auth.requestHook({ headers: new Headers() })).rejects.toBe(failure);
    expect(getStorageFailureDiagnostics(failure)).toBeTruthy();
  });

  it("message-only envelope copies carry safe readable storage text", async () => {
    // The only storage text that can reach a message-only copy is the
    // wrapper's safe generic message — readable, never SDK internals.
    auth.getSession.mockResolvedValueOnce({ data: null });
    auth.signInAnonymous.mockResolvedValueOnce({
      error: { message: "Murmur couldn't access saved data. Try again." },
    });
    let thrown: unknown;
    try {
      await authenticatedWorkerHeaders();
    } catch (failure) {
      thrown = failure;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("Murmur couldn't access saved data. Try again.");
    expect((thrown as Error).message).not.toMatch(/FunctionCallException|KeyChain|secure_storage/);
  });

  it("a message-only copy of a storage wrapper stays safe and readable", () => {
    // Mirrors the `new Error(created.error.message)` rewrap: what lands on
    // screen must be the readable sentence, not a technical code.
    const copy = new Error(new SecureStorageFailure("read_async").message);
    expect(copy.message).toBe("Murmur couldn't access saved data. Try again.");
    expect(copy.message).not.toMatch(/FunctionCallException|KeyChain|secure_storage/);
  });

  it("keeps readable anonymous sign-in errors as-is", async () => {
    auth.getSession.mockResolvedValueOnce({ data: null });
    auth.signInAnonymous.mockResolvedValueOnce({ error: { message: "Too many requests" } });
    await expect(authenticatedWorkerHeaders()).rejects.toThrow("Too many requests");
  });
  it("passes install and release targeting through the auth request hook", async () => {
    const headers = new Headers();
    await auth.requestHook({ headers });

    expect(headers.get("origin")).toBe("murmur://");
    expect(headers.get("x-murmur-free-allowance-id")).toBe("free_test_123");
    expect(headers.get("x-murmur-install-id")).toBe("install_test_123");
    expect(headers.get("x-murmur-app-platform")).toBe("android");
    expect(headers.get("x-murmur-app-version")).toBe("1.2.3");
  });

  it.each(["ios", "android"])("supplies the trusted origin for native %s sign-in", async (platform) => {
    release.app_platform = platform;
    const headers = new Headers({ cookie: "murmur.session=guest" });
    await auth.requestHook({ headers });
    expect(headers.get("origin")).toBe("murmur://");
    expect(headers.get("cookie")).toBe("murmur.session=guest");
  });

  it("leaves browser origin handling to the browser", async () => {
    release.app_platform = "web";
    const headers = new Headers();
    await auth.requestHook({ headers });
    expect(headers.has("origin")).toBe(false);
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

  it("treats a server-side anonymous session as an existing guest session", async () => {
    auth.getSession
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { user: { id: "guest-1", isAnonymous: true } } });
    auth.signInAnonymous.mockResolvedValue({
      error: {
        code: "ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY",
        message: "Anonymous users cannot sign in anonymously again.",
      },
    });

    const headers = await authenticatedWorkerHeaders();

    expect(headers.get("cookie")).toBe("murmur.session=test-cookie");
    expect(auth.getSession).toHaveBeenCalledTimes(2);
    expect(auth.signInAnonymous).toHaveBeenCalledOnce();
  });

  it("does not probe a session for an unrelated error quoting the anonymous code", async () => {
    auth.getSession.mockResolvedValue({ data: null });
    auth.signInAnonymous.mockResolvedValue({
      error: {
        code: "INVALID_TOKEN",
        message: "Wrapped failure: ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY",
      },
    });

    await expect(authenticatedWorkerHeaders()).rejects.toThrow(
      "Wrapped failure: ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY",
    );
    expect(auth.getSession).toHaveBeenCalledTimes(1);
  });

  it("still surfaces account failure when no session remains after anonymous sign-in", async () => {
    auth.getSession.mockResolvedValue({ data: null });
    auth.signInAnonymous.mockResolvedValue({
      error: {
        code: "ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY",
        message: "Anonymous users cannot sign in anonymously again.",
      },
    });

    await expect(authenticatedWorkerHeaders()).rejects.toThrow(
      "Anonymous users cannot sign in anonymously again.",
    );
    expect(auth.getSession).toHaveBeenCalledTimes(2);
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
