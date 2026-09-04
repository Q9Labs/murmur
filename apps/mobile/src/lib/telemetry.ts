import type { MobileTelemetryEvent, TelemetryPlatform } from "@murmur/protocol/telemetry";
import Constants from "expo-constants";
import { Platform } from "react-native";

import {
  deleteAnonymousAnalyticsPreference,
  getAnonymousAnalyticsEnabled,
  setAnonymousAnalyticsEnabled,
} from "./anonymousAnalytics";
import { getOrCreateInstallId } from "./installIdentity";
import { deliverMobileTelemetryRequest } from "./providers/mobileTelemetry";

let anonymousAnalyticsEnabled = false;

export async function initializeAnonymousAnalytics(): Promise<boolean> {
  anonymousAnalyticsEnabled = await getAnonymousAnalyticsEnabled();
  if (anonymousAnalyticsEnabled) {
    captureMobileTelemetry(createAppLifecycleEvent("mobile_app_opened"));
  }
  return anonymousAnalyticsEnabled;
}

export async function updateAnonymousAnalyticsEnabled(enabled: boolean): Promise<void> {
  if (enabled === anonymousAnalyticsEnabled) {
    return;
  }
  if (enabled) {
    await setAnonymousAnalyticsEnabled(true);
    anonymousAnalyticsEnabled = true;
    await deliverMobileTelemetryBestEffort(createAnalyticsPreferenceEvent(true));
    return;
  }
  anonymousAnalyticsEnabled = false;
  await setAnonymousAnalyticsEnabled(false);
  await deliverMobileTelemetryBestEffort(createAnalyticsPreferenceEvent(false));
}

export async function resetAnonymousAnalyticsPreference(): Promise<void> {
  await deleteAnonymousAnalyticsPreference();
  anonymousAnalyticsEnabled = true;
}

export function captureMobileTelemetry(payload: MobileTelemetryEvent): void {
  if (!anonymousAnalyticsEnabled) {
    return;
  }
  void deliverMobileTelemetryBestEffort(payload);
}

export function captureOnboardingCompleted(): void {
  captureMobileTelemetry(createAppLifecycleEvent("mobile_onboarding_completed"));
}

async function deliverMobileTelemetry(payload: MobileTelemetryEvent): Promise<void> {
  const appInstallId = await getOrCreateInstallId();
  await deliverMobileTelemetryRequest({ app_install_id: appInstallId, payload });
}

async function deliverMobileTelemetryBestEffort(payload: MobileTelemetryEvent): Promise<void> {
  await Promise.allSettled([deliverMobileTelemetry(payload)]);
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
