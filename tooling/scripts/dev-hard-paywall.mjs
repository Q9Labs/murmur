import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { bundleWorkerProof } from "./worker-proof-runtime.mjs";

const { values } = parseArgs({ args: process.argv.slice(process.argv[2] === "--" ? 3 : 2), options: {
  "free-minutes": { type: "string", default: "5" },
  port: { type: "string", default: "8787" },
} });
if (!["0", "5"].includes(values["free-minutes"])) throw new Error("--free-minutes must be 0 or 5");
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("invalid --port");
const { root, script, splitSqlQuery } = await bundleWorkerProof({
  entryPoint: "apps/worker/src/index.ts", mainFields: ["module", "main"],
});
const origin = `http://127.0.0.1:${port}`;
const vendorBindings = Object.fromEntries(
  ["OPENAI_API_KEY", "REVENUECAT_API_KEY", "REVENUECAT_PROJECT_ID"].flatMap((name) =>
    process.env[name]?.trim() ? [[name, process.env[name]]] : []),
);
const mf = new Miniflare(convertV4MiniflareOptions({ host: "127.0.0.1", port, workers: [{
  name: "murmur", modules: true, script,
  compatibilityDate: "2026-05-16", compatibilityFlags: ["nodejs_compat"],
  outboundService: "posthog", d1Databases: ["BILLING_DB"],
  durableObjects: {
    CUSTOMER_LEDGER: { className: "CustomerLedgerDurableObject", useSQLite: true },
    RATE_LIMITER: { className: "RateLimitDurableObject" },
  },
  bindings: {
    MURMUR_ENV: "development", BETTER_AUTH_URL: `${origin}/api/auth`,
    POSTHOG_PROJECT_TOKEN: "local-posthog-only",
    BILLING_ENFORCEMENT_ENABLED: "true", BILLING_FULFILLMENT_ENABLED: "true",
    ...vendorBindings,
  },
}, {
  name: "posthog", modules: true, compatibilityDate: "2026-05-16",
  script: `export default { async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname !== "us.i.posthog.com") return fetch(request);
    if (url.pathname !== "/flags/") return Response.json({});
    return Response.json({ flags: { free_allowance_minutes: {
      enabled: true, metadata: { payload: ${JSON.stringify(values["free-minutes"])} }
    } } });
  } };`,
}] }));

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await mf.dispose();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
// A dev session expires even if its terminal or automation owner disappears.
const lifetime = setTimeout(stop, 4 * 60 * 60 * 1000);
lifetime.unref();
try {
  const database = await mf.getD1Database("BILLING_DB", "murmur");
  for (const name of (await readdir(resolve(root, "apps/worker/migrations"))).sort()) {
    if (!name.endsWith(".sql")) continue;
    const sql = await readFile(resolve(root, "apps/worker/migrations", name), "utf8");
    await database.batch(splitSqlQuery(sql).map((statement) => database.prepare(statement)));
  }
  await mf.ready;
  console.log(`Local Worker ready at ${origin}; free_allowance_minutes=${values["free-minutes"]}; ephemeral D1 + real CustomerLedger; only PostHog is stubbed.`);
} catch (error) {
  await stop();
  throw error;
}
