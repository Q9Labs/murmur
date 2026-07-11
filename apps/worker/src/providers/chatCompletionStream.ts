import {
  mergeProviderMetadata,
  parseProviderChunk,
} from "./streamParsing";
import type {
  ChatCompletionPayload,
  TranslationProviderMetadata,
} from "./types";

type ProviderErrorPrefix = "groq" | "openrouter";

export type ProviderChatCompletionStreamResult = {
  provider_metadata: Partial<TranslationProviderMetadata>;
  text: string;
};

export async function readProviderChatCompletionStream(params: {
  api_key: string;
  endpoint: string;
  error_prefix: ProviderErrorPrefix;
  extra_headers: Record<string, string>;
  onDelta?: (delta: string, metadata: Partial<TranslationProviderMetadata>) => void;
  payload: ChatCompletionPayload;
  signal: AbortSignal;
  timeout_ms: number;
}): Promise<ProviderChatCompletionStreamResult> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(`${params.error_prefix}_timeout`),
    params.timeout_ms,
  );
  const fetchSignal = combineAbortSignals(params.signal, timeoutController.signal);
  const response = await fetch(params.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.api_key}`,
      "Content-Type": "application/json",
      ...params.extra_headers,
    },
    body: JSON.stringify(params.payload),
    signal: fetchSignal,
  }).catch((error) => {
    throw new Error(
      isTimeoutAbort(error, timeoutController.signal, params.error_prefix)
        ? `${params.error_prefix}_timeout`
        : `${params.error_prefix}_network_error`,
    );
  });

  try {
    if (!response.ok || !response.body) {
      throw new Error(`${params.error_prefix}_http_${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const providerMetadata: Partial<TranslationProviderMetadata> = {};
    let buffer = "";
    let text = "";

    const processLine = (line: string): boolean => {
      const data = line.trim();
      if (!data.startsWith("data:")) {
        return false;
      }
      const payload = data.slice(5).trim();
      if (payload === "[DONE]") {
        return true;
      }
      const chunk = parseProviderChunk(payload, params.error_prefix);
      mergeProviderMetadata(providerMetadata, chunk.provider_metadata);
      if (chunk.delta) {
        text += chunk.delta;
        params.onDelta?.(chunk.delta, chunk.provider_metadata);
      }
      return false;
    };

    while (true) {
      const { done, value } = await reader.read().catch((error) => {
        throw new Error(
          isTimeoutAbort(error, timeoutController.signal, params.error_prefix)
            ? `${params.error_prefix}_timeout`
            : `${params.error_prefix}_stream_read_failed`,
        );
      });
      if (timeoutController.signal.aborted) {
        throw new Error(`${params.error_prefix}_timeout`);
      }
      if (done) {
        buffer += decoder.decode();
        if (buffer.trim() && processLine(buffer)) {
          return { provider_metadata: providerMetadata, text };
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (processLine(line)) {
          return { provider_metadata: providerMetadata, text };
        }
      }
    }

    throw new Error(`${params.error_prefix}_stream_incomplete`);
  } finally {
    clearTimeout(timeoutId);
  }
}

function combineAbortSignals(first: AbortSignal, second: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };
  if (first.aborted || second.aborted) {
    abort();
  } else {
    first.addEventListener("abort", abort, { once: true });
    second.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}

function isTimeoutAbort(
  error: unknown,
  timeoutSignal: AbortSignal,
  errorPrefix: ProviderErrorPrefix,
): boolean {
  return timeoutSignal.aborted || (error instanceof Error && error.message === `${errorPrefix}_timeout`);
}
