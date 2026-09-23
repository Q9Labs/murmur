import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MurmurBillingContext } from "../../lib/billing/context";
import { fixtureBilling, fixtureCustomer } from "../__tests__/billingFixture";
import { router } from "../__tests__/navigation";
import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";

const billingRef = vi.hoisted(() => ({ current: null as MurmurBillingContext | null }));
const accountLock = vi.hoisted(() => ({ locked: false }));
const telemetry = vi.hoisted(() => ({ captureBillingTelemetry: vi.fn() }));

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("../../lib/billing/context", () => ({ useMurmurBilling: () => billingRef.current }));
vi.mock("../settings/settingsControls", () => ({ useSettingsControls: () => accountLock }));
vi.mock("../../lib/telemetry", () => telemetry);

import { AccountScreen, hasUnsavedPurchase, packValidity, reportAccountViewed } from "./accountScreen";

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
  accountLock.locked = false;
});

describe("account screen", () => {
  it("shows a guest their balance, sign-in and one primary action", () => {
    billingRef.current = fixtureBilling({ availableMs: 5 * 60_000 });
    const markup = renderToStaticMarkup(<AccountScreen />);

    expect(markup).toContain("5 min");
    expect(markup).toContain("left on Free");
    expect(findControl("Restore purchases")).toBeUndefined();
    findControl("Sign in")?.onPress?.();
    expect(router.push).toHaveBeenCalledWith("/sign-in");
    findControl("Get more time")?.onPress?.();
    expect(router.push).toHaveBeenCalledWith("/plans");
  });

  it("gives a signed-in Pro listener purchase management and a guarded delete", () => {
    billingRef.current = fixtureBilling({ availableMs: 97 * 60_000, isRegistered: true, plan: "pro" });
    const markup = renderToStaticMarkup(<AccountScreen />);

    expect(markup).toContain("1 hr 37 min");
    findControl("Restore purchases")?.onPress?.();
    expect(billingRef.current.restorePurchases).toHaveBeenCalledOnce();
    expect(findControl("Manage subscription")).toBeDefined();
    findControl("Delete account")?.onPress?.();
    expect(recorded.alerts[0]?.title).toBe("Delete your Murmur account?");
    recorded.alerts[0]?.buttons.find((button) => button.style === "destructive")?.onPress?.();
    expect(billingRef.current.deleteAccount).toHaveBeenCalledOnce();
    findControl("Use a different account")?.onPress?.();
    recorded.alerts[1]?.buttons[1]?.onPress?.();
    expect(billingRef.current.switchAccount).toHaveBeenCalledOnce();
  });

  it("locks every account action during a live session", () => {
    accountLock.locked = true;
    billingRef.current = fixtureBilling({ isRegistered: true, plan: "pro" });
    const markup = renderToStaticMarkup(<AccountScreen />);

    expect(markup).toContain("Stop translating to manage your account.");
    for (const label of ["Restore purchases", "Manage subscription", "Refresh balance", "Use a different account", "Delete account"]) {
      expect(findControl(label)?.disabled).toBe(true);
    }
  });

  it("records that the account screen was viewed", async () => {
    reportAccountViewed();

    await vi.waitFor(() => {
      expect(telemetry.captureBillingTelemetry).toHaveBeenCalledWith("mobile_billing_screen_viewed");
    });
  });

  it("reminds a guest who bought something to save it, until they sign in", () => {
    billingRef.current = fixtureBilling({ availableMs: 118 * 60_000, plan: "pro" });
    renderToStaticMarkup(<AccountScreen />);

    expect(findControl("Sign in")).toBeUndefined();
    findControl("Save your purchase")?.onPress?.();
    expect(router.push).toHaveBeenCalledWith("/save-purchase");
    expect(hasUnsavedPurchase({ ...fixtureCustomer, creditMs: 60_000 })).toBe(true);
    expect(hasUnsavedPurchase({ ...fixtureCustomer, isRegistered: true, plan: "pro" })).toBe(false);
    expect(hasUnsavedPurchase(fixtureCustomer)).toBe(false);
  });

  it("shows how long pack minutes stay valid", () => {
    billingRef.current = fixtureBilling({
      availableMs: 60 * 60_000,
      creditMs: 90 * 60_000,
      creditPacks: [
        { expiresAtMs: Date.UTC(2027, 0, 10, 12), grantId: "event", remainingMs: 30 * 60_000 },
        { expiresAtMs: Date.UTC(2026, 11, 22, 12), grantId: "trip", remainingMs: 60 * 60_000 },
        { expiresAtMs: Date.UTC(2026, 10, 1, 12), grantId: "spent", remainingMs: 0 },
      ],
      isRegistered: true,
      plan: "pro_max",
    });
    const markup = renderToStaticMarkup(<AccountScreen />);
    const lines = packValidity(billingRef.current.customer);

    expect(markup).toContain("left on Pro Max");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^1 hr pack\. Valid until /);
    expect(lines[1]).toMatch(/^30 min pack\. Valid until /);
    expect(markup).toContain(lines[0]);
    expect(packValidity(null)).toEqual([]);
  });
});
