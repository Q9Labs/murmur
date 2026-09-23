export function getWorkerBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_MURMUR_WORKER_URL) {
    return process.env.EXPO_PUBLIC_MURMUR_WORKER_URL;
  }

  return process.env.NODE_ENV === "development"
    ? "http://localhost:8787"
    : "https://murmur.q9labs.ai";
}

export function getSentryDsn(): string | undefined {
  return process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || undefined;
}

export function getPostHogProjectToken(): string | undefined {
  return process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() || undefined;
}

export type MurmurEnvironment = "development" | "preview" | "production" | "sandbox";

export function getMurmurEnvironment(): MurmurEnvironment {
  const value = process.env.EXPO_PUBLIC_MURMUR_ENV?.trim();
  if (value === "development" || value === "preview" || value === "production" || value === "sandbox") {
    return value;
  }
  return process.env.NODE_ENV === "development" ? "development" : "production";
}

export type RevenueCatApiKeys = {
  android?: string;
  ios?: string;
};

export function getRevenueCatApiKeys(): RevenueCatApiKeys {
  return {
    android: publicConfigValue(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY),
    ios: publicConfigValue(process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY),
  };
}

export function getRevenueCatOfferingId(): string | undefined {
  return publicConfigValue(process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID);
}

const uiPreviewScreens = [
  "auth-code",
  "auth-code-error",
  "auth-code-expired",
  "auth-email",
  "auth-email-error",
  "auth-sending",
  "auth-success",
  "auth-verifying",
  "account-guest",
  "account-signed-in",
  "billing",
  "languages",
  "low-balance",
  "out-of-minutes",
  "out-of-minutes-signed-in",
  "picker",
  "plans-monthly",
  "plans-packs",
  "plans-yearly",
  "privacy",
  "settings",
  "source-picker",
  "translation",
  "translation-muted",
  "translation-only",
  "update-required",
  "welcome",
] as const;

export type UiPreviewScreen = (typeof uiPreviewScreens)[number];

export function toUiPreviewScreen(value: string | undefined): UiPreviewScreen | null {
  return uiPreviewScreens.find((candidate) => candidate === value) ?? null;
}

export function getUiPreviewScreen(): UiPreviewScreen | null {
  return toUiPreviewScreen(process.env.EXPO_PUBLIC_MURMUR_UI_PREVIEW);
}

function publicConfigValue(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}
