import { callCustomerLedger } from "./customerLedgerDurableObject";

const pcm16BytesPerMillisecond = 48;
const maxUnsettledMs = 5_000;

export type AudioAcceptance = "accepted" | "allowance_exhausted" | "settlement_required";

export type RealtimeUsageMeter = {
  checkAudio: (byteLength: number) => AudioAcceptance;
  close: (outcome: "closed" | "failed") => Promise<void>;
  recordAudio: (byteLength: number) => void;
  settle: () => Promise<{ availableMs: number; exhausted: boolean }>;
};

export function createRealtimeUsageMeter(params: {
  availableMs: number;
  customerId: string;
  namespace: DurableObjectNamespace | undefined;
  usageSessionId: string;
}): RealtimeUsageMeter {
  let acceptedAudioBytes = 0;
  let availableMs = params.availableMs;
  let nextSettlementSequence = 1;
  let settledMs = 0;
  let activeSettlement: Promise<{ availableMs: number; exhausted: boolean }> | null = null;
  let closed = false;

  function acceptedMs(byteLength = acceptedAudioBytes): number {
    return Math.ceil(byteLength / pcm16BytesPerMillisecond);
  }

  function checkAudio(byteLength: number): AudioAcceptance {
    if (closed) {
      return "allowance_exhausted";
    }
    const targetAcceptedMs = acceptedMs(acceptedAudioBytes + byteLength);
    const nextUnsettledMs = targetAcceptedMs - settledMs;
    if (nextUnsettledMs > availableMs) {
      return "allowance_exhausted";
    }
    if (nextUnsettledMs > maxUnsettledMs) {
      return "settlement_required";
    }
    return "accepted";
  }

  function recordAudio(byteLength: number): void {
    if (checkAudio(byteLength) !== "accepted") {
      throw new Error("forwarded audio exceeded the authorized billing window");
    }
    acceptedAudioBytes += byteLength;
  }

  async function settleOnce(): Promise<{ availableMs: number; exhausted: boolean }> {
    if (closed) {
      return { availableMs, exhausted: availableMs <= 0 };
    }
    const targetSettledMs = acceptedMs();
    const amountMs = targetSettledMs - settledMs;
    if (amountMs <= 0) {
      return { availableMs, exhausted: availableMs <= 0 };
    }
    const ledger = await callCustomerLedger(params.namespace, params.customerId, {
      action: "settle_usage",
      amountMs,
      customerId: params.customerId,
      nowMs: Date.now(),
      settlementSequence: nextSettlementSequence,
      usageSessionId: params.usageSessionId,
    });
    if (!ledger.result.ok) {
      if (ledger.result.code === "allowance_exhausted") {
        availableMs = ledger.result.availableMs;
        return { availableMs, exhausted: true };
      }
      throw new Error(`usage settlement failed: ${ledger.result.code}`);
    }
    if (!("balance" in ledger.result)) {
      throw new Error("usage settlement returned no balance");
    }
    availableMs = ledger.result.balance.availableMs;
    settledMs = targetSettledMs;
    nextSettlementSequence += 1;
    return { availableMs, exhausted: availableMs <= 0 };
  }

  async function settle(): Promise<{ availableMs: number; exhausted: boolean }> {
    if (activeSettlement) {
      return activeSettlement;
    }
    activeSettlement = settleOnce().finally(() => {
      activeSettlement = null;
    });
    return activeSettlement;
  }

  async function close(outcome: "closed" | "failed"): Promise<void> {
    if (closed) {
      return;
    }
    let settlementFailure: unknown = null;
    try {
      await settle();
    } catch (failure) {
      settlementFailure = failure;
    }
    closed = true;
    try {
      const ledger = await callCustomerLedger(params.namespace, params.customerId, {
        action: "close_usage_session",
        customerId: params.customerId,
        nowMs: Date.now(),
        outcome,
        usageSessionId: params.usageSessionId,
      });
      if (!ledger.result.ok && ledger.result.code !== "usage_session_closed") {
        throw new Error(`usage close failed: ${ledger.result.code}`);
      }
    } catch (closeFailure) {
      if (settlementFailure instanceof Error && closeFailure instanceof Error) {
        throw new Error(
          `${settlementFailure.message}; ${closeFailure.message}`,
          { cause: closeFailure },
        );
      }
      throw closeFailure;
    }
    if (settlementFailure) {
      throw settlementFailure;
    }
  }

  return { checkAudio, close, recordAudio, settle };
}
