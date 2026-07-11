/// <reference types="@cloudflare/workers-types" />

export type WorkerWebSocket = WebSocket & {
  accept(): void;
};

export type WorkerResponseInit = ResponseInit & {
  webSocket?: WorkerWebSocket;
};

export const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

export function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    status,
  });
}

export function closeSocket(socket: WebSocket, code: number, reason: string): void {
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    socket.close(code, reason);
  }
}

export function abortAll(requests: Map<string, AbortController>): void {
  for (const controller of requests.values()) {
    controller.abort();
  }
  requests.clear();
}

export function send(socket: WorkerWebSocket, payload: unknown): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}
