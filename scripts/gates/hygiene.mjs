import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const scripts = packageJson.scripts ?? {};
const failures = [];

const noOpPattern = /^(?:echo(?:\s+["']?[^"']*["']?)?|true|exit\s+0)$/i;
const placeholderPattern = /\b(?:No linter configured yet|No tests configured yet|TODO: document)\b/i;
const forbiddenHookScripts = new Set([
  "store:live",
  "store:preflight",
  "store:submission-readiness",
  "store:launch-ready",
]);

for (const [name, command] of Object.entries(scripts)) {
  const trimmed = command.trim();

  if (noOpPattern.test(trimmed)) {
    failures.push(`package script "${name}" is a no-op placeholder: ${trimmed}`);
  }

  if (placeholderPattern.test(command)) {
    failures.push(`package script "${name}" contains placeholder text: ${command}`);
  }

  if (command.includes("--passWithNoTests")) {
    failures.push(`package script "${name}" uses --passWithNoTests`);
  }

  if (/<NONEXISTENT>/i.test(command)) {
    failures.push(`package script "${name}" references <NONEXISTENT>`);
  }
}

const commitScript = readFileSync("scripts/gates/commit.sh", "utf8");
const referencedScripts = [...commitScript.matchAll(/pnpm\s+run\s+([A-Za-z0-9:_-]+)/g)].map((match) => match[1]);

for (const name of referencedScripts) {
  if (!scripts[name]) {
    failures.push(`scripts/gates/commit.sh references missing package script "${name}"`);
  }

  if (forbiddenHookScripts.has(name)) {
    failures.push(`scripts/gates/commit.sh must not run live/release lane "${name}"`);
  }
}

if (/\bfastlane\b/i.test(commitScript)) {
  failures.push("scripts/gates/commit.sh must not run Fastlane lanes");
}

if (/\b(store:live|store:preflight|store:submission-readiness|store:launch-ready)\b/.test(commitScript)) {
  failures.push("scripts/gates/commit.sh must not run live or release store lanes");
}

if (failures.length > 0) {
  console.error("Gate hygiene failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Gate hygiene passed.");
