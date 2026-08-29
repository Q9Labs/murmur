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

export type UiPreviewScreen = "picker" | "settings" | "translation" | "welcome";

export function getUiPreviewScreen(): UiPreviewScreen | null {
  const previewScreen = process.env.EXPO_PUBLIC_MURMUR_UI_PREVIEW;
  return previewScreen === "picker" ||
    previewScreen === "settings" ||
    previewScreen === "translation" ||
    previewScreen === "welcome"
    ? previewScreen
    : null;
}
