import assert from "node:assert/strict";
import { startWorkerd } from "./workerd-process.mjs";
import { once } from "node:events";
import { mkdir, realpath, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertTranscriptAbsent, firstTranslation } from "./first-translation.mjs";

// cspell:ignore Buenos días Miniflare

// Keep the real entry point, SDK, Durable Object and proxy; replace only OpenAI.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workerRoot = resolve(root, "apps/worker");
const fixture = resolve(workerRoot, `.realtime-proof-${process.pid}.ts`);
const output = resolve(root, "scratchpad/runtime-proof/realtime");
const port = Number(process.env.MURMUR_REALTIME_PROOF_PORT ?? 8917);
const stream = [];
// Use the same WebSocket transport already installed with the local Workers runtime.
const wranglerRequire = createRequire(await realpath(resolve(workerRoot, "node_modules/wrangler/package.json")));
const { WebSocketServer } = createRequire(wranglerRequire.resolve("miniflare"))("ws");
const upstream = new WebSocketServer({ host: "127.0.0.1", port: 0 });
await once(upstream, "listening");
let upstreamBytes = 0;
const audioBytes = 89114;
upstream.on("connection", (peer) => {
  peer.on("message", (data) => {
    const command = JSON.parse(data.toString());
    if (command.type === "session.update") {
      peer.send(JSON.stringify({ type: "session.updated", session: command.session }));
      return;
    }
    if (command.type !== "session.input_audio_buffer.append") return;
    const audio = Buffer.from(command.audio, "base64");
    upstreamBytes += audio.length;
    assert.ok(audio.every((byte) => byte === 1), "proxy must preserve the PCM bytes");
    if (upstreamBytes === audioBytes) setTimeout(() => peer.send(JSON.stringify(
      process.env.MURMUR_REALTIME_FAKE_MODE === "audio-only"
        ? { type: "session.output_audio.delta", delta: "AQE=" }
        : { type: "session.output_transcript.delta", delta: "Buenos días" },
    )), 1200);
  });
});
const collector = createServer(async (request, response) => {
  for await (const _chunk of request) { /* Drain actual SDK envelopes. */ }
  response.end("{}");
});
collector.listen(0, "127.0.0.1");
await once(collector, "listening");
let stopRuntime;
await mkdir(output, { recursive: true });
try {
  await writeFile(fixture, `import worker from './src/entrypoint';
import { createSessionRecordDurable } from './src/rateLimitDurableObject';
export { RateLimitDurableObject, CustomerLedgerDurableObject } from './src/entrypoint';
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (String(input).startsWith('https://api.openai.com/v1/realtime/translations')) {
    return nativeFetch('http://127.0.0.1:${upstream.address().port}', init);
  }
  return nativeFetch(input, init);
};
export default { async fetch(request, env, context) {
  const testEnv = {...env, BILLING_DB:undefined, BILLING_ENFORCEMENT_ENABLED:'false', OPENAI_API_KEY:'fake-upstream'};
  if (new URL(request.url).pathname === '/__proof/session') {
    const id=crypto.randomUUID();
    await createSessionRecordDurable({app_session_id:id,hashed_install_id:'runtime-install',namespace:env.RATE_LIMITER,now_ms:Date.now()});
    return Response.json({id});
  }
  return worker.fetch(request, testEnv, context);
}};
`, { flag: "wx" });
  stopRuntime = await startWorkerd({ workerRoot, fixture: fixture, statePath: resolve(output, "state"), port, stream,
    variables: { SENTRY_DSN: `http://public@127.0.0.1:${collector.address().port}/1` },
  });
  const response = await fetch(`http://127.0.0.1:${port}/__proof/session`, { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  const { id } = await response.json();
  const translation = await firstTranslation({
    realtimeUrl: `ws://127.0.0.1:${port}/v2/realtime?app_session_id=${id}&target_language=es&playback_enabled=false`,
    pcm: new Uint8Array(audioBytes).fill(1), expectedOrigin: `ws://127.0.0.1:${port}`, timeoutMs: 8000,
  });
  assert.equal(upstreamBytes, audioBytes);
  assert.throws(() => assertTranscriptAbsent([{ source: { message: "Buenos" } }, { source: { message: " días" } }],
    { ...translation, transcript_fragments: ["Buenos", " días"] }), /fragment retained/);
  await writeFile(resolve(output, "receipt.json"), JSON.stringify({ first_translation: true, ...translation }, null, 2));
  console.log("Real workerd proxy: session opened, audio acknowledged, first translation received.");
} finally {
  await stopRuntime?.();
  collector.closeAllConnections();
  await new Promise((done) => collector.close(done));
  for (const peer of upstream.clients) peer.terminate();
  await new Promise((done) => upstream.close(done));
  await unlink(fixture).catch(() => {});
  await writeFile(resolve(output, "console.log"), stream.join(""));
}
