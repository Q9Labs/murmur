#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const workerUrl = process.env.MURMUR_WORKER_URL ?? "https://murmur.q9labs.ai";
const sourceLanguage = process.env.MURMUR_SOURCE_LANGUAGE ?? "en";
const targetLanguage = process.env.MURMUR_TARGET_LANGUAGE ?? "ar";
const spokenText = process.env.MURMUR_SMOKE_TEXT ?? "Hello. How are you today?";
const speechVoice = process.env.MURMUR_SAY_VOICE ?? "Samantha";
const pcm = synthesizePcm(spokenText);

const sessionStartedAt = Date.now();
const sessionResponse = await fetch(`${workerUrl}/v1/session`, {
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
const sessionCreatedAt = Date.now();

const socketStartedAt = Date.now();
const socket = new WebSocket(session.realtime_ws_url);
const resultPromise = collectResult(socket);
await waitForOpen(socket);
const socketOpenedAt = Date.now();
await waitForSessionOpened(socket);
const audioStartedAt = Date.now();
await streamPcm(socket, pcm);
socket.send(JSON.stringify({ kind: "close_session" }));
const result = await resultPromise;

await fetch(`${workerUrl}/v1/session/${session.app_session_id}/stop`, {
  body: JSON.stringify({ reason: "smoke_done" }),
  headers: { "Content-Type": "application/json" },
  method: "POST",
}).catch(() => null);

console.log("Murmur realtime translation smoke");
console.log(`worker: ${workerUrl}`);
console.log(`language_pair: ${sourceLanguage}->${targetLanguage}`);
console.log(`session_create: ${sessionCreatedAt - sessionStartedAt}ms`);
console.log(`socket_open: ${socketOpenedAt - socketStartedAt}ms`);
console.log(`first_source_transcript: ${formatMs(result.firstSourceAt - audioStartedAt)}`);
console.log(`first_translated_transcript: ${formatMs(result.firstTranslationAt - audioStartedAt)}`);
console.log(`translated_audio_bytes: ${result.audioBytes}`);
console.log(`source: ${result.source}`);
console.log(`translation: ${result.translation}`);

function collectResult(socket) {
  return new Promise((resolve, reject) => {
    const state = {
      audioBytes: 0,
      firstSourceAt: 0,
      firstTranslationAt: 0,
      source: "",
      translation: "",
    };
    const timeout = setTimeout(() => reject(new Error("realtime_translation_timeout")), 45_000);
    socket.addEventListener("message", async (event) => {
      if (typeof event.data !== "string") {
        state.audioBytes += await byteLength(event.data);
        return;
      }
      const message = safeJson(event.data);
      if (message?.kind === "source_delta") {
        state.firstSourceAt ||= Date.now();
        state.source += message.delta ?? "";
      } else if (message?.kind === "translation_delta") {
        state.firstTranslationAt ||= Date.now();
        state.translation += message.delta ?? "";
      } else if (message?.kind === "session_error") {
        clearTimeout(timeout);
        reject(new Error(`realtime_${message.code}`));
      } else if (message?.kind === "session_closed") {
        clearTimeout(timeout);
        socket.close(1000, "smoke_done");
        resolve(state);
      }
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("realtime_socket_error"));
    });
  });
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
  const frameBytes = 960;
  for (let offset = 0; offset < pcmData.byteLength; offset += frameBytes) {
    socket.send(pcmData.slice(offset, offset + frameBytes));
    await delay(20);
  }
}

function synthesizePcm(text) {
  const directory = mkdtempSync(join(tmpdir(), "murmur-realtime-smoke-"));
  const aiffPath = join(directory, "speech.aiff");
  const wavPath = join(directory, "speech.wav");
  try {
    execFileSync("say", ["-v", speechVoice, "-r", "150", "-o", aiffPath, text]);
    execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@24000", "-c", "1", aiffPath, wavPath]);
    return parseWavPcm(readFileSync(wavPath));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
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
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return data.byteLength;
  }
  return data && typeof data.arrayBuffer === "function"
    ? (await data.arrayBuffer()).byteLength
    : 0;
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
