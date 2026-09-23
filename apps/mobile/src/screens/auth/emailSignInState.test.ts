import { describe, expect, it } from "vitest";

import {
  codeStep,
  failureMessage,
  isCompleteCode,
  isPlausibleEmail,
  normalizeEmail,
  sanitizeCode,
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
    expect(codeStep("a@b.co", "New code sent.")).toEqual({
      code: "",
      email: "a@b.co",
      error: null,
      notice: "New code sent.",
      pending: null,
      step: "code",
    });
  });

  it("reads a failure's message or falls back", () => {
    expect(failureMessage(new Error("That code has expired."), "fallback")).toBe("That code has expired.");
    expect(failureMessage("boom", "fallback")).toBe("fallback");
  });
});
