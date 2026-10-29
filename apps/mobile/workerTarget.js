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

function resolveLocalWorkerUrl({ nodeEnv, channel, label, value }) {
  if (nodeEnv !== "development" || channel || (label && label !== "development")) return undefined;
  if (!value) return "http://localhost:8787";
  const url = new URL(value);
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    return url.origin;
  }
  return undefined;
}

/**
 * @param {{workerUrl?: string, environment?: string, channel?: string | null, nodeEnv?: string, isDevelopmentClient?: boolean}} input
 */
function resolveWorkerTarget({ workerUrl, environment, channel, nodeEnv, isDevelopmentClient = false }) {
  const label = environment?.trim();
  const value = workerUrl?.trim();
  const localUrl = resolveLocalWorkerUrl({ nodeEnv, channel, label, value });
  if (localUrl) return localUrl;
  const targetName = channel || label;
  const target = Object.hasOwn(targets, targetName) ? targets[targetName] : undefined;
  if (!target) {
    throw new Error("Select a known Murmur environment and update channel before building or publishing.");
  }
  if (isDevelopmentClient && target === targets.production) {
    throw new Error("Murmur development clients cannot select the production Worker, including production updates.");
  }
  if (label !== target.label || !value) {
    throw new Error("Murmur requires an explicit environment and Worker URL matching the installed update channel.");
  }
  if (value.replace(/\/$/, "") !== target.url) {
    throw new Error("Murmur Worker URL does not match the selected environment and installed update channel.");
  }
  return target.url;
}

module.exports = { resolveWorkerTarget };
