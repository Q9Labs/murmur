export type LatencySample = {
  name: string;
  value_ms: number;
};

export type DebugLogLevel = "debug" | "error" | "info" | "warn";

export type DiagnosticJsonValue =
  | DiagnosticJsonValue[]
  | boolean
  | null
  | number
  | string
  | { [key: string]: DiagnosticJsonValue };

export type DebugLogEntry = {
  at_ms: number;
  data?: Record<string, DiagnosticJsonValue>;
  level: DebugLogLevel;
  message: string;
  name: string;
};

export type LatencyPercentiles = {
  count: number;
  p50_ms: number | null;
  p90_ms: number | null;
  p95_ms: number | null;
};

export type LatencyReport = Record<string, LatencyPercentiles>;

export type LatencyEvidenceMetadata = {
  app_session_id?: string;
  device_class: string;
  generated_at_ms: number;
  network_type: string;
  platform: string;
  provider_route: string;
  source_language: string;
  target_language: string;
};

export type LatencyEvidenceReport = {
  debug_log?: DebugLogEntry[];
  diagnostics?: Record<string, DiagnosticJsonValue>;
  metadata: LatencyEvidenceMetadata;
  samples: LatencySample[];
  summary: LatencyReport;
};

export function percentile(values: number[], percentileRank: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

export function summarizeLatency(samples: LatencySample[]): LatencyReport {
  const groups = new Map<string, number[]>();
  for (const sample of samples) {
    const current = groups.get(sample.name) ?? [];
    current.push(sample.value_ms);
    groups.set(sample.name, current);
  }

  return Object.fromEntries(
    [...groups.entries()].map(([name, values]) => [
      name,
      {
        count: values.length,
        p50_ms: percentile(values, 50),
        p90_ms: percentile(values, 90),
        p95_ms: percentile(values, 95),
      },
    ]),
  );
}

export function formatLatencyPercentiles(
  percentiles: LatencyPercentiles | null | undefined,
): string {
  if (!percentiles || percentiles.count === 0) {
    return "n/a";
  }

  return [
    `n=${percentiles.count}`,
    `p50 ${formatLatencyValue(percentiles.p50_ms)}`,
    `p90 ${formatLatencyValue(percentiles.p90_ms)}`,
    `p95 ${formatLatencyValue(percentiles.p95_ms)}`,
  ].join(" / ");
}

export function buildLatencyEvidenceReport(params: {
  debugLog?: DebugLogEntry[];
  diagnostics?: Record<string, DiagnosticJsonValue>;
  metadata: Omit<LatencyEvidenceMetadata, "generated_at_ms"> & {
    generated_at_ms?: number;
  };
  samples: LatencySample[];
}): LatencyEvidenceReport {
  return {
    debug_log: params.debugLog,
    diagnostics: params.diagnostics,
    metadata: {
      ...params.metadata,
      generated_at_ms: params.metadata.generated_at_ms ?? Date.now(),
    },
    samples: params.samples,
    summary: summarizeLatency(params.samples),
  };
}

export function formatLatencyEvidenceReport(report: LatencyEvidenceReport): string {
  const lines = [
    "Murmur latency evidence",
    `generated_at_ms: ${report.metadata.generated_at_ms}`,
    `app_session_id: ${report.metadata.app_session_id ?? "n/a"}`,
    `language_pair: ${report.metadata.source_language}->${report.metadata.target_language}`,
    `platform: ${report.metadata.platform}`,
    `device_class: ${report.metadata.device_class}`,
    `network_type: ${report.metadata.network_type}`,
    `provider_route: ${report.metadata.provider_route}`,
    "",
    "summary:",
  ];

  for (const [name, percentiles] of Object.entries(report.summary).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    lines.push(`- ${name}: ${formatLatencyPercentiles(percentiles)}`);
  }

  lines.push("", `sample_count: ${report.samples.length}`);
  if (report.samples.length > 0) {
    lines.push("", "samples:");
    for (const sample of report.samples) {
      lines.push(`- ${sample.name}: ${Math.round(sample.value_ms)}ms`);
    }
  }

  if (report.diagnostics) {
    lines.push("", "diagnostics_json:", JSON.stringify(report.diagnostics, null, 2));
  }

  const debugLog = report.debug_log ?? [];
  lines.push("", `debug_log_count: ${debugLog.length}`);
  if (debugLog.length > 0) {
    lines.push("", "debug_log:");
    for (const entry of debugLog) {
      const data = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
      lines.push(
        `- ${new Date(entry.at_ms).toISOString()} [${entry.level}] ${entry.name}: ${entry.message}${data}`,
      );
    }
  }
  return lines.join("\n");
}

function formatLatencyValue(value: number | null): string {
  return typeof value === "number" ? `${Math.round(value)}ms` : "n/a";
}
