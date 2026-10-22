import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

export async function bundleWorkerProof({ entryPoint, plugins = [], mainFields }) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const require = createRequire(realpathSync(resolve(root, "apps/worker/node_modules/wrangler/package.json")));
  const { unstable_splitSqlQuery: splitSqlQuery } = require("wrangler");
  const bundle = await build({
    entryPoints: [resolve(root, entryPoint)],
    bundle: true, write: false, format: "esm", platform: "neutral", mainFields,
    conditions: ["workerd", "worker", "browser"], external: ["node:*", "cloudflare:*"], plugins,
  });
  return { root, script: bundle.outputFiles[0].text, splitSqlQuery };
}
