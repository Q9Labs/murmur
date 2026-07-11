import { PermissionsAndroid, Platform } from "react-native";

import MurmurAudioModule, {
  type DeviceIntegrityPayload,
} from "../../../modules/murmur-audio";
import { getWorkerBaseUrl } from "../config";
import { autoSourceLanguageCode, getLanguage, type LanguageCode, type SourceLanguageCode } from "@murmur/protocol/languages";
import { normalizeSummaryResponse } from "../summaryResponse";
import type {
  CreateSessionResponse,
  RefreshSessionTokenResponse,
  RollingMemorySpan,
  SessionSummary,
  SummaryResponse,
  TranslationMode,
  TranslationModelRoute,
} from "@murmur/protocol/transport/types";

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  return MurmurAudioModule.requestMicrophonePermission();
}

export async function createWorkerSession(body: {
  app_install_id: string;
  device_integrity: DeviceIntegrityPayload;
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
  translation_model_route?: TranslationModelRoute;
  translation_mode: TranslationMode;
  ultravox_vad_enabled?: boolean;
}): Promise<CreateSessionResponse | { error: string }> {
  return postWorkerJson<CreateSessionResponse>(`${getWorkerBaseUrl()}/v1/session`, body);
}

export async function requestContinuousSummary(body: {
  app_session_id: string;
  input_memory_version: number;
  previous_summary: SessionSummary;
  session_epoch: number;
  source_language: SourceLanguageCode;
  spans_to_summarize: RollingMemorySpan[];
  summary_job_id: string;
  target_language: LanguageCode;
}): Promise<SummaryResponse> {
  const response = await fetch(`${getWorkerBaseUrl()}/v1/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!response) {
    return { error: "summary_network_error", retryable: true };
  }
  const payload = (await response.json().catch(() => null)) as unknown;
  return normalizeSummaryResponse(response, payload);
}

export async function refreshWorkerSessionTokens(body: {
  app_install_id: string;
  app_session_id: string;
  device_integrity: DeviceIntegrityPayload;
  session_epoch: number;
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
  translation_mode: TranslationMode;
}): Promise<RefreshSessionTokenResponse | { error: string }> {
  return postWorkerJson<RefreshSessionTokenResponse>(
    `${getWorkerBaseUrl()}/v1/session/${body.app_session_id}/tokens`,
    body,
  );
}

export async function closeWorkerSession(appSessionId: string, reason: string): Promise<void> {
  if (!appSessionId) {
    return;
  }
  await fetch(`${getWorkerBaseUrl()}/v1/session/${appSessionId}/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  }).catch(() => null);
}

export async function collectDeviceIntegrity(params: {
  appInstallId: string;
  sourceLanguage: SourceLanguageCode;
  targetLanguage: LanguageCode;
}): Promise<DeviceIntegrityPayload> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return {
      available: false,
      platform: Platform.OS,
      reason: "platform_integrity_not_implemented",
    };
  }

  const nonce = createIntegrityNonce(params);
  const payload = (await MurmurAudioModule.requestPlayIntegrityToken(nonce).catch((error) => ({
    available: false,
    platform: Platform.OS,
    provider: Platform.OS === "ios" ? "app_attest" : "play_integrity",
    reason: error instanceof Error ? error.message : "device_integrity_failed",
  }))) as DeviceIntegrityPayload;

  const provider = Platform.OS === "ios" ? "app_attest" : "play_integrity";
  return {
    available: Boolean(payload.available && payload.token),
    key_id: typeof payload.key_id === "string" ? payload.key_id : undefined,
    kind: typeof payload.kind === "string" ? payload.kind : undefined,
    nonce,
    platform: Platform.OS,
    provider,
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
    token: typeof payload.token === "string" ? payload.token : undefined,
  };
}

export function getDeepgramClientLanguage(sourceLanguage: SourceLanguageCode) {
  return sourceLanguage === autoSourceLanguageCode ? undefined : getLanguage(sourceLanguage);
}

async function postWorkerJson<T>(url: string, body: unknown): Promise<T | { error: string }> {
  const response = await fetchWorkerJsonResponse(url, body);
  if (!response) {
    return { error: "worker_session_network_error" };
  }
  const payload = await readWorkerJsonPayload(response);
  return parseWorkerJsonPayload<T>(response, payload);
}

async function fetchWorkerJsonResponse(url: string, body: unknown): Promise<Response | null> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

async function readWorkerJsonPayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function parseWorkerJsonPayload<T>(response: Response, payload: unknown): T | { error: string } {
  if (isErrorPayload(payload)) {
    return { error: formatWorkerErrorPayload(payload) };
  }
  if (!response.ok || !payload) {
    return { error: `worker_session_http_${response.status}` };
  }
  return payload as T;
}

function formatWorkerErrorPayload(payload: {
  error: string;
  missing?: unknown;
  provider?: unknown;
  reason?: unknown;
}): string {
  return `${payload.error}${formatWorkerErrorSegment(payload.provider)}${formatWorkerErrorSegment(payload.reason)}${formatWorkerMissingSegment(payload.missing)}`;
}

function formatWorkerErrorSegment(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? `:${value}` : "";
}

function formatWorkerMissingSegment(value: unknown): string {
  return Array.isArray(value) ? `:${value.join(",")}` : "";
}

function createIntegrityNonce(params: {
  appInstallId: string;
  sourceLanguage: SourceLanguageCode;
  targetLanguage: LanguageCode;
}): string {
  return [
    "murmur",
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 14),
    params.sourceLanguage,
    params.targetLanguage,
    params.appInstallId.slice(-12),
  ].join("_");
}

function isErrorPayload(payload: unknown): payload is {
  error: string;
  missing?: unknown;
  provider?: unknown;
  reason?: unknown;
} {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  );
}
