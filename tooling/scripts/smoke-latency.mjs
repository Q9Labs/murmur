#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const workerUrl = process.env.MURMUR_WORKER_URL ?? "https://murmur.q9labs.ai";
const runs = Number(process.env.MURMUR_LATENCY_RUNS ?? "5");
const sourceLanguage = process.env.MURMUR_SOURCE_LANGUAGE ?? "en";
const targetLanguage = process.env.MURMUR_TARGET_LANGUAGE ?? "ar";
const phrase =
  process.env.MURMUR_SMOKE_PHRASE ??
  "Hello. How are you today? This is a test of live translation.";
const speechVoice = process.env.MURMUR_SAY_VOICE ?? "Samantha";
const audioFile = process.env.MURMUR_AUDIO_FILE;

if (!Number.isInteger(runs) || runs < 1) {
  throw new Error("MURMUR_LATENCY_RUNS must be a positive integer");
}

const pcm = audioFile ? loadPcmFromAudioFile(audioFile) : synthesizePcm(phrase);
const samples = [];

for (let run = 1; run <= runs; run += 1) {
  process.stdout.write(`run ${run}/${runs} ... `);
  const result = await runSmoke(run, pcm);
  samples.push(...result.samples);
  process.stdout.write(`${result.transcript} -> ${result.translation}\n`);
}

const summary = summarize(samples);
console.log("\nMurmur synthetic provider latency smoke");
console.log(`worker: ${workerUrl}`);
console.log(`language_pair: ${sourceLanguage}->${targetLanguage}`);
console.log(`runs: ${runs}`);
if (audioFile) {
  console.log(`audio_file: ${audioFile}`);
} else {
  console.log(`voice: ${speechVoice}`);
  console.log(`phrase: ${phrase}`);
}
console.log("\nsummary:");
for (const [name, value] of Object.entries(summary).sort(([left], [right]) => left.localeCompare(right))) {
  console.log(`- ${name}: n=${value.count} / p50 ${formatMs(value.p50_ms)} / p90 ${formatMs(value.p90_ms)} / p95 ${formatMs(value.p95_ms)}`);
}

async function runSmoke(run, pcmData) {
  const sessionStartedAt = Date.now();
  const sessionResponse = await fetch(`${workerUrl}/v1/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_install_id: `synthetic_latency_${Date.now()}_${run}`,
      device_integrity: {
        available: false,
        platform: "synthetic",
        reason: "latency_smoke",
      },
      source_language: sourceLanguage,
      target_language: targetLanguage,
    }),
  });
  const session = await sessionResponse.json();
  if (!sessionResponse.ok) {
    throw new Error(`session_http_${sessionResponse.status}:${JSON.stringify(session)}`);
  }
  const samples = [{ name: "session_create", value_ms: Date.now() - sessionStartedAt }];

  const deepgramOpenedAt = Date.now();
  const deepgramSocket = new WebSocket(session.deepgram_ws_url);
  await waitForOpen(deepgramSocket);
  samples.push({ name: "deepgram_ws_open", value_ms: Date.now() - deepgramOpenedAt });

  const translateOpenedAt = Date.now();
  const translateSocket = new WebSocket(session.translate_ws_url);
  await waitForOpen(translateSocket);
  samples.push({ name: "translate_ws_open", value_ms: Date.now() - translateOpenedAt });

  const audioStartedAt = Date.now();
  const transcriptPromise = waitForTranscript(deepgramSocket, audioStartedAt, samples);
  await streamPcm(deepgramSocket, pcmData);
  deepgramSocket.send(JSON.stringify({ type: "Finalize" }));
  const transcript = await transcriptPromise;

  const spanId = `span_smoke_${Date.now()}_${run}`;
  const translationStartedAt = Date.now();
  const translationPromise = waitForTranslation(translateSocket, translationStartedAt, samples);
  translateSocket.send(
    JSON.stringify({
      kind: "translate",
      app_session_id: session.app_session_id,
      connection_id: `connection_smoke_${run}`,
      context_spans: [],
      event_seq: run,
      revision: 1,
      session_epoch: session.session_epoch,
      source_caption: transcript,
      source_language: sourceLanguage,
      span_id: spanId,
      target_language: targetLanguage,
      translation_attempt: 1,
    }),
  );
  const translation = await translationPromise;
  samples.push({
    name: "end_to_end_audio_start_to_translation_done",
    value_ms: Date.now() - audioStartedAt,
  });

  deepgramSocket.close(1000, "smoke_done");
  translateSocket.send(JSON.stringify({ kind: "stop_session", app_session_id: session.app_session_id, reason: "smoke_done" }));
  translateSocket.close(1000, "smoke_done");
  await fetch(`${workerUrl}/v1/session/${session.app_session_id}/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "smoke_done" }),
  }).catch(() => null);

  return { samples, transcript, translation };
}

async function waitForTranscript(socket, audioStartedAt, samples) {
  let firstTranscriptSeen = false;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("deepgram_transcript_timeout")), 20_000);
    socket.addEventListener("message", async (event) => {
      const raw = await messageDataToString(event.data);
      const parsed = safeJson(raw);
      const transcript = parsed?.channel?.alternatives?.[0]?.transcript?.trim();
      if (!transcript) {
        return;
      }
      if (!firstTranscriptSeen) {
        firstTranscriptSeen = true;
        samples.push({ name: "first_transcript_from_audio_start", value_ms: Date.now() - audioStartedAt });
      }
      if (parsed.is_final || parsed.speech_final) {
        clearTimeout(timeout);
        samples.push({ name: "final_transcript_from_audio_start", value_ms: Date.now() - audioStartedAt });
        resolve(transcript);
      }
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("deepgram_socket_error"));
    });
    socket.addEventListener("close", () => {
      clearTimeout(timeout);
      reject(new Error("deepgram_socket_closed"));
    });
  });
}

async function waitForTranslation(socket, translationStartedAt, samples) {
  let firstTokenSeen = false;
  let latest = "";
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("translation_timeout")), 30_000);
    socket.addEventListener("message", async (event) => {
      const parsed = safeJson(await messageDataToString(event.data));
      if (!parsed) {
        return;
      }
      if (parsed.kind === "translation_delta") {
        if (!firstTokenSeen) {
          firstTokenSeen = true;
          samples.push({ name: "first_translation_token_from_final_send", value_ms: Date.now() - translationStartedAt });
        }
        latest += parsed.delta ?? "";
      }
      if (parsed.kind === "translation_done") {
        clearTimeout(timeout);
        samples.push({ name: "translation_done_from_final_send", value_ms: Date.now() - translationStartedAt });
        resolve(parsed.translated_caption || latest);
      }
      if (parsed.kind === "translation_error") {
        clearTimeout(timeout);
        reject(new Error(parsed.error_code ?? "translation_error"));
      }
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("translation_socket_error"));
    });
    socket.addEventListener("close", () => {
      clearTimeout(timeout);
      reject(new Error("translation_socket_closed"));
    });
  });
}

async function streamPcm(socket, pcmData) {
  const frameBytes = 640;
  for (let offset = 0; offset < pcmData.byteLength; offset += frameBytes) {
    socket.send(pcmData.slice(offset, offset + frameBytes));
    await delay(20);
  }
}

function waitForOpen(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("socket_open_timeout")), 10_000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("socket_error"));
    });
  });
}

async function messageDataToString(data) {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  }
  if (data && typeof data.text === "function") {
    return data.text();
  }
  return "";
}

function synthesizePcm(text) {
  const directory = mkdtempSync(join(tmpdir(), "murmur-latency-"));
  const aiffPath = join(directory, "speech.aiff");
  const wavPath = join(directory, "speech.wav");
  try {
    execFileSync("say", ["-v", speechVoice, "-r", "150", "-o", aiffPath, text]);
    execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", aiffPath, wavPath]);
    return parseWavPcm(readFileSync(wavPath));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function loadPcmFromAudioFile(path) {
  if (!existsSync(path)) {
    throw new Error(`MURMUR_AUDIO_FILE does not exist: ${path}`);
  }
  const directory = mkdtempSync(join(tmpdir(), "murmur-latency-"));
  const wavPath = join(directory, `${basename(path)}.16k.wav`);
  try {
    execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", path, wavPath]);
    return parseWavPcm(readFileSync(wavPath));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function parseWavPcm(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("invalid_wav");
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkId === "data") {
      return buffer.slice(chunkStart, chunkStart + chunkSize);
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }
  throw new Error("wav_data_chunk_missing");
}

function summarize(latencySamples) {
  const groups = new Map();
  for (const sample of latencySamples) {
    const values = groups.get(sample.name) ?? [];
    values.push(sample.value_ms);
    groups.set(sample.name, values);
  }
  return Object.fromEntries(
    [...groups.entries()].map(([name, values]) => [
      name,
      {
        count: values.length,
        p50_ms: percentile(values, 50),
        p90_ms: percentile(values, 90),
        p95_ms: percentile(values, 95),
      },
    ]),
  );
}

function percentile(values, rank) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((rank / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function safeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatMs(value) {
  return `${Math.round(value)}ms`;
}
