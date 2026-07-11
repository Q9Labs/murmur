/// <reference types="@cloudflare/workers-types" />

import {
  autoSourceLanguageCode,
  getLanguage,
  isSourceLanguageCode,
  type SourceLanguageCode,
} from "@murmur/protocol/languages";
import type { Env } from "../env";
import {
  closeSocket,
  type WorkerResponseInit,
  type WorkerWebSocket,
} from "../http/response";
import {
  getSessionDurable,
} from "../rateLimitDurableObject";
import { getDeepgramApiKey } from "../providers/credentials";

declare const WebSocketPair: {
  new (): { 0: WorkerWebSocket; 1: WorkerWebSocket };
};

export function connectDeepgramSocket(request: Request, env: Env): Response {
  const clientUrl = new URL(request.url);
  const appSessionId = clientUrl.searchParams.get("app_session_id") ?? "";
  const sourceLanguage = clientUrl.searchParams.get("source_language") ?? "";

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  server.binaryType = "arraybuffer";

  void proxyDeepgramSession({
    app_session_id: appSessionId,
    env,
    server,
    source_language: sourceLanguage,
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  } as WorkerResponseInit);
}

async function proxyDeepgramSession(params: {
  app_session_id: string;
  env: Env;
  server: WorkerWebSocket;
  source_language: string;
}): Promise<void> {
  const deepgramApiKey = getDeepgramApiKey(params.env);
  if (!deepgramApiKey) {
    closeSocket(params.server, 1011, "deepgram_unconfigured");
    return;
  }
  if (!params.app_session_id || !isSourceLanguageCode(params.source_language)) {
    closeSocket(params.server, 1008, "invalid_deepgram_proxy_request");
    return;
  }

  const session = await getSessionDurable({
    app_session_id: params.app_session_id,
    namespace: params.env.RATE_LIMITER,
  });
  if (!session || session.closed_at_ms !== null) {
    closeSocket(params.server, 1008, "session_closed");
    return;
  }

  const upstream = new WebSocket(buildDeepgramListenUrl(params.source_language), [
    "token",
    deepgramApiKey,
  ]);
  upstream.binaryType = "arraybuffer";
  const pendingClientMessages: Array<string | ArrayBuffer> = [];

  params.server.addEventListener("message", (event: MessageEvent) => {
    if (event.data instanceof Blob) {
      void event.data.arrayBuffer().then((data) => {
        sendDeepgramClientMessage(upstream, pendingClientMessages, data);
      });
      return;
    }
    if (typeof event.data === "string" || event.data instanceof ArrayBuffer) {
      sendDeepgramClientMessage(upstream, pendingClientMessages, event.data);
    }
  });
  params.server.addEventListener("close", () => {
    closeSocket(upstream, 1000, "client_close");
  });
  params.server.addEventListener("error", () => {
    closeSocket(upstream, 1011, "client_error");
  });

  upstream.addEventListener("open", () => {
    for (const message of pendingClientMessages.splice(0)) {
      upstream.send(message);
    }
    params.server.send(JSON.stringify({ type: "MurmurDeepgramProxyOpen" }));
  });
  upstream.addEventListener("message", (event: MessageEvent) => {
    if (params.server.readyState === WebSocket.OPEN) {
      params.server.send(event.data);
    }
  });
  upstream.addEventListener("close", () => {
    closeSocket(params.server, 1000, "deepgram_close");
  });
  upstream.addEventListener("error", () => {
    closeSocket(params.server, 1011, "deepgram_error");
  });
}

function sendDeepgramClientMessage(
  upstream: WebSocket,
  pendingClientMessages: Array<string | ArrayBuffer>,
  message: string | ArrayBuffer,
): void {
  if (upstream.readyState === WebSocket.OPEN) {
    upstream.send(message);
    return;
  }
  if (pendingClientMessages.length < 50) {
    pendingClientMessages.push(message);
  }
}

export function buildDeepgramListenUrl(sourceLanguage: SourceLanguageCode): string {
  const deepgramLanguage =
    sourceLanguage === autoSourceLanguageCode ? "multi" : getLanguage(sourceLanguage).deepgram_language;
  const params = new URLSearchParams({
    model: "nova-3",
    encoding: "linear16",
    sample_rate: "16000",
    channels: "1",
    interim_results: "true",
    punctuate: "true",
    smart_format: "true",
    vad_events: "true",
    endpointing: "300",
    utterance_end_ms: "1000",
    language: deepgramLanguage,
  });
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}
