export function getLatestProviderRoute(
  spans: Array<{ provider_metadata: Record<string, unknown> | null }>,
): string | null {
  for (const span of [...spans].reverse()) {
    const metadata = span.provider_metadata;
    if (!metadata) {
      continue;
    }
    const provider = typeof metadata.provider === "string" ? metadata.provider : "provider";
    const upstreamProvider =
      typeof metadata.upstream_provider === "string" ? metadata.upstream_provider : null;
    const upstreamModel =
      typeof metadata.upstream_model === "string" ? metadata.upstream_model : null;
    if (upstreamProvider || upstreamModel) {
      return [provider, upstreamProvider, upstreamModel].filter(Boolean).join(":");
    }
  }
  return null;
}
