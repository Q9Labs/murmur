#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const workerUrl = process.env.MURMUR_WORKER_URL ?? "http://localhost:8787";
const experiment = process.env.MURMUR_EXPERIMENT ?? "both";
const runs = Number(process.env.MURMUR_LATENCY_RUNS ?? "5");
const sourceLanguage = process.env.MURMUR_SOURCE_LANGUAGE ?? "en";
const targetLanguage = process.env.MURMUR_TARGET_LANGUAGE ?? "ar";
const phrase =
  process.env.MURMUR_SMOKE_PHRASE ??
  "I went to the store and bought milk.";
const speechVoice = process.env.MURMUR_SAY_VOICE ?? "Samantha";
const audioFile = process.env.MURMUR_AUDIO_FILE;
const ultravoxVadEnabled = (process.env.MURMUR_ULTRAVOX_VAD ?? "on") !== "off";
const runDelayMs = Number(process.env.MURMUR_RUN_DELAY_MS ?? "1000");

if (!Number.isInteger(runs) || runs < 1) {
  throw new Error("MURMUR_LATENCY_RUNS must be a positive integer");
}

const pcm = appendSilence(audioFile ? loadPcmFromAudioFile(audioFile) : synthesizePcm(phrase), 1000);
const experiments = experiment === "both" ? ["groq-preview-gemma", "ultravox"] : [experiment];
const allSamples = [];
const failures = [];

for (const name of experiments) {
  for (let run = 1; run <= runs; run += 1) {
    process.stdout.write(`${name} run ${run}/${runs} ... `);
    try {
      const result =
        name === "groq-preview-gemma"
          ? await runGroqPreviewGemma(run, pcm)
          : await runUltravoxReplacement(run, pcm, ultravoxVadEnabled);
      allSamples.push(...result.samples.map((sample) => ({ ...sample, experiment: name })));
      process.stdout.write(`${result.source || "(source pending)"} -> ${result.translation || "(translation pending)"}\n`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "run_failed";
      failures.push({ experiment: name, reason, run });
      process.stdout.write(`failed: ${reason}\n`);
    }
    if (run < runs && runDelayMs > 0) {
      await delay(runDelayMs);
    }
  }
}

console.log("\nMurmur translation experiment benchmark");
console.log(`worker: ${workerUrl}`);
console.log(`language_pair: ${sourceLanguage}->${targetLanguage}`);
console.log(`runs_per_experiment: ${runs}`);
console.log(`audio: ${audioFile ? audioFile : `${speechVoice}: ${phrase}`}`);
console.log(`ultravox_vad: ${ultravoxVadEnabled ? "on" : "off"}`);
console.log(`run_delay_ms: ${Number.isFinite(runDelayMs) ? runDelayMs : 0}`);
console.log("\nsummary:");
for (const name of experiments) {
  console.log(`\n${name}`);
  const experimentFailures = failures.filter((failure) => failure.experiment === name);
  console.log(`- runs_succeeded: ${runs - experimentFailures.length}/${runs}`);
  if (experimentFailures.length > 0) {
    const reasons = Object.entries(countBy(experimentFailures.map((failure) => failure.reason)))
      .map(([reason, count]) => `${reason} x${count}`)
      .join(", ");
    console.log(`- failures: ${reasons}`);
  }
  const summary = summarize(allSamples.filter((sample) => sample.experiment === name));
  for (const [metric, value] of Object.entries(summary).sort(([left], [right]) => left.localeCompare(right))) {
    console.log(
      `- ${metric}: n=${value.count} / p50 ${formatMs(value.p50_ms)} / p90 ${formatMs(value.p90_ms)} / p95 ${formatMs(value.p95_ms)}`,
    );
  }
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

async function runGroqPreviewGemma(run, pcmData) {
  const session = await createSession({
    translation_model_route: "experiment_groq_preview_gemma",
    translation_mode: "continuous",
  });
  if (!session.deepgram_ws_url || !session.translate_ws_url) {
    throw new Error("session_missing_deepgram_or_translate_ws_url");
  }

  const samples = [];
  const deepgramSocket = new WebSocket(session.deepgram_ws_url);
  const translateSocket = new WebSocket(session.translate_ws_url);
  await Promise.all([waitForOpen(deepgramSocket), waitForOpen(translateSocket)]);

  const audioStartedAt = Date.now();
  let source = "";
  let firstTranscriptSeen = false;
  let latestTranscript = "";
  let spanSeq = 0;
  const finalClientRequestIds = new Set();
  let translationError = null;
  const translationPromise = waitForWorkerTranslation(translateSocket, audioStartedAt, samples, {
    finalClientRequestIds,
  }).catch((error) => {
    translationError = error;
    return null;
  });

  deepgramSocket.addEventListener("message", async (event) => {
    const parsed = safeJson(await messageDataToString(event.data));
    const transcript = parsed?.channel?.alternatives?.[0]?.transcript?.trim();
    if (!transcript || transcript === latestTranscript) {
      return;
    }
    latestTranscript = transcript;
    source = transcript;
    if (!firstTranscriptSeen) {
      firstTranscriptSeen = true;
      samples.push({ name: "first_transcript_from_audio_start", value_ms: Date.now() - audioStartedAt });
    }
    if (parsed.is_final || parsed.speech_final) {
      samples.push({ name: "final_transcript_from_audio_start", value_ms: Date.now() - audioStartedAt });
    } else {
      samples.push({ name: "interim_transcript_from_audio_start", value_ms: Date.now() - audioStartedAt });
    }
    spanSeq += 1;
    const clientRequestId = `benchmark_preview_${run}_${spanSeq}`;
    if (parsed.is_final || parsed.speech_final) {
      finalClientRequestIds.add(clientRequestId);
    }
    translateSocket.send(
      JSON.stringify({
        kind: "translate",
        app_session_id: session.app_session_id,
        client_request_id: clientRequestId,
        connection_id: `connection_benchmark_${run}`,
        context_spans: [],
        event_seq: spanSeq,
        revision: 1,
        session_epoch: session.session_epoch,
        source_caption: transcript,
        source_language: sourceLanguage,
        source_status: parsed.is_final || parsed.speech_final ? "final" : "stable",
        span_id: `span_benchmark_${Date.now()}_${run}_${spanSeq}`,
        target_language: targetLanguage,
        translation_attempt: 1,
        translation_model_route: "experiment_groq_preview_gemma",
        translation_mode: "continuous",
      }),
    );
  });

  let translation = "";
  try {
    await streamPcm(deepgramSocket, pcmData);
    deepgramSocket.send(JSON.stringify({ type: "Finalize" }));
    translation = (await translationPromise) ?? "";
    if (translationError) {
      throw translationError;
    }
    samples.push({ name: "end_to_end_audio_start_to_final_translation", value_ms: Date.now() - audioStartedAt });
    return { samples, source, translation };
  } finally {
    deepgramSocket.close(1000, "benchmark_done");
    if (translateSocket.readyState === WebSocket.OPEN) {
      translateSocket.send(JSON.stringify({ kind: "stop_session", app_session_id: session.app_session_id, reason: "benchmark_done" }));
    }
    translateSocket.close(1000, "benchmark_done");
    await stopSession(session.app_session_id);
  }
}

async function runUltravoxReplacement(run, pcmData, vadEnabled) {
  const session = await createSession({
    translation_model_route: "experiment_ultravox_replacement",
    translation_mode: "continuous",
    ultravox_vad_enabled: vadEnabled,
  });
  if (!session.ultravox?.join_url) {
    throw new Error("session_missing_ultravox_join_url");
  }

  const samples = [];
  const socket = new WebSocket(session.ultravox.join_url);
  await waitForOpen(socket);
  socket.send(JSON.stringify({ type: "set_output_medium", medium: "text" }));

  const audioStartedAt = Date.now();
  let source = "";
  let translation = "";
  let firstUserSeen = false;
  let firstAgentSeen = false;
  let doneError = null;
  const donePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("ultravox_translation_timeout")), 30_000);
    socket.addEventListener("message", async (event) => {
      const parsed = safeJson(await messageDataToString(event.data));
      if (parsed?.type !== "transcript") {
        return;
      }
      const text = parsed.text ?? parsed.delta ?? "";
      if (!text.trim()) {
        return;
      }
      if (parsed.role === "user") {
        source = parsed.text ?? `${source}${parsed.delta ?? ""}`;
        if (!firstUserSeen) {
          firstUserSeen = true;
          samples.push({ name: "first_user_transcript_from_audio_start", value_ms: Date.now() - audioStartedAt });
        }
        if (parsed.final) {
          samples.push({ name: "final_user_transcript_from_audio_start", value_ms: Date.now() - audioStartedAt });
        }
        return;
      }
      if (parsed.role === "agent") {
        translation = parsed.text ?? `${translation}${parsed.delta ?? ""}`;
        if (!firstAgentSeen) {
          firstAgentSeen = true;
          samples.push({ name: "first_translated_text_from_audio_start", value_ms: Date.now() - audioStartedAt });
        }
        if (parsed.final) {
          clearTimeout(timeout);
          samples.push({ name: "final_translation_from_audio_start", value_ms: Date.now() - audioStartedAt });
          resolve(translation);
        }
      }
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("ultravox_socket_error"));
    });
    socket.addEventListener("close", () => {
      clearTimeout(timeout);
      if (!translation) {
        reject(new Error("ultravox_socket_closed"));
      }
    });
  }).catch((error) => {
    doneError = error;
    return null;
  });

  try {
    await streamPcm(socket, pcmData, { localVad: vadEnabled });
    await donePromise;
    if (doneError) {
      throw doneError;
    }
    samples.push({ name: "end_to_end_audio_start_to_final_translation", value_ms: Date.now() - audioStartedAt });
    return { samples, source, translation };
  } finally {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "hang_up", message: "" }));
    }
    socket.close(1000, "benchmark_done");
    await stopSession(session.app_session_id);
  }
}

async function createSession(options) {
  const startedAt = Date.now();
  const response = await fetch(`${workerUrl}/v1/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_install_id: `experiment_benchmark_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      device_integrity: {
        available: false,
        platform: "synthetic",
        reason: "experiment_benchmark",
      },
      source_language: sourceLanguage,
      target_language: targetLanguage,
      ...options,
    }),
  });
  const session = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`session_http_${response.status}:${JSON.stringify(session)}`);
  }
  session._session_create_ms = Date.now() - startedAt;
  return session;
}

async function stopSession(appSessionId) {
  await fetch(`${workerUrl}/v1/session/${appSessionId}/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "benchmark_done" }),
  }).catch(() => null);
}

async function waitForWorkerTranslation(socket, audioStartedAt, samples, options = {}) {
  let firstDeltaSeen = false;
  let latest = "";
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("translation_timeout")), 30_000);
    socket.addEventListener("message", async (event) => {
      const parsed = safeJson(await messageDataToString(event.data));
      if (!parsed) {
        return;
      }
      if (parsed.kind === "translation_wait") {
        samples.push({ name: "preview_wait_from_audio_start", value_ms: Date.now() - audioStartedAt });
        return;
      }
      if (parsed.kind === "translation_delta") {
        latest = parsed.draft_text ?? `${latest}${parsed.delta ?? ""}`;
        if (!firstDeltaSeen) {
          firstDeltaSeen = true;
          samples.push({ name: "first_translated_text_from_audio_start", value_ms: Date.now() - audioStartedAt });
        }
      }
      if (parsed.kind === "translation_done") {
        const isFinalSourceTranslation =
          !options.finalClientRequestIds ||
          options.finalClientRequestIds.has(parsed.client_request_id);
        if (isFinalSourceTranslation) {
          clearTimeout(timeout);
          samples.push({ name: "final_translation_from_audio_start", value_ms: Date.now() - audioStartedAt });
          resolve(parsed.translated_caption || latest);
        }
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

async function streamPcm(socket, pcmData, options = {}) {
  const frameBytes = 640;
  let vadUntilMs = 0;
  for (let offset = 0; offset < pcmData.byteLength; offset += frameBytes) {
    const frame = pcmData.slice(offset, offset + frameBytes);
    if (!options.localVad || shouldSendLocalVadFrame(frame, vadUntilMs)) {
      socket.send(frame);
    }
    if (options.localVad && rmsPcm16(frame) >= 0.006) {
      vadUntilMs = Date.now() + 480;
    }
    await delay(20);
  }
}

function shouldSendLocalVadFrame(frame, vadUntilMs) {
  return rmsPcm16(frame) >= 0.006 || Date.now() < vadUntilMs;
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
  const directory = mkdtempSync(join(tmpdir(), "murmur-experiment-"));
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
  const directory = mkdtempSync(join(tmpdir(), "murmur-experiment-"));
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
    if (chunkId === "data") {
      return buffer.slice(offset + 8, offset + 8 + chunkSize);
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  throw new Error("wav_data_chunk_missing");
}

function appendSilence(pcmData, durationMs) {
  const silenceBytes = Math.ceil((16000 * 2 * durationMs) / 1000 / 640) * 640;
  return Buffer.concat([Buffer.from(pcmData), Buffer.alloc(silenceBytes)]);
}

function rmsPcm16(buffer) {
  const bytes = Buffer.from(buffer);
  if (bytes.length < 2) {
    return 0;
  }
  let sumSquares = 0;
  let count = 0;
  for (let offset = 0; offset + 1 < bytes.length; offset += 2) {
    const sample = bytes.readInt16LE(offset) / 32768;
    sumSquares += sample * sample;
    count += 1;
  }
  return count === 0 ? 0 : Math.sqrt(sumSquares / count);
}

function summarize(samples) {
  const grouped = new Map();
  for (const sample of samples) {
    if (!grouped.has(sample.name)) {
      grouped.set(sample.name, []);
    }
    grouped.get(sample.name).push(sample.value_ms);
  }
  return Object.fromEntries(
    [...grouped.entries()].map(([name, values]) => {
      const sorted = values.slice().sort((left, right) => left - right);
      return [
        name,
        {
          count: sorted.length,
          p50_ms: percentile(sorted, 0.5),
          p90_ms: percentile(sorted, 0.9),
          p95_ms: percentile(sorted, 0.95),
        },
      ];
    }),
  );
}

function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1),
  );
  return sortedValues[index];
}

function formatMs(value) {
  return `${Math.round(value)} ms`;
}

function safeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
