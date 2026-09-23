import { Platform } from "react-native";

import { LocalizedError } from "../../i18n/localizedError";
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
    throw new LocalizedError("auth.appleUnavailable");
  }
  const AppleAuthentication = await import("expo-apple-authentication");
  if (!await AppleAuthentication.isAvailableAsync()) {
    throw new LocalizedError("auth.appleUnavailable");
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
      throw new LocalizedError("auth.appleFailed");
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
    throw new LocalizedError("auth.googleUnavailable");
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
    throw new LocalizedError("auth.googleFailed");
  }
  return result.data.idToken;
}
