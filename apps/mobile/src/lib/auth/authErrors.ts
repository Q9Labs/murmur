import type { MessageKey } from "../../i18n/catalogs/en";
import { LocalizedError } from "../../i18n/localizedError";

export type AuthFailure = {
  code?: string;
  message?: string;
  status?: number;
};

const authErrorKeys: Readonly<Partial<Record<string, MessageKey>>> = {
  INVALID_EMAIL: "auth.invalidEmail",
  INVALID_OTP: "auth.codeMismatch",
  OTP_EXPIRED: "auth.codeExpired",
  TOO_MANY_ATTEMPTS: "auth.tooManyTries",
};

export function authError(failure: AuthFailure, fallback: MessageKey): Error {
  const key = failure.code ? authErrorKeys[failure.code] : undefined;
  if (key) {
    return new LocalizedError(key);
  }
  if (failure.status === 429) {
    return new LocalizedError("auth.rateLimited");
  }
  return failure.message ? new Error(failure.message) : new LocalizedError(fallback);
}
