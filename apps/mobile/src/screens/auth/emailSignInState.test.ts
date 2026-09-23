import { describe, expect, it } from "vitest";

import { LocalizedError } from "../../i18n/localizedError";

import {
  codeStep,
  isCompleteCode,
  isPlausibleEmail,
  normalizeEmail,
  sanitizeCode,
  signInFailure,
} from "./emailSignInState";

describe("email sign-in state", () => {
  it("normalizes and checks email addresses", () => {
    expect(normalizeEmail("  Hasan@Example.COM ")).toBe("hasan@example.com");
    expect(isPlausibleEmail("hasan@example.com")).toBe(true);
    expect(isPlausibleEmail("hasan@example")).toBe(false);
    expect(isPlausibleEmail("not an email")).toBe(false);
  });

  it("keeps only six digits of a pasted code", () => {
    expect(sanitizeCode("12 34-56 78")).toBe("123456");
    expect(isCompleteCode("123456")).toBe(true);
    expect(isCompleteCode("12345")).toBe(false);
  });

  it("starts the code step clean, with an optional notice", () => {
    expect(codeStep("a@b.co", "auth.codeResent")).toEqual({
      code: "",
      email: "a@b.co",
      error: null,
      notice: "auth.codeResent",
      pending: null,
      step: "code",
    });
  });

  it("keeps a real failure or falls back to a catalog message", () => {
    const expired = new Error("That code has expired.");
    expect(signInFailure(expired, "auth.codeFailed")).toBe(expired);
    const fallback = signInFailure("boom", "auth.codeFailed");
    expect(fallback).toBeInstanceOf(LocalizedError);
    expect(fallback.message).toBe("That code didn't work. Try again.");
  });
});
