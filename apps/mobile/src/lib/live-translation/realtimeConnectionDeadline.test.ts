import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getGracefulSessionStopDelay,
  realtimeConnectionTimeoutMs,
  scheduleRealtimeConnectionDeadline,
} from "./realtimeConnectionDeadline";

afterEach(() => {
  vi.useRealTimers();
});

describe("realtime connection deadline", () => {
  it("stops before the Worker session expiry", () => {
    expect(getGracefulSessionStopDelay(20_000, 5_000)).toBe(13_000);
    expect(getGracefulSessionStopDelay(5_000, 5_000)).toBe(0);
  });

  it("fails a connection that never opens", () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();

    scheduleRealtimeConnectionDeadline(onTimeout);
    vi.advanceTimersByTime(realtimeConnectionTimeoutMs);

    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("can be cancelled after the connection opens", () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();

    const cancel = scheduleRealtimeConnectionDeadline(onTimeout);
    cancel();
    vi.advanceTimersByTime(realtimeConnectionTimeoutMs);

    expect(onTimeout).not.toHaveBeenCalled();
  });
});
