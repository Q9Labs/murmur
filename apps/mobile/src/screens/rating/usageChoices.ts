// The answers to "What did you use Murmur for?" match the session insight `setting` values.
export const usageChoices = [
  { labelKey: "rating.useConference", value: "conference" },
  { labelKey: "rating.useLecture", value: "lecture" },
  { labelKey: "rating.useTravel", value: "travel" },
  { labelKey: "rating.useBusinessMeeting", value: "business_meeting" },
  { labelKey: "rating.useMedical", value: "medical" },
  { labelKey: "rating.useLegal", value: "legal" },
  { labelKey: "rating.useEducation", value: "education" },
  { labelKey: "rating.useReligious", value: "religious" },
  { labelKey: "rating.useMedia", value: "media" },
  { labelKey: "rating.useFamilySocial", value: "family_social" },
  { labelKey: "rating.useCustomerService", value: "customer_service" },
  { labelKey: "rating.useOther", value: "other" },
] as const;

export type UsageSetting = (typeof usageChoices)[number]["value"];
