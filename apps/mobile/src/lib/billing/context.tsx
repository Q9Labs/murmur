import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { MurmurCustomer } from "./customerResponse";

export type MurmurBillingContext = {
  busy: boolean;
  customer: MurmurCustomer | null;
  deleteAccount: () => Promise<void>;
  error: string | null;
  manageSubscription: () => Promise<void>;
  openPaywall: () => Promise<void>;
  purchasesAvailable: boolean;
  refresh: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  sendSignInCode: (email: string) => Promise<void>;
  verifySignInCode: (email: string, otp: string) => Promise<void>;
};

const unavailableBillingContext: MurmurBillingContext = {
  busy: false,
  customer: null,
  deleteAccount: async () => undefined,
  error: null,
  manageSubscription: async () => undefined,
  openPaywall: async () => undefined,
  purchasesAvailable: false,
  refresh: async () => undefined,
  restorePurchases: async () => undefined,
  sendSignInCode: async () => undefined,
  verifySignInCode: async () => undefined,
};

const BillingContext = createContext<MurmurBillingContext>(unavailableBillingContext);

export function MurmurBillingProvider({ children }: { children: ReactNode }): ReactNode {
  const [busy, setBusy] = useState(true);
  const [customer, setCustomer] = useState<MurmurCustomer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchasesAvailable, setPurchasesAvailable] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const { fetchMurmurCustomer } = await import("./customerApi");
      const { configureRevenueCat } = await import("./revenueCat");
      const nextCustomer = await fetchMurmurCustomer();
      const available = await configureRevenueCat(nextCustomer.customerId);
      setCustomer(nextCustomer);
      setPurchasesAvailable(available);
      setError(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runStoreAction = useCallback(async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    try {
      await action();
      await refresh();
      setError(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

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
        await refresh();
        setError(null);
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
    }),
    openPaywall: () => runStoreAction(async () => {
      if (!customer?.isRegistered) {
        throw new Error("Add and verify an email before making a purchase.");
      }
      if (!customer.purchasesEnabled) {
        throw new Error("New purchases are temporarily unavailable.");
      }
      const { presentMurmurPaywall } = await import("./revenueCat");
      const { reconcileMurmurCustomer } = await import("./customerApi");
      await presentMurmurPaywall();
      await reconcileMurmurCustomer("purchase");
    }),
    purchasesAvailable,
    refresh,
    restorePurchases: () => runStoreAction(async () => {
      if (!customer?.isRegistered) {
        throw new Error("Add and verify an email before restoring purchases.");
      }
      const { restoreMurmurPurchases } = await import("./revenueCat");
      const { reconcileMurmurCustomer } = await import("./customerApi");
      await restoreMurmurPurchases();
      await reconcileMurmurCustomer("restore");
    }),
    sendSignInCode: async (email) => {
      setBusy(true);
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
    verifySignInCode: async (email, otp) => {
      setBusy(true);
      try {
        const { verifyEmailSignInCode } = await import("../auth/client");
        await verifyEmailSignInCode(email, otp);
        await refresh();
        setError(null);
      } catch (failure) {
        setError(errorMessage(failure));
        throw failure;
      } finally {
        setBusy(false);
      }
    },
  }), [busy, customer, error, purchasesAvailable, refresh, runStoreAction]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useMurmurBilling(): MurmurBillingContext {
  return useContext(BillingContext);
}

function errorMessage(failure: unknown): string {
  return failure instanceof Error ? failure.message : "Murmur billing is temporarily unavailable.";
}
