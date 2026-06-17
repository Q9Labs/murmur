import { describe, expect, it, vi } from "vitest";

import {
  abortAll,
  closeSocket,
  corsHeaders,
  json,
  send,
  type WorkerWebSocket,
} from "./response";

vi.stubGlobal("WebSocket", { CLOSED: 3, CONNECTING: 0, OPEN: 1 });

describe("worker response helpers", () => {
  it("serializes JSON responses with CORS headers", async () => {
    const response = json({ ok: true }, 202);

    expect(response.status).toBe(202);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(corsHeaders["Access-Control-Allow-Origin"]);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("sends JSON payloads only to open worker sockets", () => {
    const openSocket = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WorkerWebSocket;
    const closedSocket = {
      readyState: WebSocket.CLOSED,
      send: vi.fn(),
    } as unknown as WorkerWebSocket;

    send(openSocket, { kind: "ok" });
    send(closedSocket, { kind: "ignored" });

    expect(openSocket.send).toHaveBeenCalledWith(JSON.stringify({ kind: "ok" }));
    expect(closedSocket.send).not.toHaveBeenCalled();
  });

  it("closes open or connecting sockets and aborts tracked requests", () => {
    const openSocket = {
      close: vi.fn(),
      readyState: WebSocket.OPEN,
    } as unknown as WebSocket;
    const closedSocket = {
      close: vi.fn(),
      readyState: WebSocket.CLOSED,
    } as unknown as WebSocket;
    const request = new AbortController();
    const requests = new Map([["request_1", request]]);

    closeSocket(openSocket, 1000, "done");
    closeSocket(closedSocket, 1000, "done");
    abortAll(requests);

    expect(openSocket.close).toHaveBeenCalledWith(1000, "done");
    expect(closedSocket.close).not.toHaveBeenCalled();
    expect(request.signal.aborted).toBe(true);
    expect(requests.size).toBe(0);
  });
});
