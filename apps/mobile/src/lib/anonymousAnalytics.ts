import { deleteLocalValue, getLocalValue, setLocalValue } from "./localStorage";

const anonymousAnalyticsEnabledKey = "murmur_anonymous_analytics_enabled_v1";

export async function getAnonymousAnalyticsEnabled(): Promise<boolean> {
  return (await getLocalValue(anonymousAnalyticsEnabledKey)) !== "false";
}

export async function setAnonymousAnalyticsEnabled(enabled: boolean): Promise<void> {
  await setLocalValue(anonymousAnalyticsEnabledKey, String(enabled));
}

export async function deleteAnonymousAnalyticsPreference(): Promise<void> {
  await deleteLocalValue(anonymousAnalyticsEnabledKey);
}
