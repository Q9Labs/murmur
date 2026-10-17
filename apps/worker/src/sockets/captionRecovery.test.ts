import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkerWebSocket } from "../http/response";
import { captionStallTimeoutMs, createCaptionRecovery } from "./captionRecovery";

function socket() {
  const value = new EventTarget();
  return Object.assign(value, {
    send: vi.fn<(data: string) => void>(),
    close: vi.fn(), accept: vi.fn(), readyState: 1, binaryType: "arraybuffer",
  }) as unknown as WorkerWebSocket;
}

function pendingSocket() {
  let resolve = (_socket: WorkerWebSocket): void => { throw new Error("promise not initialized"); };
  const promise = new Promise<WorkerWebSocket>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function fixture(open = vi.fn<(signal: AbortSignal) => Promise<WorkerWebSocket>>()) {
  const initial = socket();
  const activate = vi.fn<(value: WorkerWebSocket) => void>();
  const retire = vi.fn<(value: WorkerWebSocket) => void>();
  const onRetry = vi.fn();
  const onRecovered = vi.fn();
  const onReplayFailure = vi.fn();
  const onRetryFailure = vi.fn();
  const recovery = createCaptionRecovery({
    initial, open, activate, retire, onRetry, onRecovered, onReplayFailure, onRetryFailure,
  });
  return { initial, open, activate, retire, onRetry, onRecovered, onReplayFailure, onRetryFailure, recovery };
}

afterEach(() => { vi.useRealTimers(); });

describe("first-caption recovery", () => {
  it("does not retry silence or a healthy caption before the deadline", async () => {
    vi.useFakeTimers();
    const { recovery, open } = fixture();
    recovery.sendAudio(new ArrayBuffer(4800));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(open).not.toHaveBeenCalled();
    recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs - 1);
    recovery.caption();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(open).not.toHaveBeenCalled();
    recovery.stop();
  });

  it("keeps live input in order while the replacement is connecting and replaying", async () => {
    vi.useFakeTimers();
    const pending = pendingSocket();
    const f = fixture(vi.fn(() => pending.promise));
    const replacement = socket();
    const frame = (byte: number) => new Uint8Array(4800).fill(byte).buffer;
    f.recovery.sendAudio(frame(1));
    f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
    f.recovery.sendAudio(frame(2));
    pending.resolve(replacement);
    await vi.advanceTimersByTimeAsync(0);
    f.recovery.sendAudio(frame(3));
    f.recovery.caption();
    await vi.advanceTimersByTimeAsync(100);
    const messages = vi.mocked(replacement.send).mock.calls.map(([message]) => JSON.parse(String(message)));
    expect(messages.map(message => atob(message.audio).charCodeAt(0))).toEqual([1, 2, 3]);
    expect(f.retire).toHaveBeenCalledWith(f.initial);
    expect(f.onRecovered).toHaveBeenCalledOnce();
    f.recovery.stop();
  });

  it.each(["caption", "stop"] as const)("retires a late replacement after %s, without activating it", async (action) => {
    vi.useFakeTimers();
    const pending = pendingSocket();
    const f = fixture(vi.fn(() => pending.promise));
    const replacement = socket();
    f.recovery.sendAudio(new ArrayBuffer(4800));
    f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
    f.recovery[action]();
    pending.resolve(replacement);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(f.activate).not.toHaveBeenCalled();
    expect(f.retire).toHaveBeenCalledWith(replacement);
    expect(f.onRecovered).not.toHaveBeenCalled();
    expect(f.open.mock.calls[0]?.[0].aborted).toBe(true);
    expect(replacement.send).not.toHaveBeenCalled();
    f.recovery.stop();
  });

  it("caps failed handshakes and keeps the original usable", async () => {
    vi.useFakeTimers();
    const f = fixture(vi.fn(async () => { throw new Error("external handshake failed"); }));
    f.recovery.sendAudio(new ArrayBuffer(4800));
    f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.open).toHaveBeenCalledTimes(2);
    expect(f.onRetry).toHaveBeenLastCalledWith(2);
    expect(f.activate).not.toHaveBeenCalled();
    f.recovery.sendAudio(new ArrayBuffer(4800));
    expect(f.initial.send).toHaveBeenCalledTimes(2);
    f.recovery.stop();
  });

  it("retains a complete bounded prefix and paces replay at 4x", async () => {
    vi.useFakeTimers();
    const replacement = socket();
    const f = fixture(vi.fn(async () => replacement));
    for (let i = 0; i < 30; i++) f.recovery.sendAudio(new Uint8Array(48_000).fill(i).buffer);
    f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
    expect(replacement.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(24);
    expect(replacement.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(replacement.send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(7500);
    const messages = vi.mocked(replacement.send).mock.calls.map(([message]) => JSON.parse(String(message)));
    expect(messages).toHaveLength(300);
    expect(messages.reduce((sum, message) => sum + atob(message.audio).length, 0)).toBe(1_440_000);
    expect(atob(messages[0].audio).charCodeAt(0)).toBe(0);
    f.recovery.stop();
  });

  it("does not retry a healthy 2.5-second caption or call it recovered", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.recovery.sendAudio(new ArrayBuffer(4800));
    f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(2500);
    f.recovery.caption();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.open).not.toHaveBeenCalled();
    expect(f.onRecovered).not.toHaveBeenCalled();
    f.recovery.stop();
  });

  it("gives a replacement twice the floor plus its replay duration", async () => {
    vi.useFakeTimers();
    const replacement = socket();
    const f = fixture(vi.fn(async () => replacement));
    f.recovery.sendAudio(new ArrayBuffer(48_000));
    f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
    f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs + 2500);
    expect(f.open).toHaveBeenCalledOnce();
    f.recovery.caption();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.open).toHaveBeenCalledOnce();
    f.recovery.stop();
  });

  it("drops the replayed playback prefix across frame boundaries and two retries", async () => {
    vi.useFakeTimers();
    const f = fixture(vi.fn(async () => socket()));
    f.recovery.sendAudio(new ArrayBuffer(4800));
    expect(f.recovery.filterOutputAudio(new Uint8Array([1, 0, 2, 0]).buffer, true).byteLength).toBe(4);
    f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
    expect(f.recovery.filterOutputAudio(new Uint8Array([1, 0]).buffer, true).byteLength).toBe(0);
    expect([...new Uint8Array(f.recovery.filterOutputAudio(new Uint8Array([2, 0, 3, 0]).buffer, true))]).toEqual([3, 0]);
    f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs * 2 + 25);
    expect([...new Uint8Array(f.recovery.filterOutputAudio(new Uint8Array([1, 0, 2, 0, 3, 0, 4, 0]).buffer, true))]).toEqual([4, 0]);
    expect(f.open).toHaveBeenCalledTimes(2);
    f.recovery.stop();
  });

  it("does not replay a truncated history whose audible prefix cannot be aligned", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.recovery.sendAudio(new ArrayBuffer(1_440_000));
    f.recovery.outputAudio();
    f.recovery.sendAudio(new ArrayBuffer(4800));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.open).not.toHaveBeenCalled();
    expect(f.initial.send).toHaveBeenCalledTimes(2);
    f.recovery.stop();
  });

  it("retires a pending replacement if the complete replay history overflows", async () => {
    vi.useFakeTimers();
    const replacement = socket();
    const pending = pendingSocket();
    const f = fixture(vi.fn(() => pending.promise));
    f.recovery.sendAudio(new ArrayBuffer(1_440_000));
    f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
    f.recovery.sendAudio(new ArrayBuffer(4800));
    pending.resolve(replacement);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.activate).not.toHaveBeenCalled();
    expect(f.retire).toHaveBeenCalledWith(replacement);
    expect(f.onRetryFailure).not.toHaveBeenCalled();
    f.recovery.stop();
  });

  it("does not suppress recovered speech when the old output was only quiet noise", async () => {
    vi.useFakeTimers();
    const f = fixture(vi.fn(async () => socket()));
    f.recovery.sendAudio(new ArrayBuffer(4800));
    f.recovery.filterOutputAudio(new ArrayBuffer(48_000), false);
    f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
    expect(f.recovery.filterOutputAudio(new ArrayBuffer(48_000), true).byteLength).toBe(48_000);
    f.recovery.stop();
  });

});
