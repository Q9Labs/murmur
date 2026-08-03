export function getWorkerBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_MURMUR_WORKER_URL) {
    return process.env.EXPO_PUBLIC_MURMUR_WORKER_URL;
  }

  return process.env.NODE_ENV === "development"
    ? "http://localhost:8787"
    : "https://murmur.q9labs.ai";
}
