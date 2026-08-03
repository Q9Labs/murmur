export const acquisitionFieldNames = [
  "campaign",
  "content",
  "landing",
  "medium",
  "partner",
  "source",
] as const;

export type AcquisitionFieldName = (typeof acquisitionFieldNames)[number];
export type AcquisitionContext = Partial<Record<AcquisitionFieldName, string>>;

const acquisitionValueMaxLength = 64;

export function normalizeAcquisitionContext(value: unknown): AcquisitionContext | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: AcquisitionContext = {};
  for (const fieldName of acquisitionFieldNames) {
    const fieldValue = normalizeAcquisitionValue(value[fieldName]);
    if (fieldValue) {
      normalized[fieldName] = fieldValue;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeAcquisitionValue(value: unknown): string | undefined {
  const text = Array.isArray(value)
    ? value.find((item): item is string => typeof item === "string")
    : value;
  if (typeof text !== "string") {
    return undefined;
  }

  const normalized = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/-{2,}/g, "-")
    .slice(0, acquisitionValueMaxLength)
    .replace(/[^a-z0-9]+$/, "");

  return normalized || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
