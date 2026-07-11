import { spawnSync } from "node:child_process";

const [, , command, ...messageParts] = process.argv;

if (!command) {
  console.error("Usage: node tooling/gates/require-tool.mjs <command> [message]");
  process.exit(2);
}

const result = spawnSync(command, ["--version"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (result.error?.code === "ENOENT") {
  const message = messageParts.join(" ").trim();
  console.error(`Required command not found: ${command}`);
  if (message) {
    console.error(message);
  }
  process.exit(127);
}

if (result.error) {
  console.error(`Could not execute ${command}: ${result.error.message}`);
  process.exit(127);
}

process.exit(0);
