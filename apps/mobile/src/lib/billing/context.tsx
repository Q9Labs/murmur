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
import { loadPlansWithTelemetry } from "./planLoading";

export type MurmurBillingContext = {
  busy: boolean;
  config: MurmurAppConfig;
  configLoaded: boolean;
  customer: MurmurCustomer | null;
  deleteAccount: () => Promise<void>;
  error: string | null;
  manageSubscription: () => Promise<void>;
  initialized: boolean;
  loadPlans: () => Promise<MurmurPlan[]>;
  loadPlansSilently: () => Promise<MurmurPlan[]>;
  notice: string | null;
  purchasePlan: (planId: string) => Promise<void>;
  purchasesAvailable: boolean;
  refresh: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  sendSignInCode: (email: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  switchAccount: () => Promise<void>;
  syncing: boolean;
  verifySignInCode: (email: string, otp: string) => Promise<void>;
};

const unavailableBillingContext: MurmurBillingContext = {
  busy: false,
  config: defaultAppConfig,
  configLoaded: true,
  customer: null,
  deleteAccount: async () => undefined,
  error: null,
  initialized: true,
  loadPlans: async () => [],
  loadPlansSilently: async () => [],
  manageSubscription: async () => undefined,
  notice: null,
  purchasePlan: async () => undefined,
  purchasesAvailable: false,
  refresh: async () => undefined,
  restorePurchases: async () => undefined,
  sendSignInCode: async () => undefined,
  signInWithApple: async () => undefined,
  signInWithGoogle: async () => undefined,
  switchAccount: async () => undefined,
  syncing: false,
  verifySignInCode: async () => undefined,
};

const BillingContext = createContext<MurmurBillingContext>(unavailableBillingContext);

export function MurmurBillingProvider({ children }: { children: ReactNode }): ReactNode {
  // A count, not a flag: overlapping operations must not clear each other's busy state.
  const [busyCount, setBusyCount] = useState(1);
  const busy = busyCount > 0;
  const beginBusy = useCallback(() => setBusyCount((count) => count + 1), []);
  const endBusy = useCallback(() => setBusyCount((count) => count - 1), []);
  const [initialized, setInitialized] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
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
    beginBusy();
    try {
      const { fetchMurmurAppConfig } = await import("./customerApi");
      const [nextConfig] = await Promise.all([fetchMurmurAppConfig(), loadCustomer()]);
      setConfig(nextConfig);
      setError(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      endBusy();
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
      .catch(reportAppConfigFailure)
      .finally(() => {
        if (active) {
          setConfigLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextCustomer = await loadCustomer();
        if (active && nextCustomer.fulfillmentEnabled) {
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
          setInitialized(true);
          endBusy();
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
    beginBusy();
    setNotice(null);
    try {
      await action();
      setError(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      endBusy();
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

  const serverOfferingId = config.paywallOfferingId;
  const loadPlans = useCallback(
    () => loadPlansWithTelemetry(serverOfferingId, captureBillingTelemetry),
    [serverOfferingId],
  );
  const loadPlansSilently = useCallback(async () => {
    const { loadMurmurPlans } = await import("./revenueCat");
    return loadMurmurPlans(serverOfferingId);
  }, [serverOfferingId]);

  const completeSignIn = useCallback(async (): Promise<void> => {
    const nextCustomer = await loadCustomer();
    if (nextCustomer.fulfillmentEnabled) {
      const { reconcileMurmurCustomer } = await import("./customerApi");
      reconciliationSnapshot.current = await reconcileMurmurCustomer("login");
      await loadCustomer();
    }
    captureBillingTelemetry("mobile_registration_completed");
    setError(null);
  }, [loadCustomer]);

  const value = useMemo<MurmurBillingContext>(() => ({
    busy,
    config,
    configLoaded,
    customer,
    deleteAccount: async () => {
      beginBusy();
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
        endBusy();
      }
    },
    error,
    initialized,
    loadPlans,
    loadPlansSilently,
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
      if (!customer?.fulfillmentEnabled) {
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
      beginBusy();
      captureBillingTelemetry("mobile_registration_started");
      try {
        const { sendEmailSignInCode } = await import("../auth/client");
        await sendEmailSignInCode(email);
      } finally {
        endBusy();
      }
    },
    signInWithApple: async () => {
      beginBusy();
      try {
        const { signInWithApple } = await import("../auth/client");
        if (await signInWithApple()) {
          await completeSignIn();
        }
      } finally {
        endBusy();
      }
    },
    signInWithGoogle: async () => {
      beginBusy();
      try {
        const { signInWithGoogle } = await import("../auth/client");
        if (await signInWithGoogle()) {
          await completeSignIn();
        }
      } finally {
        endBusy();
      }
    },
    switchAccount: async () => {
      beginBusy();
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
        endBusy();
      }
    },
    syncing,
    verifySignInCode: async (email, otp) => {
      beginBusy();
      try {
        const { verifyEmailSignInCode } = await import("../auth/client");
        await verifyEmailSignInCode(email, otp);
        await completeSignIn();
      } finally {
        endBusy();
      }
    },
  }), [
    beginBusy,
    busy,
    completeStorePurchase,
    completeSignIn,
    config,
    configLoaded,
    customer,
    endBusy,
    error,
    initialized,
    loadCustomer,
    loadPlans,
    loadPlansSilently,
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
  if (!customer) {
    throw new Error("Your Murmur account is still loading.");
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
