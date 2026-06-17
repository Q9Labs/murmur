import type {
  RollingMemorySpan,
  SessionSummary,
} from "./transport/types";

const rollingMemorySourceCharLimit = 2500;
const rollingMemoryKeepRecentSourceChars = 1200;
const sessionSummaryCharLimit = 700;
const summarySourceCharLimit = 5000;
const totalTranslationContextCharLimit = 5000;

export type ContinuousMemoryState = {
  memory_version: number;
  rolling_memory: RollingMemorySpan[];
  summary: SessionSummary;
  summary_job_running: boolean;
};

export type SummarySelection = {
  keep_recent_from_span_id: string | null;
  spans_to_summarize: RollingMemorySpan[];
  summarized_through_span_id: string | null;
};

export function createContinuousMemoryState(): ContinuousMemoryState {
  return {
    memory_version: 1,
    rolling_memory: [],
    summary: {
      memory_version: 1,
      source_char_count_summarized: 0,
      text: "",
      updated_at_ms: Date.now(),
      updated_through_span_id: null,
    },
    summary_job_running: false,
  };
}

export function appendRollingMemorySpan(
  state: ContinuousMemoryState,
  span: Omit<RollingMemorySpan, "source_char_count"> & { source_char_count?: number },
): ContinuousMemoryState {
  const nextSpan = {
    ...span,
    source_char_count: span.source_char_count ?? span.source_caption.length,
  };
  return {
    ...state,
    memory_version: state.memory_version + 1,
    rolling_memory: [...state.rolling_memory, nextSpan],
  };
}

function rollingMemorySourceChars(spans: RollingMemorySpan[]): number {
  return spans.reduce((total, span) => total + span.source_char_count, 0);
}

export function shouldScheduleSummary(
  state: ContinuousMemoryState,
  sourceCharLimit = rollingMemorySourceCharLimit,
): boolean {
  return !state.summary_job_running && rollingMemorySourceChars(state.rolling_memory) > sourceCharLimit;
}

export function selectSpansForSummary(
  spans: RollingMemorySpan[],
  keepRecentSourceChars = rollingMemoryKeepRecentSourceChars,
  maxSummarySourceChars = summarySourceCharLimit,
): SummarySelection {
  let keptChars = 0;
  let keepStartIndex = spans.length;
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    keptChars += spans[index].source_char_count;
    keepStartIndex = index;
    if (keptChars >= keepRecentSourceChars) {
      break;
    }
  }

  const eligibleSpans = spans.slice(0, keepStartIndex);
  let summarizeEndIndex = 0;
  let summarizedChars = 0;
  for (const span of eligibleSpans) {
    if (
      summarizeEndIndex > 0 &&
      summarizedChars + span.source_char_count > maxSummarySourceChars
    ) {
      break;
    }
    summarizedChars += span.source_char_count;
    summarizeEndIndex += 1;
    if (summarizedChars >= maxSummarySourceChars) {
      break;
    }
  }

  const spansToSummarize = eligibleSpans.slice(0, summarizeEndIndex);
  return {
    keep_recent_from_span_id: spans[keepStartIndex]?.span_id ?? null,
    spans_to_summarize: spansToSummarize,
    summarized_through_span_id: spansToSummarize[spansToSummarize.length - 1]?.span_id ?? null,
  };
}

export function applySummaryResult(params: {
  current: ContinuousMemoryState;
  input_memory_version: number;
  summary: SessionSummary;
  summarized_through_span_id: string | null;
}): ContinuousMemoryState {
  if (params.input_memory_version !== params.current.memory_version) {
    return { ...params.current, summary_job_running: false };
  }

  const summaryText = params.summary.text.trim();
  if (!summaryText || summaryText.length > sessionSummaryCharLimit) {
    return { ...params.current, summary_job_running: false };
  }

  const removeThroughIndex = params.summarized_through_span_id
    ? params.current.rolling_memory.findIndex((span) => span.span_id === params.summarized_through_span_id)
    : -1;
  const rollingMemory =
    removeThroughIndex >= 0
      ? params.current.rolling_memory.slice(removeThroughIndex + 1)
      : params.current.rolling_memory;
  const nextMemoryVersion = params.current.memory_version + 1;
  return {
    memory_version: nextMemoryVersion,
    rolling_memory: rollingMemory,
    summary: {
      ...params.summary,
      memory_version: nextMemoryVersion,
      text: summaryText.slice(0, sessionSummaryCharLimit),
      updated_at_ms: Date.now(),
    },
    summary_job_running: false,
  };
}

export function trimRollingMemoryForPrompt(
  summary: SessionSummary,
  spans: RollingMemorySpan[],
  currentSpanSourceChars: number,
  totalCharLimit = totalTranslationContextCharLimit,
): RollingMemorySpan[] {
  const overhead = summary.text.length + currentSpanSourceChars;
  const result: RollingMemorySpan[] = [];
  let total = overhead;
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const span = spans[index];
    const spanChars = span.source_caption.length + span.translated_caption.length;
    if (total + spanChars > totalCharLimit) {
      break;
    }
    total += spanChars;
    result.unshift(span);
  }
  return result;
}
