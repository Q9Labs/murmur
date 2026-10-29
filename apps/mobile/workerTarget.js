const developmentWorker = "https://murmur-worker-dev.msbilal.workers.dev";
const sandboxWorker = "https://murmur-worker-sandbox.msbilal.workers.dev";
const productionWorker = "https://murmur.q9labs.ai";
const targets = {
  development: { url: developmentWorker, label: "development" },
  preview: { url: developmentWorker, label: "preview" },
  testing: { url: developmentWorker, label: "development" },
  sandbox: { url: sandboxWorker, label: "sandbox" },
  production: { url: productionWorker, label: "production" },
};

function isLocalDevelopment(nodeEnv, channel) {
  return nodeEnv === "development" && !channel;
}

/**
 * @param {{workerUrl?: string, environment?: string, channel?: string | null, nodeEnv?: string}} input
 */
function resolveWorkerTarget({ workerUrl, environment, channel, nodeEnv }) {
  const label = environment?.trim();
  const value = workerUrl?.trim();
  const local = isLocalDevelopment(nodeEnv, channel);
  if (local && (!label || label === "development") && !value) {
    return "http://localhost:8787";
  }
  const targetName = channel || label;
  const target = Object.hasOwn(targets, targetName) ? targets[targetName] : undefined;
  if (!target) {
    throw new Error("Select a known Murmur environment and update channel before building or publishing.");
  }
  if (label !== target.label || !value) {
    throw new Error("Murmur requires an explicit environment and Worker URL matching the installed update channel.");
  }
  const url = new URL(value);
  if (local && label === "development" &&
      url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    return url.origin;
  }
  if (value.replace(/\/$/, "") !== target.url) {
    throw new Error("Murmur Worker URL does not match the selected environment and installed update channel.");
  }
  return target.url;
}

module.exports = { resolveWorkerTarget };
