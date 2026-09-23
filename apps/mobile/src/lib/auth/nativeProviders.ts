import { Platform } from "react-native";

import { getGoogleOAuthClientIds } from "../config";

export type NativeAppleIdentity = {
  token: string;
  nonce: string;
  user: {
    name: { firstName: string; lastName: string };
  } | undefined;
};

export async function getAppleIdentity(): Promise<NativeAppleIdentity | null> {
  if (Platform.OS !== "ios") {
    throw new Error("Apple sign-in is only available on iOS.");
  }
  const AppleAuthentication = await import("expo-apple-authentication");
  if (!await AppleAuthentication.isAvailableAsync()) {
    throw new Error("Apple sign-in is unavailable on this device.");
  }
  const Crypto = await import("expo-crypto");
  const nonce = Crypto.randomUUID();
  try {
    const credential = await AppleAuthentication.signInAsync({
      nonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error("Apple did not return a sign-in token.");
    }
    return {
      token: credential.identityToken,
      nonce,
      user: credential.fullName
        ? {
          name: {
            firstName: credential.fullName.givenName ?? "",
            lastName: credential.fullName.familyName ?? "",
          },
        }
        : undefined,
    };
  } catch (failure) {
    if (failure instanceof Error && Reflect.get(failure, "code") === "ERR_REQUEST_CANCELED") {
      return null;
    }
    throw failure;
  }
}

export async function getGoogleIdentity(): Promise<string | null> {
  const { web: webClientId, ios: iosClientId } = getGoogleOAuthClientIds();
  if (!webClientId || (Platform.OS === "ios" && !iosClientId)) {
    throw new Error("Google sign-in is not configured for this build.");
  }
  const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
  GoogleSignin.configure({ webClientId, iosClientId });
  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  const result = await GoogleSignin.signIn();
  if (result.type === "cancelled") {
    return null;
  }
  if (!result.data.idToken) {
    throw new Error("Google did not return a sign-in token.");
  }
  return result.data.idToken;
}
