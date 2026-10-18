import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkerWebSocket } from "../http/response";
import { captionStallTimeoutMs, captionResponseTimeoutMs, createCaptionRecovery } from "./captionRecovery";

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

function fixture(open = vi.fn<(signal: AbortSignal) => Promise<WorkerWebSocket>>(async () => socket())) {
  const initial = socket();
  const callbacks = { onCaption: vi.fn(), onRetry: vi.fn(), onRecovered: vi.fn(), onRetryFailure: vi.fn(),
    onConnectedSeconds: vi.fn(), onReplacement: vi.fn(), onExhausted: vi.fn(), onConnection: vi.fn(), onConnectionCaption: vi.fn(), onConnectionFailure: vi.fn(), onInput: vi.fn(), retire: vi.fn() };
  const recovery = createCaptionRecovery({ initial, open, ...callbacks });
  return { initial, open, recovery, ...callbacks };
}
function fixtureWithSides() {
  const sides = [socket(), socket(), socket()];
  let index = 0;
  return { sides, f: fixture(vi.fn(async () => sides[index++])) };
}
async function captionedSides(delta: string) {
  const value = fixtureWithSides();
  value.f.recovery.sendAudio(new ArrayBuffer(4800), true); value.f.recovery.outputAudio();
  await vi.advanceTimersByTimeAsync(captionStallTimeoutMs + 100);
  transcript(value.sides[0], delta);
  return value;
}
async function stalledSide() {
  const side = socket(), f = fixture(vi.fn(async () => side));
  f.recovery.sendAudio(new ArrayBuffer(4800), true);f.recovery.outputAudio();
  await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
  return { side, f };
}
function transcript(value: WorkerWebSocket, delta: string): void {
  value.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ type: "session.output_transcript.delta", delta }) }));
}
afterEach(() => { vi.useRealTimers(); });

describe("caption-only recovery", () => {
  it("does not retry silence or a healthy late original caption", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.recovery.sendAudio(new ArrayBuffer(4800), true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(f.open).not.toHaveBeenCalled();
    f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(2500);
    f.recovery.originalCaption({ kind: "translation_delta", delta: "late healthy" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.open).not.toHaveBeenCalled();
    expect(f.onRecovered).not.toHaveBeenCalled();
    f.recovery.stop();
  });
  it("keeps the original input uninterrupted during connect, replay and fan-out", async () => {
    vi.useFakeTimers();
    const pending = pendingSocket(), side = socket();
    const f = fixture(vi.fn(() => pending.promise));
    const frame = (byte: number) => new Uint8Array(4800).fill(byte).buffer;
    f.recovery.sendAudio(frame(1), true); f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
    f.recovery.sendAudio(frame(2), true);pending.resolve(side);
    await vi.advanceTimersByTimeAsync(0);
    f.recovery.sendAudio(frame(3), true);
    await vi.advanceTimersByTimeAsync(100);
    f.recovery.sendAudio(frame(4), true);
    const markers = (value: WorkerWebSocket) => vi.mocked(value.send).mock.calls.map(([m]) => atob(JSON.parse(String(m)).audio).charCodeAt(0));
    expect(markers(f.initial)).toEqual([1, 2, 3, 4]);
    expect(markers(side)).toEqual([1, 2, 3, 4]);
    expect(f.retire).not.toHaveBeenCalledWith(f.initial);
    f.recovery.stop();
  });
  it("paces replay at four times real time and drops all side audio", async () => {
    vi.useFakeTimers();
    const side = socket(), f = fixture(vi.fn(async () => side));
    f.recovery.sendAudio(new ArrayBuffer(48_000), true);f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
    expect(side.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(24);expect(side.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);expect(side.send).toHaveBeenCalledTimes(2);
    side.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ type: "session.output_audio.delta", delta: btoa("audio") }) }));
    expect(f.onCaption).not.toHaveBeenCalled();
    f.recovery.stop();
  });
  it("retries a completely silent side connection from its connect deadline", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.recovery.sendAudio(new ArrayBuffer(48_000), true);f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs + captionResponseTimeoutMs + 250);
    expect(f.open).toHaveBeenCalledTimes(2);
    expect(f.onConnectionFailure).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.open).toHaveBeenCalledTimes(3);
    expect(f.onExhausted).toHaveBeenCalledOnce();
    f.recovery.sendAudio(new ArrayBuffer(4800), true);
    expect(f.initial.send).toHaveBeenCalledTimes(2);
    expect(f.onRecovered).not.toHaveBeenCalled();
    f.recovery.originalCaption({ kind: "translation_delta", delta: "original after failed recovery" });
    expect(f.onCaption.mock.calls.at(-1)?.[0].delta).toBe("original after failed recovery");
    f.recovery.stop();
  });
  it("lets the late original win, cancelling side captions without claiming recovery", async () => {
    vi.useFakeTimers();
    const { side, f } = await stalledSide();
    f.recovery.originalCaption({ kind: "translation_delta", delta: "original" });
    transcript(side, "replay");
    f.recovery.originalCaption({ kind: "translation_delta", delta: " original continued" });
    expect(f.onCaption.mock.calls.map(([e]) => e.delta)).toEqual(["original", " original continued"]);expect(f.onRecovered).not.toHaveBeenCalled();
    expect(f.retire).toHaveBeenCalledWith(side);
    f.recovery.stop();
  });
  it("keeps recovery as the caption source when the original is late", async () => {
    vi.useFakeTimers();
    const { side, f } = await stalledSide();
    transcript(side, "recovered");
    f.recovery.originalCaption({ kind: "translation_delta", delta: "duplicate original" });
    transcript(side, " continued");
    expect(f.onCaption.mock.calls.map(([e]) => e.delta)).toEqual(["recovered", " continued"]);
    expect(f.onRecovered).toHaveBeenCalledOnce();expect(f.onConnectionCaption).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);expect(f.open).toHaveBeenCalledOnce();
    f.recovery.stop();
  });
  it("does not let 31 seconds of input or buffer eviction cancel the second attempt", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.recovery.sendAudio(new ArrayBuffer(4800), true);f.recovery.outputAudio();
    for (let i = 0; i < 61; i++) { f.recovery.sendAudio(new ArrayBuffer(48_000), true); await vi.advanceTimersByTimeAsync(1000); }
    expect(f.open).toHaveBeenCalledTimes(3);
    expect(f.onConnectionFailure).toHaveBeenCalledTimes(3);
    expect(f.initial.send).toHaveBeenCalledTimes(62);
    expect(f.retire).not.toHaveBeenCalledWith(f.initial);
    f.recovery.stop();
  });
  it("keeps the pending caption deadline when a burst evicts buffered input", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.recovery.sendAudio(new ArrayBuffer(4800), true);f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
    for (let i = 0; i < 61; i++) f.recovery.sendAudio(new ArrayBuffer(48_000), true);
    await vi.advanceTimersByTimeAsync(captionResponseTimeoutMs + 25);
    expect(f.open).toHaveBeenCalledTimes(2);
    expect(f.initial.send).toHaveBeenCalledTimes(62);
    expect(f.onConnectionFailure).toHaveBeenCalledOnce();
    f.recovery.stop();
  });
  it("caps failed connects, and retires a pending socket when the original wins", async () => {
    vi.useFakeTimers();
    const f = fixture(vi.fn(async () => { throw new Error("provider unavailable"); }));
    f.recovery.sendAudio(new ArrayBuffer(4800), true);f.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(30_000);expect(f.open).toHaveBeenCalledTimes(3);
    f.recovery.stop();
    const pending = pendingSocket(), side = socket(), late = fixture(vi.fn(() => pending.promise));
    late.recovery.sendAudio(new ArrayBuffer(4800), true);late.recovery.outputAudio();
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
    late.recovery.originalCaption({ kind: "translation_delta", delta: "original wins while connecting" });pending.resolve(side);
    await vi.advanceTimersByTimeAsync(0);
    expect(late.retire).toHaveBeenCalledWith(side);expect(late.onRecovered).not.toHaveBeenCalled();late.recovery.stop();
  });
  it("preserves every whitespace delta after either source wins", async () => {
    vi.useFakeTimers();
    const original = fixture();
    for (const delta of ["hello", " ", "world", "\n", "next"]) original.recovery.originalCaption({ kind: "translation_delta", delta: delta });
    expect(original.onCaption.mock.calls.map(([e]) => e.delta)).toEqual(["hello", " ", "world", "\n", "next"]);
    original.recovery.stop();
    const { side, f } = await stalledSide();
    for (const delta of ["hello", " ", "world", "\n", "next"]) transcript(side, delta);
    expect(f.onCaption.mock.calls.map(([e]) => e.delta)).toEqual(["hello", " ", "world", "\n", "next"]);
    f.recovery.stop();
  });
  it("replaces a failed winner without falling back to the original", async () => {
    vi.useFakeTimers();
    const { sides, f } = await captionedSides("first sentence.");
    f.recovery.originalCaption({ kind: "translation_delta", delta: "different original" });
    sides[0].dispatchEvent(new Event("close"));
    await vi.advanceTimersByTimeAsync(100);
    transcript(sides[1], "first sentence.");transcript(sides[1], " next");
    f.recovery.originalCaption({ kind: "translation_delta", delta: " late original" });
    expect(f.onCaption.mock.calls.map(([e]) => e.delta)).toEqual(["first sentence.", "first sentence.", " next"]);
    expect(f.onReplacement).toHaveBeenCalledWith(1);
    f.recovery.stop();
    expect(f.onConnectedSeconds.mock.calls.reduce((sum, [n]) => sum + n, 0)).toBeCloseTo(0.2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("forwards overlap captions unchanged instead of matching independent translations", async () => {
    vi.useFakeTimers();
    const side = socket(), f = fixture(vi.fn(async () => side));
    f.recovery.originalCaption({ kind: "translation_delta", delta: "closes at five", provider_event_id: "valid-provider-event" });
    f.recovery.outputAudio();
    for (let i = 0; i < 10; i++) { f.recovery.sendAudio(new ArrayBuffer(4800), true); await vi.advanceTimersByTimeAsync(1000); f.recovery.outputAudio(); }
    await vi.advanceTimersByTimeAsync(0);
    for (const delta of ["closes", " ", "at five", " shuts at 5 p.m."]) transcript(side, delta);
    expect(f.onCaption.mock.calls.map(([e]) => e.delta)).toEqual(["closes at five", "closes", " ", "at five", " shuts at 5 p.m."]);
    expect(f.onRecovered).toHaveBeenCalledOnce();
    f.recovery.stop();
  });
  it("does not retry idle silence or trailing playback after a caption", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.recovery.sendAudio(new ArrayBuffer(4800), true);
    f.recovery.originalCaption({ kind: "translation_delta", delta: "healthy original" });
    for (let i = 0; i < 6; i++) {
      f.recovery.outputAudio();
      f.recovery.sendAudio(new ArrayBuffer(4800), false);
      await vi.advanceTimersByTimeAsync(11_000);
    }
    expect(f.open).not.toHaveBeenCalled();
    f.recovery.sendAudio(new ArrayBuffer(4800), true);
    await vi.advanceTimersByTimeAsync(captionStallTimeoutMs - 1);
    expect(f.open).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.open).toHaveBeenCalledOnce();
    f.recovery.stop();
  });
  it.each(["original", "winner"])("recovers unanswered short bursts from the %s source across pauses", async (source) => {
    vi.useFakeTimers();
    const { sides, f } = fixtureWithSides();
    if (source === "winner") {
      f.recovery.sendAudio(new ArrayBuffer(4800), true); f.recovery.outputAudio();
      await vi.advanceTimersByTimeAsync(captionStallTimeoutMs);
      transcript(sides[0], "healthy winner");
    } else f.recovery.originalCaption({ kind: "translation_delta", delta: "healthy original" });
    await vi.advanceTimersByTimeAsync(11_000);
    expect(f.open).toHaveBeenCalledTimes(source === "winner" ? 1 : 0);
    for (let burst = 0; burst < 6; burst++) {
      for (let second = 0; second < 5; second++) {
        f.recovery.sendAudio(new ArrayBuffer(48_000), true); f.recovery.outputAudio();
        await vi.advanceTimersByTimeAsync(1000);
      }
      await vi.advanceTimersByTimeAsync(11_000);
    }
    expect(f.open).toHaveBeenCalledTimes(3);
    expect(f.onExhausted).toHaveBeenCalledOnce();
    if (source === "winner") {
      f.recovery.originalCaption({ kind: "translation_delta", delta: "must not return" });
      expect(f.onCaption.mock.calls.map(([event]) => event.delta)).toEqual(["healthy winner"]);
    }
    f.recovery.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("replays exactly the last 15 seconds after a 70-second captioned winner", async () => {
    vi.useFakeTimers();
    const { sides, f } = await captionedSides("winner");
    for (let second = 0; second < 70; second++) {
      f.recovery.sendAudio(new Uint8Array(48_000).fill(second + 1).buffer, true);
      transcript(sides[0], "caption " + second);
      await vi.advanceTimersByTimeAsync(1000);
    }
    sides[0].dispatchEvent(new Event("close"));
    await vi.advanceTimersByTimeAsync(4000);
    const messages = vi.mocked(sides[1].send).mock.calls.map(([message]) => atob(JSON.parse(String(message)).audio));
    expect(messages.reduce((bytes, message) => bytes + message.length, 0)).toBe(15 * 48_000);
    expect([...new Set(messages.map((message) => message.charCodeAt(0)))]).toEqual(Array.from({ length: 15 }, (_, i) => i + 56));
    f.recovery.stop();
  });
  it("keeps fan-out alive past 120 seconds of input", async () => {
    vi.useFakeTimers();
    const { side, f } = await stalledSide();
    transcript(side, "first sentence.");
    await vi.advanceTimersByTimeAsync(100);
    for (let i = 0; i < 180; i++) f.recovery.sendAudio(new ArrayBuffer(48_000), true);
    transcript(side, " still captioning");
    expect(f.onInput.mock.calls.reduce((sum, [n]) => sum + n, 0)).toBe(180 * 48_000 + 4800);
    expect(f.retire).not.toHaveBeenCalledWith(side);
    expect(f.onCaption.mock.calls.at(-1)?.[0].delta).toBe(" still captioning");
    f.recovery.stop();
  });
});
