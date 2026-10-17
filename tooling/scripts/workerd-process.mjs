import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";

// Own one process group, reject occupied ports, and survive the caller's death.
export async function startWorkerd({ workerRoot, fixture, statePath, port, variables, stream }) {
  const reservation = createServer();
  reservation.listen(port, "127.0.0.1");
  await once(reservation, "listening");
  await new Promise((done) => reservation.close(done));
  const child = spawn("pnpm", ["exec", "wrangler", "dev", fixture, "--local", "--env", "sandbox",
    "--ip", "127.0.0.1", "--port", String(port), "--persist-to", statePath,
    ...Object.entries(variables).flatMap(([key, value]) => ["--var", `${key}:${value}`])],
  { cwd: workerRoot, detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  const watchdog = spawn(process.execPath, ["-e", `
    const deadline = Date.now() + 120000;
    setInterval(() => {
      try { process.kill(${child.pid}, 0); } catch { process.exit(0); }
      let alive = true;
      try { process.kill(${process.pid}, 0); } catch { alive = false; }
      if (!alive || Date.now() > deadline) {
        try { process.kill(-${child.pid}, 'SIGTERM'); } catch {}
        process.exit(0);
      }
    }, 1000);
  `], { detached: true, stdio: "ignore" });
  watchdog.unref();
  // Cleanup must cover normal exit, failed startup and termination races.
  // fallow-ignore-next-line complexity
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null && child.pid) {
      const exited = once(child, "exit");
      process.kill(-child.pid, "SIGTERM");
      const force = setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 3000);
      try { await exited; } finally { clearTimeout(force); }
    }
    if (watchdog.exitCode === null && watchdog.signalCode === null) watchdog.kill("SIGTERM");
  };
  let timer;
  try {
    await new Promise((ready, reject) => {
      timer = setTimeout(() => reject(new Error("workerd startup timed out")), 90_000);
      const receive = (chunk) => { const line = chunk.toString(); stream.push(line); if (line.includes(`Ready on http://127.0.0.1:${port}`)) ready(); };
      child.stdout.on("data", receive);
      child.stderr.on("data", receive);
      child.once("error", reject);
      child.once("exit", () => reject(new Error("workerd exited before readiness")));
    });
    return stop;
  } catch (error) {
    await stop();
    throw error;
  } finally { clearTimeout(timer); }
}
