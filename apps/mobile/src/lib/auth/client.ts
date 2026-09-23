import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { createAuthClient } from "better-auth/react";
import { anonymousClient, emailOTPClient } from "better-auth/client/plugins";

import { getAppRelease } from "../appRelease";
import { getWorkerBaseUrl } from "../config";
import { authErrorMessage } from "./authErrors";
import { getOrCreateFreeAllowanceId, getOrCreateInstallId } from "../installIdentity";
import { getAppleIdentity, getGoogleIdentity } from "./nativeProviders";

const freeAllowanceIdHeader = "x-murmur-free-allowance-id";
let guestSessionCreation: Promise<void> | null = null;

const murmurAuthClient = createAuthClient({
  baseURL: getWorkerBaseUrl(),
  fetchOptions: {
    onRequest: async (context) => {
      context.headers.set(freeAllowanceIdHeader, await getOrCreateFreeAllowanceId());
      context.headers.set("x-murmur-install-id", await getOrCreateInstallId());
      const release = getAppRelease();
      context.headers.set("x-murmur-app-platform", release.app_platform);
      context.headers.set("x-murmur-app-version", release.app_version);
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
    throw new Error(authErrorMessage(result.error, "Murmur could not send the sign-in code."));
  }
}

export async function verifyEmailSignInCode(email: string, otp: string): Promise<void> {
  const result = await murmurAuthClient.signIn.emailOtp({ email, otp });
  if (result.error) {
    throw new Error(authErrorMessage(result.error, "The sign-in code is invalid or expired."));
  }
}

export async function signInWithApple(): Promise<boolean> {
  const identity = await getAppleIdentity();
  if (!identity) {
    return false;
  }
  const result = await murmurAuthClient.signIn.social({
    provider: "apple",
    idToken: {
      token: identity.token,
      nonce: identity.nonce,
      user: identity.user,
    },
  }, { headers: { cookie: await getMurmurCookie() } });
  if (result.error) {
    throw new Error(authErrorMessage(result.error, "Apple sign-in failed."));
  }
  return true;
}

export async function signInWithGoogle(): Promise<boolean> {
  const token = await getGoogleIdentity();
  if (!token) {
    return false;
  }
  const result = await murmurAuthClient.signIn.social({
    provider: "google",
    idToken: { token },
  }, { headers: { cookie: await getMurmurCookie() } });
  if (result.error) {
    throw new Error(authErrorMessage(result.error, "Google sign-in failed."));
  }
  return true;
}

export async function deleteMurmurAccount(): Promise<void> {
  const result = await murmurAuthClient.deleteUser();
  if (result.error) {
    throw new Error(result.error.message ?? "Murmur could not delete the account.");
  }
}

export async function switchMurmurAccount(): Promise<void> {
  const signedOut = await murmurAuthClient.signOut();
  if (signedOut.error) {
    throw new Error(signedOut.error.message ?? "Murmur could not switch accounts.");
  }
  await ensureMurmurSession();
}
