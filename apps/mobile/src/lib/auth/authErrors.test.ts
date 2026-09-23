import { describe, expect, it } from "vitest";

import { LocalizedError } from "../../i18n/localizedError";
import { authError } from "./authErrors";

function keyOf(error: Error): string | null {
  return error instanceof LocalizedError ? error.messageKey : null;
}

describe("authError", () => {
  it("explains wrong, expired and overused codes in plain language", () => {
    expect(keyOf(authError({ code: "INVALID_OTP", status: 400 }, "auth.codeFailed"))).toBe("auth.codeMismatch");
    expect(authError({ code: "OTP_EXPIRED", status: 400 }, "auth.codeFailed").message).toContain("expired");
    expect(keyOf(authError({ code: "TOO_MANY_ATTEMPTS", status: 403 }, "auth.codeFailed"))).toBe("auth.tooManyTries");
  });

  it("covers rate limits, server messages and unknown failures", () => {
    expect(authError({ status: 429 }, "auth.sendFailed").message).toContain("Wait a minute");
    const server = authError({ message: "Server said no", status: 500 }, "auth.sendFailed");
    expect(server.message).toBe("Server said no");
    expect(keyOf(server)).toBeNull();
    expect(keyOf(authError({ status: 500 }, "auth.sendFailed"))).toBe("auth.sendFailed");
  });
});
