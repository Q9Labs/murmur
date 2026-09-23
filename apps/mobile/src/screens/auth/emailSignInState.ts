import type { MessageKey } from "../../i18n/catalogs/en";
import { LocalizedError } from "../../i18n/localizedError";

// Errors stay as failures and notices as catalog keys, so they render in the current UI language.
export type EmailSignInState =
  | { email: string; error: Error | null; pending: boolean; step: "email" }
  | {
      code: string;
      email: string;
      error: Error | null;
      notice: MessageKey | null;
      pending: "resend" | "verify" | null;
      step: "code";
    }
  | { email: string; step: "done" };

export const initialEmailSignIn: EmailSignInState = {
  email: "",
  error: null,
  pending: false,
  step: "email",
};

const plausibleEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sixDigitCode = /^\d{6}$/;
const nonDigits = /\D/g;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isPlausibleEmail(value: string): boolean {
  return plausibleEmail.test(normalizeEmail(value));
}

export function sanitizeCode(value: string): string {
  return value.replace(nonDigits, "").slice(0, 6);
}

export function isCompleteCode(value: string): boolean {
  return sixDigitCode.test(value);
}

export type CodeStepState = Extract<EmailSignInState, { step: "code" }>;

export function codeStep(email: string, notice: MessageKey | null = null): CodeStepState {
  return { code: "", email, error: null, notice, pending: null, step: "code" };
}

export function signInFailure(failure: unknown, fallback: MessageKey): Error {
  return failure instanceof Error && failure.message ? failure : new LocalizedError(fallback);
}
