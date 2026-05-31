import type { TranslationRequest } from "./transport/types";

export type ContinuousTranslationQueueItem = {
  available_at_ms: number;
  queued_at_ms: number;
  request: TranslationRequest;
  retry_count: number;
  sent_at_ms: number | null;
  span_key: string;
};

export type ContinuousTranslationReadyItem = ContinuousTranslationQueueItem & {
  queue_wait_ms: number;
};

export type ContinuousTranslationSchedulerOptions = {
  max_attempts: number;
  max_in_flight: number;
  retry_delays_ms: number[];
};

export type ContinuousTranslationSchedulerItemSnapshot = {
  active_ms: number | null;
  available_in_ms: number;
  client_request_id: string | null;
  queued_for_ms: number;
  retry_count: number;
  source_caption: string;
  source_status: string | null;
  span_id: string;
  span_key: string;
  translation_attempt: number;
};

export type ContinuousTranslationSchedulerSnapshot = {
  counts: {
    in_flight: number;
    queued: number;
  };
  in_flight: ContinuousTranslationSchedulerItemSnapshot[];
  queued: ContinuousTranslationSchedulerItemSnapshot[];
};

export type ContinuousTranslationStaleItem = ContinuousTranslationQueueItem & {
  active_ms: number;
};

export type ContinuousTranslationRetryResult =
  | {
      exhausted: false;
      item: ContinuousTranslationQueueItem;
      retry_delay_ms: number;
    }
  | {
      exhausted: true;
      item: ContinuousTranslationQueueItem | null;
      retry_delay_ms: null;
    };

const defaultOptions: ContinuousTranslationSchedulerOptions = {
  max_attempts: 3,
  max_in_flight: 2,
  retry_delays_ms: [500, 1000, 2000],
};

export class ContinuousTranslationScheduler {
  private readonly options: ContinuousTranslationSchedulerOptions;
  private readonly inFlight = new Map<string, ContinuousTranslationQueueItem>();
  private queue: ContinuousTranslationQueueItem[] = [];

  constructor(options: Partial<ContinuousTranslationSchedulerOptions> = {}) {
    this.options = {
      ...defaultOptions,
      ...options,
      retry_delays_ms: options.retry_delays_ms ?? defaultOptions.retry_delays_ms,
    };
  }

  enqueue(request: TranslationRequest, spanKey: string, nowMs = Date.now()): ContinuousTranslationQueueItem {
    const item: ContinuousTranslationQueueItem = {
      available_at_ms: nowMs,
      queued_at_ms: nowMs,
      request,
      retry_count: Math.max(0, request.translation_attempt - 1),
      sent_at_ms: null,
      span_key: spanKey,
    };
    this.queue.push(item);
    return item;
  }

  nextReady(nowMs = Date.now()): ContinuousTranslationReadyItem | null {
    if (this.inFlight.size >= this.options.max_in_flight) {
      return null;
    }
    const item = this.queue[0];
    if (!item || item.available_at_ms > nowMs) {
      return null;
    }
    this.queue.shift();
    const inFlightItem = {
      ...item,
      sent_at_ms: nowMs,
    };
    this.inFlight.set(item.span_key, inFlightItem);
    return {
      ...inFlightItem,
      queue_wait_ms: Math.max(0, nowMs - item.queued_at_ms),
    };
  }

  complete(spanKey: string): ContinuousTranslationQueueItem | null {
    const item = this.inFlight.get(spanKey) ?? null;
    this.inFlight.delete(spanKey);
    return item;
  }

  fail(spanKey: string, retryable: boolean, nowMs = Date.now()): ContinuousTranslationRetryResult {
    const item = this.inFlight.get(spanKey) ?? null;
    this.inFlight.delete(spanKey);
    if (!item || !retryable || item.request.translation_attempt >= this.options.max_attempts) {
      return { exhausted: true, item, retry_delay_ms: null };
    }

    const retryDelayMs = this.retryDelayFor(item.retry_count);
    const retryItem: ContinuousTranslationQueueItem = {
      available_at_ms: nowMs + retryDelayMs,
      queued_at_ms: nowMs,
      request: {
        ...item.request,
        translation_attempt: item.request.translation_attempt + 1,
      },
      retry_count: item.retry_count + 1,
      sent_at_ms: null,
      span_key: item.span_key,
    };
    this.queue.push(retryItem);
    return { exhausted: false, item: retryItem, retry_delay_ms: retryDelayMs };
  }

  prependSourceToNextQueued(prefix: string): ContinuousTranslationQueueItem | null {
    const item = this.queue[0];
    const normalizedPrefix = prefix.trim().replace(/\s+/g, " ");
    if (!item || !normalizedPrefix) {
      return null;
    }
    item.request = {
      ...item.request,
      source_caption: [normalizedPrefix, item.request.source_caption.trim()]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " "),
    };
    return item;
  }

  requeueInFlight(nowMs = Date.now()): ContinuousTranslationQueueItem[] {
    const active = [...this.inFlight.values()];
    this.inFlight.clear();
    const requeued = active
      .filter((item) => item.request.translation_attempt < this.options.max_attempts)
      .map((item) => ({
        available_at_ms: nowMs,
        queued_at_ms: nowMs,
        request: {
          ...item.request,
          translation_attempt: item.request.translation_attempt + 1,
        },
        retry_count: item.retry_count + 1,
        sent_at_ms: null,
        span_key: item.span_key,
      }));
    this.queue = [...requeued, ...this.queue];
    return requeued;
  }

  nextDelayMs(nowMs = Date.now()): number | null {
    if (this.inFlight.size >= this.options.max_in_flight) {
      return null;
    }
    const item = this.queue[0];
    if (!item) {
      return null;
    }
    return Math.max(0, item.available_at_ms - nowMs);
  }

  counts(): { in_flight: number; queued: number } {
    return {
      in_flight: this.inFlight.size,
      queued: this.queue.length,
    };
  }

  clear(): void {
    this.inFlight.clear();
    this.queue = [];
  }

  staleInFlight(timeoutMs: number, nowMs = Date.now()): ContinuousTranslationStaleItem[] {
    return [...this.inFlight.values()]
      .map((item) => ({
        ...item,
        active_ms: item.sent_at_ms === null ? 0 : Math.max(0, nowMs - item.sent_at_ms),
      }))
      .filter((item) => item.active_ms >= timeoutMs);
  }

  snapshot(nowMs = Date.now()): ContinuousTranslationSchedulerSnapshot {
    return {
      counts: this.counts(),
      in_flight: [...this.inFlight.values()].map((item) => snapshotItem(item, nowMs)),
      queued: this.queue.map((item) => snapshotItem(item, nowMs)),
    };
  }

  private retryDelayFor(retryCount: number): number {
    return this.options.retry_delays_ms[
      Math.min(retryCount, this.options.retry_delays_ms.length - 1)
    ] ?? 0;
  }
}

function snapshotItem(
  item: ContinuousTranslationQueueItem,
  nowMs: number,
): ContinuousTranslationSchedulerItemSnapshot {
  return {
    active_ms: item.sent_at_ms === null ? null : Math.max(0, nowMs - item.sent_at_ms),
    available_in_ms: Math.max(0, item.available_at_ms - nowMs),
    client_request_id: item.request.client_request_id ?? null,
    queued_for_ms: Math.max(0, nowMs - item.queued_at_ms),
    retry_count: item.retry_count,
    source_caption: item.request.source_caption,
    source_status: item.request.source_status ?? null,
    span_id: item.request.span_id,
    span_key: item.span_key,
    translation_attempt: item.request.translation_attempt,
  };
}
