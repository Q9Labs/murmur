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

export type UiPreviewScreen =
  | "billing"
  | "languages"
  | "picker"
  | "privacy"
  | "settings"
  | "source-picker"
  | "translation"
  | "translation-muted"
  | "welcome";

export function getUiPreviewScreen(): UiPreviewScreen | null {
  const previewScreen = process.env.EXPO_PUBLIC_MURMUR_UI_PREVIEW;
  return previewScreen === "billing" ||
    previewScreen === "languages" ||
    previewScreen === "picker" ||
    previewScreen === "privacy" ||
    previewScreen === "settings" ||
    previewScreen === "source-picker" ||
    previewScreen === "translation" ||
    previewScreen === "translation-muted" ||
    previewScreen === "welcome"
    ? previewScreen
    : null;
}

function publicConfigValue(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}
