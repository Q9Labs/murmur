type LegacyFlags = {
  featureFlags: { [key: string]: boolean | string };
  featureFlagPayloads?: { [key: string]: string };
};

export function posthogFlagsBody({ featureFlags, featureFlagPayloads = {} }: LegacyFlags): string {
  const flags = Object.fromEntries(Object.entries(featureFlags).map(([key, value]) => [key, {
    enabled: value !== false,
    key,
    metadata: { payload: featureFlagPayloads[key] ?? null },
    variant: typeof value === "string" ? value : null,
  }]));
  return JSON.stringify({ errorsWhileComputingFlags: false, flags });
}
