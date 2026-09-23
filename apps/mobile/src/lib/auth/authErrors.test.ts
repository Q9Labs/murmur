import { describe, expect, it } from "vitest";

import { authErrorMessage } from "./authErrors";

describe("authErrorMessage", () => {
  it("explains wrong, expired and overused codes in plain language", () => {
    expect(authErrorMessage({ code: "INVALID_OTP", status: 400 }, "fallback")).toContain("doesn't match");
    expect(authErrorMessage({ code: "OTP_EXPIRED", status: 400 }, "fallback")).toContain("expired");
    expect(authErrorMessage({ code: "TOO_MANY_ATTEMPTS", status: 403 }, "fallback")).toContain("Too many tries");
  });

  it("covers rate limits, server messages and unknown failures", () => {
    expect(authErrorMessage({ status: 429 }, "fallback")).toContain("Wait a minute");
    expect(authErrorMessage({ message: "Server said no", status: 500 }, "fallback")).toBe("Server said no");
    expect(authErrorMessage({ status: 500 }, "Could not send the code.")).toBe("Could not send the code.");
  });
});
