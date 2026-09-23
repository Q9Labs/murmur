import { importPKCS8, SignJWT } from "jose";

import type { Env } from "../env";

export function socialProviders(env: Env) {
  const appleClientId = env.APPLE_CLIENT_ID?.trim();
  const appleTeamId = env.APPLE_TEAM_ID?.trim();
  const appleKeyId = env.APPLE_KEY_ID?.trim();
  const applePrivateKey = env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const appleBundleId = env.APPLE_APP_BUNDLE_IDENTIFIER?.trim();
  const googleWebClientId = env.GOOGLE_WEB_CLIENT_ID?.trim();
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const googleClientIds = [
    googleWebClientId,
    env.GOOGLE_IOS_CLIENT_ID?.trim(),
    env.GOOGLE_ANDROID_CLIENT_ID?.trim(),
  ].filter((id): id is string => Boolean(id));

  return {
    apple: appleClientId && appleTeamId && appleKeyId && applePrivateKey && appleBundleId
      ? async () => ({
        appBundleIdentifier: appleBundleId,
        clientId: appleClientId,
        clientSecret: await appleClientSecret({
          clientId: appleClientId,
          keyId: appleKeyId,
          privateKey: applePrivateKey,
          teamId: appleTeamId,
        }),
        overrideUserInfoOnSignIn: false,
        mapProfileToUser: (profile: { email?: string; name?: string; sub: string }) => {
          const name = profile.name?.trim() || "";
          return {
            email: profile.email ?? `apple-${profile.sub}@apple.murmur.invalid`,
            name,
          };
        },
      })
      : undefined,
    google: googleWebClientId && googleClientSecret
      ? {
        clientId: googleClientIds,
        clientSecret: googleClientSecret,
      }
      : undefined,
  };
}

async function appleClientSecret(params: {
  clientId: string;
  keyId: string;
  privateKey: string;
  teamId: string;
}): Promise<string> {
  const key = await importPKCS8(params.privateKey, "ES256");
  const nowSeconds = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: params.keyId })
    .setIssuer(params.teamId)
    .setSubject(params.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 180 * 24 * 60 * 60)
    .sign(key);
}
