// Sandbox-only entry point. Never referenced by the production Wrangler config.
import worker from "./src/entrypoint";
import { RateLimitDurableObject as RateLimiter } from "./src/rateLimitDurableObject";
import { CustomerLedgerDurableObject as CustomerLedger } from "./src/billing/customerLedgerDurableObject";
import type { Env } from "./src/env";

type Fault = { operation: "get" | "put" | "database"; email: string };
const cases = ["rate_load", "rate_save", "alarm_load", "alarm_save", "ledger_bind_read", "ledger_bind_write", "ledger_execute"] as const;
type ProbeCase = typeof cases[number];

function parseCase(value: string | null): ProbeCase | undefined {
  return cases.find((candidate) => candidate === value);
}
// Validate the complete injected fault before it reaches a real storage boundary.
// fallow-ignore-next-line complexity
function readFault(request: Request): Fault {
  const operation = request.headers.get("x-probe-operation");
  const email = request.headers.get("x-probe-email");
  if (!email || !/^[a-z0-9-]+@example\.invalid$/.test(email) || (operation !== "get" && operation !== "put" && operation !== "database")) throw new Error("invalid_privacy_probe");
  return { operation, email };
}

function storageFault(state: DurableObjectState, fault: () => Fault | undefined): DurableObjectState {
  const storage = new Proxy(state.storage, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        if (fault()?.operation === key) throw new Error(fault()?.email);
        return Reflect.apply(value, target, args);
      };
    },
  });
  return new Proxy(state, {
    get(target, key) {
      if (key === "storage") return storage;
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function databaseFault(database: D1Database | undefined, fault: () => Fault | undefined): D1Database | undefined {
  if (!database) return undefined;
  return new Proxy(database, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        if (fault()?.operation === "database") throw new Error(fault()?.email);
        return Reflect.apply(value, target, args);
      };
    },
  });
}

export class RateLimitDurableObject extends RateLimiter {
  private fault: Fault | undefined;
  constructor(private readonly actualState: DurableObjectState) {
    let readFaultState: () => Fault | undefined = () => undefined;
    super(storageFault(actualState, () => readFaultState()));
    readFaultState = () => this.fault;
  }

  // Sandbox control messages stay together; ordinary calls use the real class.
  // fallow-ignore-next-line complexity
  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/cleanup") {
      await this.actualState.storage.deleteAlarm();
      await this.actualState.storage.deleteAll();
      return Response.json({ cleaned: true });
    }
    if (path === "/envelopes") {
      if (request.method === "POST") {
        const body = await request.text();
        await this.actualState.blockConcurrencyWhile(async () => {
          try {
            const envelopes = await this.actualState.storage.get<string[]>("envelopes") ?? [];
            envelopes.push(body);
            await this.actualState.storage.put("envelopes", envelopes);
          } catch { throw new Error("privacy_probe_collector_failed"); }
        });
      }
      return Response.json(await this.actualState.storage.get<string[]>("envelopes") ?? []);
    }
    if (path === "/arm-alarm") {
      await this.actualState.storage.put("probe-alarm", readFault(request));
      await this.actualState.storage.setAlarm(Date.now() + 1000);
      return Response.json({ armed: true });
    }
    this.fault = request.headers.has("x-probe-operation") ? readFault(request) : undefined;
    return super.fetch(request);
  }

  override async alarm(): Promise<void> {
    try {
      this.fault = await this.actualState.storage.get<Fault>("probe-alarm");
      await this.actualState.storage.delete("probe-alarm");
      if (this.fault) await super.alarm();
    } catch {
      // Setup failures must not add a second, unsafe runtime boundary in the harness.
      throw new Error("privacy_probe_alarm_failed");
    }
  }
}

export class CustomerLedgerDurableObject extends CustomerLedger {
  private fault: Fault | undefined;
  constructor(private readonly actualState: DurableObjectState, env: Env) {
    let readFaultState: () => Fault | undefined = () => undefined;
    super(storageFault(actualState, () => readFaultState()), { ...env, BILLING_DB: databaseFault(env.BILLING_DB, () => readFaultState()) });
    readFaultState = () => this.fault;
  }
  // Sandbox control messages stay together; ordinary calls use the real class.
  // fallow-ignore-next-line complexity
  override async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/cleanup") {
      await this.actualState.storage.deleteAll();
      return Response.json({ cleaned: true });
    }
    this.fault = readFault(request);
    return super.fetch(request);
  }
}

function stub(env: Env, name: string, ledger = false) {
  const namespace = ledger ? env.CUSTOMER_LEDGER : env.RATE_LIMITER;
  if (!namespace) throw new Error("privacy_probe_namespace_missing");
  return namespace.get(namespace.idFromName(name));
}

export default {
  // Explicit sandbox route/auth checks keep the fault matrix out of production.
  // fallow-ignore-next-line complexity
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    if (env.MURMUR_ENV !== "sandbox") return new Response(null, { status: 404 });
    const url = new URL(request.url);
    if (url.pathname === "/api/1/envelope/") {
      if (request.method !== "POST" || !(url.searchParams.get("sentry_key") === "privacyproof" || request.headers.get("x-sentry-auth")?.includes("sentry_key=privacyproof"))) return new Response(null, { status: 403 });
      await stub(env, "privacy-proof-envelopes").fetch("https://probe.internal/envelopes", { method: "POST", body: await request.text() });
      return Response.json({ accepted: true });
    }
    const authenticated = Boolean(env.MURMUR_DIAGNOSTICS_FIXTURE) && request.headers.get("Authorization") === `Bearer ${env.MURMUR_DIAGNOSTICS_FIXTURE}`;
    if (url.pathname === "/__diagnostics/privacy") {
      if (!authenticated) return new Response(null, { status: 403 });
      if (url.searchParams.get("case") === "envelopes") return stub(env, "privacy-proof-envelopes").fetch("https://probe.internal/envelopes");
      if (url.searchParams.get("case") === "cleanup-envelopes") return stub(env, "privacy-proof-envelopes").fetch("https://probe.internal/cleanup");
      const probe = parseCase(url.searchParams.get("case"));
      const run = url.searchParams.get("run");
      if (!probe || !run || !/^[a-f0-9]{16}$/.test(run)) return new Response(null, { status: 400 });
      const target = stub(env, `privacy-review-${run}-${probe}`, probe.startsWith("ledger"));
      if (request.method === "DELETE") return target.fetch("https://probe.internal/cleanup");
      const operation = probe === "ledger_execute" ? "database" : ["rate_load", "alarm_load", "ledger_bind_read"].includes(probe) ? "get" : "put";
      const headers = { "x-probe-operation": operation, "x-probe-email": request.headers.get("x-probe-email") ?? "", "x-murmur-ledger-internal": "1" };
      try {
        return await target.fetch(`https://probe.internal/${probe.startsWith("alarm") ? "arm-alarm" : `probe/${probe}`}`, {
          method: "POST", headers, body: JSON.stringify(probe.startsWith("ledger") ? { action: "get_balance", customerId: crypto.randomUUID(), nowMs: Date.now() } : { action: "get_session", app_session_id: crypto.randomUUID() }),
        });
      } catch { return Response.json({ failure_observed: true }, { status: 503 }); }
    }
    if (authenticated && request.headers.get("x-probe-operation") === "database") {
      const fault = readFault(request);
      return worker.fetch(request, { ...env, BILLING_DB: databaseFault(env.BILLING_DB, () => fault) }, context);
    }
    return worker.fetch(request, env, context);
  },
};
