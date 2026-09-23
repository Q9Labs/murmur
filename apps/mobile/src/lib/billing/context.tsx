import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { MobileBillingTelemetryEventName } from "@murmur/protocol/telemetry";

import { defaultAppConfig, type MurmurAppConfig } from "./appConfig";
import type { MurmurCustomer } from "./customerResponse";
import {
  didReconciliationAdvance,
  type ReconciliationSnapshot,
} from "./reconciliation";
import type { MurmurPlan } from "./planCatalog";

export type MurmurBillingContext = {
  busy: boolean;
  config: MurmurAppConfig;
  customer: MurmurCustomer | null;
  deleteAccount: () => Promise<void>;
  error: string | null;
  manageSubscription: () => Promise<void>;
  loadPlans: () => Promise<MurmurPlan[]>;
  notice: string | null;
  purchasePlan: (planId: string) => Promise<void>;
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
  config: defaultAppConfig,
  customer: null,
  deleteAccount: async () => undefined,
  error: null,
  loadPlans: async () => [],
  manageSubscription: async () => undefined,
  notice: null,
  purchasePlan: async () => undefined,
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
  const [config, setConfig] = useState(defaultAppConfig);
  const [customer, setCustomer] = useState<MurmurCustomer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [purchasesAvailable, setPurchasesAvailable] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const reconciliationSnapshot = useRef<ReconciliationSnapshot | null>(null);

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
    void import("./customerApi")
      .then(({ fetchMurmurAppConfig }) => fetchMurmurAppConfig())
      .then((nextConfig) => {
        if (active) {
          setConfig(nextConfig);
        }
      })
      .catch(reportAppConfigFailure);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextCustomer = await loadCustomer();
        if (active && nextCustomer.isRegistered && nextCustomer.fulfillmentEnabled) {
          const { reconcileMurmurCustomer } = await import("./customerApi");
          reconciliationSnapshot.current = await reconcileMurmurCustomer("login");
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
    const baseline = reconciliationSnapshot.current;
    let lastFailure: unknown = null;
    let lastResult: ReconciliationSnapshot | null = null;
    setSyncing(true);
    try {
      for (const delayMs of delaysMs) {
        if (delayMs > 0) {
          await delay(delayMs);
        }
        try {
          const result = await reconcileMurmurCustomer(trigger);
          lastFailure = null;
          lastResult = result;
          if (didReconciliationAdvance(baseline, result)) {
            reconciliationSnapshot.current = result;
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
      reconciliationSnapshot.current = lastResult;
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
  const completeStorePurchase = useCallback(async () => {
    captureBillingTelemetry("mobile_checkout_succeeded", {
      packageLabel: "plan_picker",
      resultCategory: "purchased",
    });
    const converged = await reconcileWithBackoff("purchase");
    await loadCustomer();
    setNotice(converged
      ? "Purchase verified. Your balance is up to date."
      : "The store finished, but your balance is still syncing. Tap Refresh balance shortly.");
  }, [loadCustomer, reconcileWithBackoff]);

  const value = useMemo<MurmurBillingContext>(() => ({
    busy,
    config,
    customer,
    deleteAccount: async () => {
      setBusy(true);
      try {
        const { deleteMurmurAccount } = await import("../auth/client");
        await deleteMurmurAccount();
        reconciliationSnapshot.current = null;
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
    loadPlans: async () => {
      const { loadMurmurPlans } = await import("./revenueCat");
      const plans = await loadMurmurPlans(config.paywallOfferingId);
      captureBillingTelemetry("mobile_paywall_opened", { packageLabel: "plan_picker" });
      return plans;
    },
    manageSubscription: () => runStoreAction(async () => {
      const { presentMurmurCustomerCenter } = await import("./revenueCat");
      await presentMurmurCustomerCenter();
      await loadCustomer();
    }),
    notice,
    purchasePlan: (planId) => runStoreAction(async () => {
      assertPaywallAvailable(customer);
      const { purchaseMurmurPlan } = await import("./revenueCat");
      captureBillingTelemetry("mobile_checkout_started", { packageLabel: planId });
      const outcome = await purchaseMurmurPlan(planId, config.paywallOfferingId).catch(
        (failure: unknown) => {
          capturePaywallFailure("store_error");
          throw failure;
        },
      );
      if (outcome === "cancelled") {
        capturePaywallCancellation();
        setNotice("No purchase was made.");
        return;
      }
      await completeStorePurchase();
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
      } finally {
        setBusy(false);
      }
    },
    switchAccount: async () => {
      setBusy(true);
      try {
        const { switchMurmurAccount } = await import("../auth/client");
        await switchMurmurAccount();
        reconciliationSnapshot.current = null;
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
          reconciliationSnapshot.current = await reconcileMurmurCustomer("login");
          await loadCustomer();
        }
        captureBillingTelemetry("mobile_registration_completed");
        setError(null);
      } finally {
        setBusy(false);
      }
    },
  }), [
    busy,
    completeStorePurchase,
    config,
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

export function MurmurBillingFixtureProvider(props: {
  billing: MurmurBillingContext;
  children: ReactNode;
}): ReactNode {
  return <BillingContext.Provider value={props.billing}>{props.children}</BillingContext.Provider>;
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

function capturePaywallCancellation(): void {
  captureBillingTelemetry("mobile_checkout_cancelled", {
    packageLabel: "plan_picker",
    resultCategory: "cancelled",
  });
}

function capturePaywallFailure(resultCategory: "store_error"): void {
  captureBillingTelemetry("mobile_checkout_failed", {
    packageLabel: "plan_picker",
    resultCategory,
  });
  captureBillingTelemetry("mobile_paywall_failed", { resultCategory });
}

function reportAppConfigFailure(failure: unknown): void {
  void import("../observability/sentry").then(({ captureMobileFailure }) => {
    captureMobileFailure(failure, { operation: "load_app_config", stage: "billing" });
  });
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
