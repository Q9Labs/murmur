import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MurmurBillingContext } from "../lib/billing/context";
import type { MurmurCustomer } from "../lib/billing/customerResponse";

const harness = vi.hoisted(() => ({
  controls: [] as Array<{
    accessibilityLabel?: string;
    disabled?: boolean;
    onPress?: () => void;
  }>,
}));

vi.mock("react-native", () => {
  function Primitive({ children }: { children?: ReactNode }): ReactNode {
    return children ?? null;
  }
  function Pressable({
    accessibilityLabel,
    children,
    disabled,
    onPress,
    style,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    style?: unknown;
  }): ReactNode {
    harness.controls.push({ accessibilityLabel, disabled, onPress });
    if (typeof style === "function") {
      style({ pressed: false });
    }
    return <button>{children}</button>;
  }
  return {
    Image: () => null,
    Pressable,
    StyleSheet: { create: <T,>(styles: T): T => styles },
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    useColorScheme: () => "light",
    View: Primitive,
  };
});

vi.mock("./modalSheet", () => import("./__tests__/modalSheetMock"));
vi.mock("./accountBillingModal", () => ({
  EmailSignInForm: () => <form>email sign-in</form>,
}));
vi.mock("./illustrations", () => ({ outOfMinutesIllustration: 1 }));
vi.mock("../lib/billing/context", () => ({ useMurmurBilling: vi.fn() }));

import { OutOfMinutesSheet, type PlanListState } from "./outOfMinutesSheet";

const customer: MurmurCustomer = {
  allowanceMs: 300_000,
  availableMs: 0,
  creditMs: 0,
  customerId: "customer-1",
  earliestExpiryAtMs: null,
  fulfillmentEnabled: true,
  isRegistered: false,
  negativeMs: 0,
  plan: "free",
  purchasesEnabled: true,
  revenueCatCustomerId: "customer-1",
};

const plans: PlanListState = {
  plans: [
    { id: "$rc_monthly", kind: "pro", price: "$9.99 / month", title: "Murmur Pro" },
    { id: "pack_60", kind: "top_up", price: "$7.99", title: "60 minutes" },
  ],
  status: "ready",
};

function billing(overrides: Partial<MurmurCustomer> = {}): MurmurBillingContext {
  return {
    busy: false,
    config: { lowBalanceThresholdMinutes: 15, paywallOfferingId: null },
    customer: { ...customer, ...overrides },
    deleteAccount: vi.fn(),
    error: null,
    loadPlans: vi.fn(),
    manageSubscription: vi.fn(),
    notice: null,
    openPaywall: vi.fn(),
    purchasePlan: vi.fn(async () => undefined),
    purchasesAvailable: true,
    refresh: vi.fn(),
    restorePurchases: vi.fn(),
    sendSignInCode: vi.fn(),
    switchAccount: vi.fn(),
    syncing: false,
    verifySignInCode: vi.fn(),
  };
}

function renderSheet(params: {
  billing: MurmurBillingContext;
  onRetryPlans?: () => void;
  plans?: PlanListState;
  reason?: "exhausted" | "low_balance";
}): string {
  return renderToStaticMarkup(
    <OutOfMinutesSheet
      billing={params.billing}
      onClose={vi.fn()}
      onRetryPlans={params.onRetryPlans ?? vi.fn()}
      open
      plans={params.plans ?? plans}
      reason={params.reason ?? "exhausted"}
    />,
  );
}

beforeEach(() => {
  harness.controls.length = 0;
});

describe("out-of-minutes sheet", () => {
  it("shows anonymous listeners the plans first with a sign-up-to-buy action", () => {
    const anonymous = billing();
    const markup = renderSheet({ billing: anonymous });

    expect(markup).toContain("Out of minutes");
    expect(markup).toContain("You&#x27;ve used your 5 free minutes for this month.");
    expect(markup.indexOf("Murmur Pro")).toBeLessThan(markup.indexOf("60 minutes"));
    expect(markup.indexOf("60 minutes")).toBeLessThan(markup.indexOf("Sign up to buy"));
    expect(markup).toContain("$9.99 / month");
    expect(markup).not.toContain("email sign-in");
    const proRow = harness.controls.find((control) => control.accessibilityLabel === "Murmur Pro, $9.99 / month");
    expect(proRow?.disabled).toBe(false);
    proRow?.onPress?.();
    expect(anonymous.purchasePlan).not.toHaveBeenCalled();
  });

  it("lets signed-in listeners buy a plan straight from the sheet", () => {
    const signedIn = billing({ isRegistered: true });
    const markup = renderSheet({ billing: signedIn });

    expect(markup).not.toContain("email sign-in");
    expect(markup).not.toContain("Sign up to buy");
    expect(markup).toContain("Choose Pro or a top-up to keep talking.");
    const topUp = harness.controls.find((control) => control.accessibilityLabel === "60 minutes, $7.99");
    expect(topUp?.disabled).toBe(false);
    topUp?.onPress?.();
    expect(signedIn.purchasePlan).toHaveBeenCalledWith("pack_60");
  });

  it("tells paid listeners how much time is left when the balance runs low", () => {
    const markup = renderSheet({
      billing: billing({ availableMs: 12 * 60_000, isRegistered: true, plan: "pro" }),
      reason: "low_balance",
    });

    expect(markup).toContain("Running low");
    expect(markup).toContain("12 minutes left.");
  });

  it("offers a retry when the store cannot list plans", () => {
    const onRetryPlans = vi.fn();
    const markup = renderSheet({
      billing: billing({ isRegistered: true }),
      onRetryPlans,
      plans: { message: "Purchases are not configured in this build.", status: "failed" },
    });

    expect(markup).toContain("Purchases are not configured in this build.");
    harness.controls.find((control) => control.accessibilityLabel === "Try loading plans again")?.onPress?.();
    expect(onRetryPlans).toHaveBeenCalledOnce();
  });

  it("shows a loading state while the offering loads", () => {
    expect(renderSheet({ billing: billing(), plans: { status: "loading" } })).toContain("Loading plans");
  });
});
