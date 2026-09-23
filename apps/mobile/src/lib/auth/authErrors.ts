export type AuthFailure = {
  code?: string;
  message?: string;
  status?: number;
};

const authErrorCopy: Readonly<Partial<Record<string, string>>> = {
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_OTP: "That code doesn't match. Check the latest email from Murmur and try again.",
  OTP_EXPIRED: "That code has expired. Send a new code to keep going.",
  TOO_MANY_ATTEMPTS: "Too many tries with that code. Send a new code to keep going.",
};

export function authErrorMessage(failure: AuthFailure, fallback: string): string {
  const copy = failure.code ? authErrorCopy[failure.code] : undefined;
  if (copy) {
    return copy;
  }
  if (failure.status === 429) {
    return "Too many requests. Wait a minute, then try again.";
  }
  return failure.message || fallback;
}
