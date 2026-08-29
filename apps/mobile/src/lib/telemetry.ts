import type { MobileTelemetryEvent, TelemetryPlatform } from "@murmur/protocol/telemetry";
import Constants from "expo-constants";
import { Platform } from "react-native";

import {
  deleteAnonymousAnalyticsPreference,
  getAnonymousAnalyticsEnabled,
  setAnonymousAnalyticsEnabled,
} from "./anonymousAnalytics";
import { getWorkerBaseUrl } from "./config";
import { getOrCreateInstallId } from "./installIdentity";
import { captureMobileFailure } from "./observability/sentry";

let anonymousAnalyticsEnabled = true;

export async function initializeAnonymousAnalytics(): Promise<boolean> {
  anonymousAnalyticsEnabled = await getAnonymousAnalyticsEnabled();
  if (anonymousAnalyticsEnabled) {
    await deliverMobileTelemetry(createAppLifecycleEvent("mobile_app_opened"));
  }
  return anonymousAnalyticsEnabled;
}

export function isAnonymousAnalyticsEnabled(): boolean {
  return anonymousAnalyticsEnabled;
}

export async function updateAnonymousAnalyticsEnabled(enabled: boolean): Promise<void> {
  if (enabled === anonymousAnalyticsEnabled) {
    return;
  }
  if (enabled) {
    await setAnonymousAnalyticsEnabled(true);
    anonymousAnalyticsEnabled = true;
    await deliverMobileTelemetry(createAnalyticsPreferenceEvent(true));
    return;
  }
  await deliverMobileTelemetry(createAnalyticsPreferenceEvent(false));
  await setAnonymousAnalyticsEnabled(false);
  anonymousAnalyticsEnabled = false;
}

export async function resetAnonymousAnalyticsPreference(): Promise<void> {
  await deleteAnonymousAnalyticsPreference();
  anonymousAnalyticsEnabled = true;
}

export function captureMobileTelemetry(payload: MobileTelemetryEvent): void {
  if (!anonymousAnalyticsEnabled) {
    return;
  }
  void deliverMobileTelemetry(payload).catch((failure: unknown) => {
    captureMobileFailure(failure, { operation: "mobile_telemetry_delivery" });
  });
}

export function captureOnboardingCompleted(): void {
  captureMobileTelemetry(createAppLifecycleEvent("mobile_onboarding_completed"));
}

async function deliverMobileTelemetry(payload: MobileTelemetryEvent): Promise<void> {
  const appInstallId = await getOrCreateInstallId();
  const response = await fetch(`${getWorkerBaseUrl()}/v1/telemetry`, {
    body: JSON.stringify({ app_install_id: appInstallId, payload }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`mobile_telemetry_http_${response.status}`);
  }
}

function createAppLifecycleEvent(
  event: "mobile_app_opened" | "mobile_onboarding_completed",
): MobileTelemetryEvent {
  return {
    ...getAppIdentity(),
    event,
    platform: getTelemetryPlatform(),
  };
}

function createAnalyticsPreferenceEvent(enabled: boolean): MobileTelemetryEvent {
  return {
    ...getAppIdentity(),
    enabled,
    event: "mobile_analytics_preference_changed",
    platform: getTelemetryPlatform(),
  };
}

function getAppIdentity(): { app_version: string; build_number: string } {
  const appVersion = Constants.expoConfig?.version ?? "unknown";
  const buildNumber = Platform.OS === "android"
    ? Constants.expoConfig?.android?.versionCode
    : Constants.expoConfig?.ios?.buildNumber;
  return {
    app_version: appVersion,
    build_number: String(buildNumber ?? "unknown"),
  };
}

function getTelemetryPlatform(): TelemetryPlatform {
  if (Platform.OS === "android" || Platform.OS === "ios" || Platform.OS === "web") {
    return Platform.OS;
  }
  return "unknown";
}
