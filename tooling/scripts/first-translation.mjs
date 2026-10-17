import { setTimeout as sleep } from "node:timers/promises";

// cspell:ignore buenos dias

// Same PCM pacing and success criterion as the on-call robot, through the public socket.
// Keep the socket lifecycle and deadline in one proof boundary.
// fallow-ignore-next-line complexity
export async function firstTranslation({ realtimeUrl, pcm, expectedOrigin, timeoutMs = 20_000 }) {
  const url = new URL(realtimeUrl);
  if (url.origin !== expectedOrigin || url.pathname !== "/v2/realtime") throw new Error("Unexpected realtime destination");
  const socket = new WebSocket(url);
  const ready = Promise.withResolvers();
  const translated = Promise.withResolvers();
  const acknowledged = Promise.withResolvers();
  const closed = Promise.withResolvers();
  for (const pending of [ready, translated, acknowledged]) void pending.promise.catch(() => {});
  let caption = "";
  const transcriptFragments = [];
  let started;
  let firstTranslationMs;
  let acknowledgedBytes = 0;
  const fail = (message) => {
    for (const pending of [ready, translated, acknowledged]) pending.reject(new Error(message));
  };
  const timer = setTimeout(() => fail(`Translation timed out after ${timeoutMs / 1000} seconds`), timeoutMs);
  socket.addEventListener("error", () => fail("Realtime socket error"));
  socket.addEventListener("close", () => { fail("Realtime closed before completion"); closed.resolve(); });
  // Transcript events are an external protocol boundary.
  // fallow-ignore-next-line complexity
  function updateTranscript(delta) {
    if (started === undefined || typeof delta !== "string") return;
    if (firstTranslationMs === undefined && delta.trim()) firstTranslationMs = Math.round(performance.now() - started);
    transcriptFragments.push(delta);
    caption += delta;
    const normalized = caption.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    if (/\bbuenos\s+dias\b/.test(normalized)) translated.resolve();
  }
  // Validate each independent protocol event before it changes proof state.
  // fallow-ignore-next-line complexity
  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    try {
      const value = JSON.parse(event.data);
      if (value.kind === "session_opened") ready.resolve();
      if (value.kind === "error" || value.kind === "session_error") fail("Worker reported a realtime error");
      if (value.kind === "input_audio_ack") {
        acknowledgedBytes = value.bytes_received;
        if (acknowledgedBytes === pcm.length) acknowledged.resolve();
      }
      if (value.kind === "translation_delta") updateTranscript(value.delta);
    } catch { fail("Malformed Worker realtime event"); }
  });
  try {
    await ready.promise;
    started = performance.now();
    for (let offset = 0; offset < pcm.length; offset += 4800) {
      if (socket.readyState !== WebSocket.OPEN) throw new Error("Socket closed while sending speech");
      const chunk = pcm.subarray(offset, offset + 4800);
      socket.send(new Uint8Array(chunk));
      await sleep(chunk.length / 48);
    }
    await Promise.all([translated.promise, acknowledged.promise]);
    if (firstTranslationMs === undefined) throw new Error("Translation arrived without a timing sample");
    return { first_translation_ms: firstTranslationMs, acknowledged_bytes: acknowledgedBytes, caption, transcript_fragments: transcriptFragments };
  } finally {
    clearTimeout(timer);
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ kind: "close_session" }));
    await Promise.race([closed.promise, sleep(2000)]);
    if (socket.readyState !== WebSocket.CLOSED) socket.close(1000, "proof_complete");
  }
}

function stringValues(value) {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(stringValues);
}

// Scan every retained string at the transcript privacy boundary.
// fallow-ignore-next-line complexity
export function assertTranscriptAbsent(records, translation) {
  const fragments = translation.transcript_fragments.map((fragment) => fragment.trim()).filter(Boolean);
  for (const value of stringValues(records)) {
    if (value.includes(translation.caption)) throw new Error("Translation retained in complete records");
    if (fragments.some((fragment) => value.trim() === fragment || (fragment.length >= 4 && value.includes(fragment)))) {
      throw new Error("Translation fragment retained in complete records");
    }
  }
}
