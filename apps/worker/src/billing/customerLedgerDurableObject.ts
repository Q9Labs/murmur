/// <reference types="@cloudflare/workers-types" />

import type { Env } from "../env";
import { decodeCustomerLedgerCommand } from "./customerLedgerCommandDecoder";
import type {
  CustomerLedgerCommand,
  LedgerCommandResult,
} from "./contracts";
import {
  AllowanceExhaustedError,
  CustomerDeletedError,
  CustomerMismatchError,
  LedgerRepository,
  UsageSessionClosedError,
} from "./ledgerRepository";

const customerStateKey = "customer_id";
const generationStateKey = "usage_generation";
const internalHeader = "x-murmur-ledger-internal";

export class CustomerLedgerDurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  // Cloudflare invokes this Durable Object entry point outside the TypeScript graph.
  // fallow-ignore-next-line unused-class-member
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get(internalHeader) !== "1") {
      return response({ code: "invalid_ledger_command", ok: false }, 403);
    }
    const command = decodeCustomerLedgerCommand(await request.json().catch(() => null));
    if (!command) {
      return response({ code: "invalid_ledger_command", ok: false }, 400);
    }
    const database = this.env.BILLING_DB;
    if (!database) {
      return response({ code: "billing_unavailable", ok: false }, 503);
    }

    return this.state.blockConcurrencyWhile(async () => {
      const bindingFailure = await bindCustomer(this.state.storage, command.customerId);
      if (bindingFailure) {
        return bindingFailure;
      }
      try {
        return await executeLedgerCommand(
          new LedgerRepository(database),
          this.state.storage,
          command,
        );
      } catch (error) {
        const handled = ledgerErrorResponse(error);
        if (handled) {
          return handled;
        }
        throw error;
      }
    });
  }
}

export async function callCustomerLedger(
  namespace: DurableObjectNamespace | undefined,
  customerId: string,
  command: CustomerLedgerCommand,
): Promise<{ response: Response; result: LedgerCommandResult }> {
  if (!namespace) {
    const unavailable = response({ code: "billing_unavailable", ok: false }, 503);
    return {
      response: unavailable,
      result: { code: "billing_unavailable", ok: false },
    };
  }
  const stub = namespace.get(namespace.idFromName(customerId));
  const ledgerResponse = await stub.fetch("https://customer-ledger.internal/", {
    body: JSON.stringify(command),
    headers: { [internalHeader]: "1", "content-type": "application/json" },
    method: "POST",
  });
  const result: LedgerCommandResult = await ledgerResponse.json();
  return { response: ledgerResponse, result };
}

function response(result: LedgerCommandResult, status = 200): Response {
  return Response.json(result, { status });
}

async function bindCustomer(
  storage: DurableObjectStorage,
  customerId: string,
): Promise<Response | null> {
  const boundCustomerId = await storage.get<string>(customerStateKey);
  if (boundCustomerId && boundCustomerId !== customerId) {
    return response({ code: "customer_mismatch", ok: false }, 409);
  }
  if (!boundCustomerId) {
    await storage.put(customerStateKey, customerId);
  }
  return null;
}

async function executeLedgerCommand(
  repository: LedgerRepository,
  storage: DurableObjectStorage,
  command: CustomerLedgerCommand,
): Promise<Response> {
  if (command.action === "open_usage_session") {
    const generation = (await storage.get<number>(generationStateKey) ?? 0) + 1;
    const result = await repository.openUsageSession({
      customerId: command.customerId,
      generation,
      nowMs: command.nowMs,
      usageSessionId: command.usageSessionId,
    });
    await storage.put(generationStateKey, result.generation);
    return response({ ...result, ok: true });
  }
  return executeStatelessLedgerCommand(repository, command);
}

async function executeStatelessLedgerCommand(
  repository: LedgerRepository,
  command: Exclude<CustomerLedgerCommand, { action: "open_usage_session" }>,
): Promise<Response> {
  switch (command.action) {
    case "bootstrap_guest":
      return response({ ...await repository.bootstrapGuest(command), ok: true });
    case "get_balance":
      return response({
        balance: await repository.getBalance(command.customerId, command.nowMs),
        idempotent: true,
        ok: true,
      });
    case "delete_customer":
      return response({ ...await repository.deleteCustomer(command), ok: true });
    case "close_usage_session":
      return response({ ...await repository.closeUsageSession(command), ok: true });
    case "grant_value":
      return response({ ...await repository.grantValue(command), ok: true });
    case "settle_usage":
      return response({ ...await repository.settleUsage(command), ok: true });
    case "reverse_grant":
      return response({ ...await repository.reverseGrant(command), ok: true });
    case "restore_grant":
      return response({ ...await repository.restoreGrant(command), ok: true });
  }
}

function ledgerErrorResponse(error: unknown): Response | null {
  if (error instanceof AllowanceExhaustedError) {
    return response(
      { availableMs: error.availableMs, code: "allowance_exhausted", ok: false },
      402,
    );
  }
  if (error instanceof CustomerDeletedError) {
    return response({ code: "customer_deleted", ok: false }, 410);
  }
  if (error instanceof CustomerMismatchError) {
    return response({ code: "customer_mismatch", ok: false }, 409);
  }
  if (error instanceof UsageSessionClosedError) {
    return response({ code: "usage_session_closed", ok: false }, 409);
  }
  return null;
}
