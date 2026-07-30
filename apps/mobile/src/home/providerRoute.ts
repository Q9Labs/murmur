export function getLatestProviderRoute(
  spans: Array<{ provider_metadata: Record<string, unknown> | null }>,
): string | null {
  for (const span of [...spans].reverse()) {
    const metadata = span.provider_metadata;
    if (!metadata) {
      continue;
    }
    const provider = typeof metadata.provider === "string" ? metadata.provider : "provider";
    const model = typeof metadata.model === "string" ? metadata.model : null;
    if (model) {
      return `${provider}:${model}`;
    }
  }
  return null;
}
