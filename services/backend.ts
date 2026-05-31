interface DeepgramTokenResponse {
  readonly token?: unknown;
  readonly accessToken?: unknown;
  readonly access_token?: unknown;
}

export function getMurmurApiBaseUrl(): string | null {
  const apiBaseUrl = process.env.EXPO_PUBLIC_MURMUR_API_BASE_URL?.trim() ?? "";

  if (!apiBaseUrl) {
    return null;
  }

  try {
    return normalizeApiBaseUrl(apiBaseUrl);
  } catch (error) {
    console.warn("[Backend] Ignoring invalid Murmur backend URL:", error);
    return null;
  }
}

export function normalizeApiBaseUrl(apiBaseUrl: string): string {
  const trimmed = apiBaseUrl.trim();
  if (!trimmed) {
    throw new Error("Murmur backend URL is required");
  }

  const parsed = new URL(trimmed);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Murmur backend URL must use http or https");
  }

  return trimmed.replace(/\/+$/, "");
}

export function buildBackendUrl(apiBaseUrl: string, path: string): string {
  const normalizedBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

export async function requestDeepgramAuthToken(
  apiBaseUrl: string,
): Promise<string> {
  const response = await fetch(buildBackendUrl(apiBaseUrl, "/deepgram/token"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Murmur backend token request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as DeepgramTokenResponse;
  const token = data.token ?? data.accessToken ?? data.access_token;

  if (typeof token !== "string" || token.trim() === "") {
    throw new Error("Murmur backend did not return a Deepgram auth token");
  }

  return token;
}
