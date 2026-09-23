import { isUiLocale, type UiLocale } from "../i18n/types";

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

// React Native on iOS and Android reads textAlign "left"/"right" as start/end inside an RTL
// layout, while the web keeps them physical. babel-preset-expo replaces EXPO_OS per platform at build time.
export function textAlignFollowsLayout(): boolean {
  return process.env.EXPO_OS === "ios" || process.env.EXPO_OS === "android";
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

export function getGoogleOAuthClientIds(): { web?: string; ios?: string } {
  return {
    web: publicConfigValue(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
    ios: publicConfigValue(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
  };
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
  "account-pack",
  "account-pro-max",
  "account-signed-in",
  "account-unsaved",
  "app-language",
  "billing",
  "history",
  "history-detail",
  "history-empty",
  "history-gate",
  "insights-consent",
  "languages",
  "low-balance",
  "out-of-minutes",
  "out-of-minutes-signed-in",
  "phone-audio-claimed",
  "phone-audio-gate",
  "phone-audio-gift",
  "picker",
  "plans-monthly",
  "plans-offer",
  "plans-packs",
  "plans-yearly",
  "privacy",
  "rating",
  "rating-answered",
  "save-purchase",
  "save-purchase-saved",
  "settings",
  "source-picker",
  "translation",
  "translation-background",
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

// Renders previews in a fixed UI language, for locale review and store screenshots.
export function getUiPreviewLocale(): UiLocale | null {
  const value = process.env.EXPO_PUBLIC_MURMUR_UI_PREVIEW_LOCALE;
  return isUiLocale(value) ? value : null;
}

function publicConfigValue(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}
