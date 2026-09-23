export const insightSettings = [
  "conference", "lecture", "travel", "business_meeting", "medical", "legal",
  "education", "religious", "media", "family_social", "customer_service", "other",
] as const;

export type InsightSetting = (typeof insightSettings)[number];

export function isInsightSetting(value: unknown): value is InsightSetting {
  return typeof value === "string" && insightSettings.some((setting) => setting === value);
}
