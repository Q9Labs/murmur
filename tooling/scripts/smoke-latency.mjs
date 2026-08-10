#!/usr/bin/env node
// cspell:ignore Majed
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const workerUrl = process.env.MURMUR_WORKER_URL ?? "https://murmur.q9labs.ai";
const sourceLanguage = process.env.MURMUR_SOURCE_LANGUAGE ?? "en";
const targetLanguage = process.env.MURMUR_TARGET_LANGUAGE ?? "ar";
const spokenText = process.env.MURMUR_SMOKE_TEXT ?? "Hello. How are you today?";
const speechVoice = process.env.MURMUR_SAY_VOICE ?? "Samantha";
const echoText = process.env.MURMUR_SMOKE_ECHO_TEXT;
const echoVoice = process.env.MURMUR_SMOKE_ECHO_VOICE ?? "Majed";

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runSmoke();
}

async function runSmoke() {
  const pcm = createSmokePcm();
  const sessionStartedAt = Date.now();
  const session = await createSession();
  const sessionCreatedAt = Date.now();

  const socketStartedAt = Date.now();
  const socket = new WebSocket(session.realtime_ws_url);
  const resultPromise = collectResult(socket);
  const sessionOpenedPromise = waitForSessionOpened(socket);
  await waitForOpen(socket);
  const socketOpenedAt = Date.now();
  await sessionOpenedPromise;
  const audioStartedAt = Date.now();
  const inputChunksSent = await streamPcm(socket, pcm);
  const audioFinishedAt = Date.now();
  socket.send(JSON.stringify({ kind: "close_session" }));
  const result = await resultPromise;

  await stopSession(session.app_session_id);
  logSmokeResult({
    audioFinishedAt,
    audioStartedAt,
    inputChunksSent,
    result,
    sessionCreatedAt,
    sessionStartedAt,
    socketOpenedAt,
    socketStartedAt,
  });
}

function createSmokePcm() {
  if (!echoText) {
    return synthesizePcm(spokenText, speechVoice);
  }
  return mixPcm16(
    synthesizePcm(spokenText, speechVoice),
    synthesizePcm(echoText, echoVoice),
    2_000,
    0.45,
  );
}

async function createSession() {
  const sessionResponse = await fetch(`${workerUrl}/v2/session`, {
    body: JSON.stringify({
      app_install_id: `synthetic_latency_${Date.now()}`,
      device_integrity: { available: false, platform: "synthetic", reason: "latency_smoke" },
      source_language: sourceLanguage,
      target_language: targetLanguage,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const session = await sessionResponse.json();
  if (!sessionResponse.ok) {
    throw new Error(`session_http_${sessionResponse.status}:${JSON.stringify(session)}`);
  }
  return session;
}

async function stopSession(sessionId) {
  await fetch(`${workerUrl}/v2/session/${sessionId}/stop`, {
    body: JSON.stringify({ reason: "smoke_done" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => null);
}

function logSmokeResult({
  audioFinishedAt,
  audioStartedAt,
  inputChunksSent,
  result,
  sessionCreatedAt,
  sessionStartedAt,
  socketOpenedAt,
  socketStartedAt,
}) {
  console.log("Murmur realtime translation smoke");
  console.log(`worker: ${workerUrl}`);
  console.log(`language_pair: ${sourceLanguage}->${targetLanguage}`);
  console.log(`session_create: ${sessionCreatedAt - sessionStartedAt}ms`);
  console.log(`socket_open: ${socketOpenedAt - socketStartedAt}ms`);
  console.log(`first_source_transcript: ${formatMs(result.firstSourceAt - audioStartedAt)}`);
  console.log(`first_translated_transcript: ${formatMs(result.firstTranslationAt - audioStartedAt)}`);
  console.log(`input_chunks_sent: ${inputChunksSent}`);
  console.log(`input_chunks_received_by_worker: ${result.inputChunksReceived}`);
  console.log(`input_bytes_received_by_worker: ${result.inputBytesReceived}`);
  console.log(`last_source_elapsed_ms: ${result.lastSourceElapsedMs ?? "n/a"}`);
  console.log(`last_translation_elapsed_ms: ${result.lastTranslationElapsedMs ?? "n/a"}`);
  console.log(`translated_audio_chunks: ${result.audioChunks}`);
  console.log(`translated_audio_bytes: ${result.audioBytes}`);
  console.log(`translated_audio_started_before_input_finished: ${
    result.firstAudioAt > 0 && result.firstAudioAt < audioFinishedAt
  }`);
  console.log(`source: ${result.source}`);
  console.log(`translation: ${result.translation}`);
}

function collectResult(socket) {
  return new Promise((resolve, reject) => {
    const state = {
      audioBytes: 0,
      audioChunks: 0,
      firstAudioAt: 0,
      firstSourceAt: 0,
      firstTranslationAt: 0,
      inputBytesReceived: 0,
      inputChunksReceived: 0,
      lastSourceElapsedMs: null,
      lastTranslationElapsedMs: null,
      source: "",
      translation: "",
    };
    let settled = false;
    let messageQueue = Promise.resolve();
    const timeout = setTimeout(() => rejectResult(new Error("realtime_translation_timeout")), 45_000);
    const context = { reject: rejectResult, resolve: resolveResult, socket, state };

    socket.addEventListener("message", (event) => {
      messageQueue = messageQueue
        .then(() => {
          if (!settled) {
            return collectResultMessage({ event, ...context });
          }
          return undefined;
        })
        .catch(rejectResult);
    });
    socket.addEventListener("error", () => {
      rejectResult(new Error("realtime_socket_error"));
    });

    function rejectResult(error) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      reject(error);
    }

    function resolveResult(result) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      socket.close(1000, "smoke_done");
      resolve(result);
    }
  });
}

async function collectResultMessage(context) {
  if (typeof context.event.data === "string") {
    return collectTextResultMessage(context);
  }
  return collectAudioResultMessage(context);
}

async function collectAudioResultMessage(context) {
  context.state.firstAudioAt ||= Date.now();
  context.state.audioBytes += await byteLength(context.event.data);
  context.state.audioChunks += 1;
}

function collectTextResultMessage(context) {
  const message = safeJson(context.event.data);
  if (!message) {
    return;
  }
  if (finishResultSession(context, message)) {
    return;
  }
  updateResultState(context.state, message);
}

function finishResultSession(context, message) {
  if (message.kind === "session_error") {
    context.reject(new Error(`realtime_${message.code}`));
    return true;
  }
  if (message.kind === "session_closed") {
    context.resolve(context.state);
    return true;
  }
  return false;
}

function updateResultState(state, message) {
  const handler = {
    input_audio_ack: recordInputAudioAck,
    source_delta: recordSourceDelta,
    translation_delta: recordTranslationDelta,
  }[message.kind];
  if (handler) {
    handler(state, message);
  }
}

function recordInputAudioAck(state, message) {
  state.inputBytesReceived = message.bytes_received ?? state.inputBytesReceived;
  state.inputChunksReceived = message.chunk_seq ?? state.inputChunksReceived;
}

function recordSourceDelta(state, message) {
  state.firstSourceAt ||= Date.now();
  state.lastSourceElapsedMs = message.provider_elapsed_ms ?? state.lastSourceElapsedMs;
  state.source += message.delta ?? "";
}

function recordTranslationDelta(state, message) {
  state.firstTranslationAt ||= Date.now();
  state.lastTranslationElapsedMs =
    message.provider_elapsed_ms ?? state.lastTranslationElapsedMs;
  state.translation += message.delta ?? "";
}

function waitForOpen(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("socket_open_timeout")), 10_000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("socket_open_error"));
    }, { once: true });
  });
}

function waitForSessionOpened(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("session_open_timeout")), 10_000);
    const listener = (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      const message = safeJson(event.data);
      if (message?.kind === "session_opened") {
        clearTimeout(timeout);
        socket.removeEventListener("message", listener);
        resolve();
      }
    };
    socket.addEventListener("message", listener);
  });
}

async function streamPcm(socket, pcmData) {
  const frameBytes = 9_600;
  let chunksSent = 0;
  for (let offset = 0; offset < pcmData.byteLength; offset += frameBytes) {
    socket.send(pcmData.slice(offset, offset + frameBytes));
    chunksSent += 1;
    await delay(200);
  }
  return chunksSent;
}

function synthesizePcm(text, voice) {
  const directory = mkdtempSync(join(tmpdir(), "murmur-realtime-smoke-"));
  const aiffPath = join(directory, "speech.aiff");
  const wavPath = join(directory, "speech.wav");
  try {
    execFileSync("say", ["-v", voice, "-r", "150", "-o", aiffPath, text]);
    execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@24000", "-c", "1", aiffPath, wavPath]);
    return parseWavPcm(readFileSync(wavPath));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function mixPcm16(primary, echo, echoDelayMs, echoGain) {
  const echoOffsetBytes = Math.round(24_000 * 2 * echoDelayMs / 1_000);
  const output = Buffer.alloc(Math.max(primary.length, echoOffsetBytes + echo.length));
  primary.copy(output);
  for (let offset = 0; offset + 1 < echo.length; offset += 2) {
    const outputOffset = echoOffsetBytes + offset;
    const mixed = output.readInt16LE(outputOffset) + Math.round(echo.readInt16LE(offset) * echoGain);
    output.writeInt16LE(Math.max(-32_768, Math.min(32_767, mixed)), outputOffset);
  }
  return output;
}

function parseWavPcm(buffer) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (buffer.toString("ascii", offset, offset + 4) === "data") {
      return buffer.slice(chunkStart, chunkStart + chunkSize);
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }
  throw new Error("wav_data_chunk_missing");
}

async function byteLength(data) {
  const directLength = directByteLength(data);
  if (directLength !== null) {
    return directLength;
  }
  return blobByteLength(data);
}

function directByteLength(data) {
  if (data instanceof ArrayBuffer) {
    return data.byteLength;
  }
  if (ArrayBuffer.isView(data)) {
    return data.byteLength;
  }
  return null;
}

async function blobByteLength(data) {
  if (!data || typeof data.arrayBuffer !== "function") {
    return 0;
  }
  return (await data.arrayBuffer()).byteLength;
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatMs(value) {
  return value > 0 ? `${value}ms` : "n/a";
}

export { collectResult };
