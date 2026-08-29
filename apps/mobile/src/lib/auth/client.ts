import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { createAuthClient } from "better-auth/react";
import { anonymousClient, emailOTPClient } from "better-auth/client/plugins";

import { getWorkerBaseUrl } from "../config";
import { getOrCreateFreeAllowanceId } from "../installIdentity";

const freeAllowanceIdHeader = "x-murmur-free-allowance-id";
let guestSessionCreation: Promise<void> | null = null;

const murmurAuthClient = createAuthClient({
  baseURL: getWorkerBaseUrl(),
  fetchOptions: {
    onRequest: async (context) => {
      context.headers.set(freeAllowanceIdHeader, await getOrCreateFreeAllowanceId());
      return context;
    },
  },
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
  if (!guestSessionCreation) {
    guestSessionCreation = createGuestSession();
  }
  const pendingCreation = guestSessionCreation;
  try {
    await pendingCreation;
  } finally {
    if (guestSessionCreation === pendingCreation) {
      guestSessionCreation = null;
    }
  }
}

async function createGuestSession(): Promise<void> {
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
  authenticated.set(freeAllowanceIdHeader, await getOrCreateFreeAllowanceId());
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
