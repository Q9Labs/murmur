// The answers to "What did you use Murmur for?" match the session insight `setting` values.
export const usageChoices = [
  { label: "Conference", value: "conference" },
  { label: "Lecture", value: "lecture" },
  { label: "Travel", value: "travel" },
  { label: "Business meeting", value: "business_meeting" },
  { label: "Medical", value: "medical" },
  { label: "Legal", value: "legal" },
  { label: "Education", value: "education" },
  { label: "Religious", value: "religious" },
  { label: "TV, video or radio", value: "media" },
  { label: "Family and friends", value: "family_social" },
  { label: "Customer service", value: "customer_service" },
  { label: "Other", value: "other" },
] as const;

export type UsageSetting = (typeof usageChoices)[number]["value"];

