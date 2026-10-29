import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const mobile = fileURLToPath(new URL("../../apps/mobile/", import.meta.url));
const require = createRequire(import.meta.url);
const { resolveWorkerTarget } = require("../../apps/mobile/workerTarget.js");
const profiles = JSON.parse(readFileSync(new URL("../../apps/mobile/eas.json", import.meta.url), "utf8")).build;
const args = process.argv.slice(2);
const dryRun = args.at(-1) === "--dry-run";
if (dryRun) args.pop();
const [target, message, percentage] = args;
const profile = Object.hasOwn(profiles, target ?? "") ? profiles[target] : undefined;
if (!profile || !message || args.length > 3 || (percentage !== undefined && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(percentage))) {
  console.error("Usage: pnpm mobile:update <development|preview|testing|sandbox|production> <message> [rollout-percent] [--dry-run]");
  process.exit(2);
}
resolveWorkerTarget({ workerUrl: profile.env.EXPO_PUBLIC_MURMUR_WORKER_URL, environment: profile.env.EXPO_PUBLIC_MURMUR_ENV, channel: target, nodeEnv: "production" });
if (profile.channel !== target || !profile.environment) throw new Error("Mobile update profile must select an explicit matching channel/environment.");
const command = ["update", "--channel", target, "--environment", profile.environment, "--message", message];
if (percentage !== undefined) command.push("--rollout-percentage", percentage);
if (dryRun) {
  console.log(JSON.stringify({ command: ["eas", ...command], target, environment: profile.env.EXPO_PUBLIC_MURMUR_ENV, workerUrl: profile.env.EXPO_PUBLIC_MURMUR_WORKER_URL }));
} else {
  const result = spawnSync("eas", command, { cwd: mobile, stdio: "inherit", env: { ...process.env, ...profile.env, EXPO_NO_DOTENV: "1", MURMUR_UPDATES_CHANNEL: target } });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
