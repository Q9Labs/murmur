import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { createAuthClient } from "better-auth/react";
import { anonymousClient, emailOTPClient } from "better-auth/client/plugins";

import { getWorkerBaseUrl } from "../config";

const murmurAuthClient = createAuthClient({
  baseURL: getWorkerBaseUrl(),
  plugins: [
    anonymousClient(),
    emailOTPClient(),
    expoClient({
      cookiePrefix: "murmur",
      scheme: "murmur",
      storage: SecureStore,
      storagePrefix: "murmur-auth",
    }),
  ],
});

async function ensureMurmurSession(): Promise<void> {
  const existing = await murmurAuthClient.getSession();
  if (existing.data) {
    return;
  }

  const created = await murmurAuthClient.signIn.anonymous();
  if (created.error) {
    throw new Error(created.error.message ?? "Murmur could not create an account.");
  }
}

async function getMurmurCookie(): Promise<string> {
  await ensureMurmurSession();
  const cookie = await murmurAuthClient.getCookie();
  if (!cookie) {
    throw new Error("Murmur account cookie is unavailable.");
  }
  return cookie;
}

export async function authenticatedWorkerHeaders(
  headers?: HeadersInit,
): Promise<Headers> {
  const authenticated = new Headers(headers);
  authenticated.set("cookie", await getMurmurCookie());
  return authenticated;
}

export async function sendEmailSignInCode(email: string): Promise<void> {
  const result = await murmurAuthClient.emailOtp.sendVerificationOtp({
    email,
    type: "sign-in",
  });
  if (result.error) {
    throw new Error(result.error.message ?? "Murmur could not send the sign-in code.");
  }
}

export async function verifyEmailSignInCode(email: string, otp: string): Promise<void> {
  const result = await murmurAuthClient.signIn.emailOtp({ email, otp });
  if (result.error) {
    throw new Error(result.error.message ?? "The sign-in code is invalid or expired.");
  }
}

export async function deleteMurmurAccount(): Promise<void> {
  const result = await murmurAuthClient.deleteUser();
  if (result.error) {
    throw new Error(result.error.message ?? "Murmur could not delete the account.");
  }
}
