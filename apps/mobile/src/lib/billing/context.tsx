import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { MobileBillingTelemetryEventName } from "@murmur/protocol/telemetry";

import type { MurmurCustomer } from "./customerResponse";
import type { MurmurPaywallOutcome } from "./revenueCat";

export type MurmurBillingContext = {
  busy: boolean;
  customer: MurmurCustomer | null;
  deleteAccount: () => Promise<void>;
  error: string | null;
  manageSubscription: () => Promise<void>;
  notice: string | null;
  openPaywall: () => Promise<void>;
  purchasesAvailable: boolean;
  refresh: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  sendSignInCode: (email: string) => Promise<void>;
  switchAccount: () => Promise<void>;
  syncing: boolean;
  verifySignInCode: (email: string, otp: string) => Promise<void>;
};

const unavailableBillingContext: MurmurBillingContext = {
  busy: false,
  customer: null,
  deleteAccount: async () => undefined,
  error: null,
  manageSubscription: async () => undefined,
  notice: null,
  openPaywall: async () => undefined,
  purchasesAvailable: false,
  refresh: async () => undefined,
  restorePurchases: async () => undefined,
  sendSignInCode: async () => undefined,
  switchAccount: async () => undefined,
  syncing: false,
  verifySignInCode: async () => undefined,
};

const BillingContext = createContext<MurmurBillingContext>(unavailableBillingContext);

export function MurmurBillingProvider({ children }: { children: ReactNode }): ReactNode {
  const [busy, setBusy] = useState(true);
  const [customer, setCustomer] = useState<MurmurCustomer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [purchasesAvailable, setPurchasesAvailable] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadCustomer = useCallback(async (): Promise<MurmurCustomer> => {
    const { fetchMurmurCustomer } = await import("./customerApi");
    const { configureRevenueCat } = await import("./revenueCat");
    const nextCustomer = await fetchMurmurCustomer();
    const available = await configureRevenueCat(nextCustomer.revenueCatCustomerId);
    setCustomer(nextCustomer);
    setPurchasesAvailable(available);
    return nextCustomer;
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      await loadCustomer();
      setError(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }, [loadCustomer]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextCustomer = await loadCustomer();
        if (active && nextCustomer.isRegistered && nextCustomer.fulfillmentEnabled) {
          const { reconcileMurmurCustomer } = await import("./customerApi");
          await reconcileMurmurCustomer("login");
          captureBillingTelemetry("mobile_reconciliation_succeeded", { resultCategory: "login" });
          if (active) {
            await loadCustomer();
          }
        }
        if (active) {
          setError(null);
        }
      } catch (failure) {
        if (active) {
          captureBillingTelemetry("mobile_reconciliation_failed", { resultCategory: "login" });
          setError(errorMessage(failure));
        }
      } finally {
        if (active) {
          setBusy(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [loadCustomer]);

  const reconcileWithBackoff = useCallback(async (
    trigger: "purchase" | "restore",
  ): Promise<boolean> => {
    const { reconcileMurmurCustomer } = await import("./customerApi");
    const delaysMs = [0, 500, 1_500, 3_000];
    let lastFailure: unknown = null;
    setSyncing(true);
    try {
      for (const delayMs of delaysMs) {
        if (delayMs > 0) {
          await delay(delayMs);
        }
        try {
          const result = await reconcileMurmurCustomer(trigger);
          if (result.purchaseCount + result.subscriptionCount > 0) {
            captureBillingTelemetry("mobile_reconciliation_succeeded", {
              resultCategory: trigger,
            });
            return true;
          }
        } catch (failure) {
          lastFailure = failure;
        }
      }
      if (lastFailure) {
        captureBillingTelemetry("mobile_reconciliation_failed", { resultCategory: trigger });
        throw lastFailure;
      }
      captureBillingTelemetry("mobile_reconciliation_succeeded", {
        resultCategory: `${trigger}_empty`,
      });
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  const runStoreAction = useCallback(async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setError(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<MurmurBillingContext>(() => ({
    busy,
    customer,
    deleteAccount: async () => {
      setBusy(true);
      try {
        const { deleteMurmurAccount } = await import("../auth/client");
        await deleteMurmurAccount();
        setCustomer(null);
        setPurchasesAvailable(false);
        setError(null);
        setNotice("Murmur account deleted. Store subscriptions must still be cancelled in the store.");
      } catch (failure) {
        setError(errorMessage(failure));
        throw failure;
      } finally {
        setBusy(false);
      }
    },
    error,
    manageSubscription: () => runStoreAction(async () => {
      const { presentMurmurCustomerCenter } = await import("./revenueCat");
      await presentMurmurCustomerCenter();
      await loadCustomer();
    }),
    notice,
    openPaywall: () => runStoreAction(async () => {
      assertPaywallAvailable(customer);
      const outcome = await presentPaywallWithTelemetry();
      if (isAbandonedPaywall(outcome)) {
        capturePaywallCancellation(outcome);
        setNotice("No purchase was made.");
        return;
      }
      if (outcome === "failed") {
        capturePaywallFailure(outcome);
        throw new Error("The store could not complete the purchase.");
      }
      captureBillingTelemetry("mobile_checkout_succeeded", {
        packageLabel: "store_paywall",
        resultCategory: outcome,
      });
      const converged = await reconcileWithBackoff(outcome === "restored" ? "restore" : "purchase");
      await loadCustomer();
      setNotice(converged
        ? "Purchase verified. Your balance is up to date."
        : "The store finished, but your balance is still syncing. Tap Refresh balance shortly.");
    }),
    purchasesAvailable,
    refresh,
    restorePurchases: () => runStoreAction(async () => {
      if (!customer?.isRegistered) {
        throw new Error("Add and verify an email before restoring purchases.");
      }
      if (!customer.fulfillmentEnabled) {
        throw new Error("Purchase restoration is temporarily unavailable.");
      }
      const { restoreMurmurPurchases } = await import("./revenueCat");
      captureBillingTelemetry("mobile_restore_started");
      try {
        await restoreMurmurPurchases();
      } catch (failure) {
        captureBillingTelemetry("mobile_restore_failed", { resultCategory: "store_error" });
        throw failure;
      }
      const converged = await reconcileWithBackoff("restore");
      await loadCustomer();
      setNotice(converged
        ? "Eligible purchases restored and your balance is up to date."
        : "No eligible purchases were found yet. If you just bought one, tap Refresh balance shortly.");
      captureBillingTelemetry("mobile_restore_succeeded", {
        resultCategory: converged ? "converged" : "empty",
      });
    }),
    sendSignInCode: async (email) => {
      setBusy(true);
      captureBillingTelemetry("mobile_registration_started");
      try {
        const { sendEmailSignInCode } = await import("../auth/client");
        await sendEmailSignInCode(email);
        setError(null);
      } catch (failure) {
        setError(errorMessage(failure));
        throw failure;
      } finally {
        setBusy(false);
      }
    },
    switchAccount: async () => {
      setBusy(true);
      try {
        const { switchMurmurAccount } = await import("../auth/client");
        await switchMurmurAccount();
        await loadCustomer();
        setError(null);
        setNotice("Switched to a fresh Murmur guest account. Sign in to recover another balance.");
      } catch (failure) {
        setError(errorMessage(failure));
        throw failure;
      } finally {
        setBusy(false);
      }
    },
    syncing,
    verifySignInCode: async (email, otp) => {
      setBusy(true);
      try {
        const { verifyEmailSignInCode } = await import("../auth/client");
        await verifyEmailSignInCode(email, otp);
        const nextCustomer = await loadCustomer();
        if (nextCustomer.fulfillmentEnabled) {
          const { reconcileMurmurCustomer } = await import("./customerApi");
          await reconcileMurmurCustomer("login");
          await loadCustomer();
        }
        captureBillingTelemetry("mobile_registration_completed");
        setError(null);
      } catch (failure) {
        setError(errorMessage(failure));
        throw failure;
      } finally {
        setBusy(false);
      }
    },
  }), [
    busy,
    customer,
    error,
    loadCustomer,
    notice,
    purchasesAvailable,
    reconcileWithBackoff,
    refresh,
    runStoreAction,
    syncing,
  ]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useMurmurBilling(): MurmurBillingContext {
  return useContext(BillingContext);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertPaywallAvailable(customer: MurmurCustomer | null): asserts customer is MurmurCustomer {
  if (!customer?.isRegistered) {
    throw new Error("Add and verify an email before making a purchase.");
  }
  if (!customer.purchasesEnabled) {
    throw new Error("New purchases are temporarily unavailable.");
  }
  if (!customer.fulfillmentEnabled) {
    throw new Error("Purchase verification is temporarily unavailable.");
  }
}

async function presentPaywallWithTelemetry(): Promise<MurmurPaywallOutcome> {
  const { presentMurmurPaywall } = await import("./revenueCat");
  captureBillingTelemetry("mobile_paywall_opened", { packageLabel: "store_paywall" });
  captureBillingTelemetry("mobile_checkout_started", { packageLabel: "store_paywall" });
  try {
    return await presentMurmurPaywall();
  } catch (failure) {
    capturePaywallFailure("store_error");
    throw failure;
  }
}

function isAbandonedPaywall(
  outcome: MurmurPaywallOutcome,
): outcome is "cancelled" | "not_presented" {
  return outcome === "cancelled" || outcome === "not_presented";
}

function capturePaywallCancellation(outcome: "cancelled" | "not_presented"): void {
  captureBillingTelemetry("mobile_checkout_cancelled", {
    packageLabel: "store_paywall",
    resultCategory: outcome,
  });
}

function capturePaywallFailure(resultCategory: "failed" | "store_error"): void {
  captureBillingTelemetry("mobile_checkout_failed", {
    packageLabel: "store_paywall",
    resultCategory,
  });
  captureBillingTelemetry("mobile_paywall_failed", { resultCategory });
}

function errorMessage(failure: unknown): string {
  return failure instanceof Error ? failure.message : "Murmur billing is temporarily unavailable.";
}

function captureBillingTelemetry(
  event: MobileBillingTelemetryEventName,
  options: { packageLabel?: string; resultCategory?: string } = {},
): void {
  void import("../telemetry").then((telemetry) => telemetry.captureBillingTelemetry(event, options));
}
