import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type {
  CreateSessionResponse,
} from "@murmur/protocol/transport/types";
import { PermissionsAndroid, Platform } from "react-native";

import MurmurAudioModule, {
  type DeviceIntegrityPayload,
} from "../../../modules/murmur-audio";
import type { AcquisitionContext } from "@murmur/protocol/acquisition";
import { getWorkerBaseUrl } from "../config";

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  return MurmurAudioModule.requestMicrophonePermission();
}

export async function createWorkerSession(body: {
  acquisition?: AcquisitionContext;
  app_install_id: string;
  device_integrity: DeviceIntegrityPayload;
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
}): Promise<CreateSessionResponse | { error: string }> {
  return postWorkerJson<CreateSessionResponse>(`${getWorkerBaseUrl()}/v2/session`, body);
}

export async function closeWorkerSession(appSessionId: string, reason: string): Promise<void> {
  if (!appSessionId) {
    return;
  }
  await fetch(`${getWorkerBaseUrl()}/v2/session/${appSessionId}/stop`, {
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
  const nonce = [
    "murmur",
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 14),
    params.sourceLanguage,
    params.targetLanguage,
    params.appInstallId.slice(-12),
  ].join("_");
  const payload = (await MurmurAudioModule.requestPlayIntegrityToken(nonce).catch((error) => ({
    available: false,
    platform: Platform.OS,
    reason: error instanceof Error ? error.message : "device_integrity_failed",
  }))) as DeviceIntegrityPayload;
  return {
    available: Boolean(payload.available && payload.token),
    key_id: typeof payload.key_id === "string" ? payload.key_id : undefined,
    kind: typeof payload.kind === "string" ? payload.kind : undefined,
    nonce,
    platform: Platform.OS,
    provider: Platform.OS === "ios" ? "app_attest" : "play_integrity",
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
    token: typeof payload.token === "string" ? payload.token : undefined,
  };
}

async function postWorkerJson<T>(url: string, body: unknown): Promise<T | { error: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!response) {
    return { error: "worker_session_network_error" };
  }
  const payload = await response.json().catch(() => null);
  if (isErrorPayload(payload)) {
    const missing = Array.isArray(payload.missing) ? `:${payload.missing.join(",")}` : "";
    return { error: `${payload.error}${missing}` };
  }
  if (!response.ok || !payload) {
    return { error: `worker_session_http_${response.status}` };
  }
  return payload as T;
}

function isErrorPayload(payload: unknown): payload is { error: string; missing?: unknown } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  );
}
