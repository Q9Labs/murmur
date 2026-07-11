import type { ContinuousMemoryState } from "../continuousMemory";
import type { ContinuousTranslationSchedulerSnapshot } from "../continuousTranslationScheduler";
import type { LiveTranslationDiagnosticsSnapshot } from "./types";

export function buildLiveTranslationDiagnosticsSnapshot(params: {
  continuousMemory: ContinuousMemoryState;
  lastCommittedSourceCaption: string | null;
  pendingWaitPrefix: string | null;
  scheduler: ContinuousTranslationSchedulerSnapshot;
  tentativeSourceCaption: string;
  translationSocketOpen: boolean;
}): LiveTranslationDiagnosticsSnapshot {
  return {
    continuous_memory: {
      memory_version: params.continuousMemory.memory_version,
      rolling_source_char_count: params.continuousMemory.rolling_memory.reduce(
        (total, span) => total + span.source_char_count,
        0,
      ),
      rolling_span_count: params.continuousMemory.rolling_memory.length,
      summary_job_running: params.continuousMemory.summary_job_running,
      summary_length: params.continuousMemory.summary.text.length,
      summary_updated_through_span_id: params.continuousMemory.summary.updated_through_span_id,
    },
    runtime: {
      last_committed_source_caption: params.lastCommittedSourceCaption,
      pending_wait_prefix: params.pendingWaitPrefix,
      tentative_source_caption: params.tentativeSourceCaption,
      translation_socket_open: params.translationSocketOpen,
    },
    translation_scheduler: params.scheduler,
  };
}
