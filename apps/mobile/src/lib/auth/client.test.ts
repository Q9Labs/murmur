import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  getCookie: vi.fn(),
  getSession: vi.fn(),
  signInAnonymous: vi.fn(),
  signInEmailOtp: vi.fn(),
  sendVerificationOtp: vi.fn(),
}));

vi.mock("@better-auth/expo/client", () => ({ expoClient: vi.fn(() => ({})) }));
vi.mock("better-auth/client/plugins", () => ({
  anonymousClient: vi.fn(() => ({})),
  emailOTPClient: vi.fn(() => ({})),
}));
vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn(() => ({
    deleteUser: auth.deleteUser,
    emailOtp: { sendVerificationOtp: auth.sendVerificationOtp },
    getCookie: auth.getCookie,
    getSession: auth.getSession,
    signIn: {
      anonymous: auth.signInAnonymous,
      emailOtp: auth.signInEmailOtp,
    },
  })),
}));
vi.mock("expo-secure-store", () => ({}));

import {
  authenticatedWorkerHeaders,
  deleteMurmurAccount,
  sendEmailSignInCode,
  verifyEmailSignInCode,
} from "./client";

beforeEach(() => {
  vi.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { user: { id: "customer-1" } } });
  auth.getCookie.mockResolvedValue("murmur.session=test-cookie");
  auth.signInAnonymous.mockResolvedValue({ error: null });
  auth.sendVerificationOtp.mockResolvedValue({ error: null });
  auth.signInEmailOtp.mockResolvedValue({ error: null });
  auth.deleteUser.mockResolvedValue({ error: null });
});

describe("mobile Murmur authentication client", () => {
  it("adds the durable account cookie to Worker requests", async () => {
    const headers = await authenticatedWorkerHeaders({ "x-test": "value" });

    expect(headers.get("cookie")).toBe("murmur.session=test-cookie");
    expect(headers.get("x-test")).toBe("value");
    expect(auth.signInAnonymous).not.toHaveBeenCalled();
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
});
