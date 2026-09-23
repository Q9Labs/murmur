import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MurmurBillingContext } from "../../lib/billing/context";
import { fixtureBilling } from "../__tests__/billingFixture";
import { router } from "../__tests__/navigation";
import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";

const billingRef = vi.hoisted(() => ({ current: null as MurmurBillingContext | null }));
const accountLock = vi.hoisted(() => ({ locked: false }));

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("../../lib/billing/context", () => ({ useMurmurBilling: () => billingRef.current }));
vi.mock("../settings/settingsControls", () => ({ useSettingsControls: () => accountLock }));

import { AccountScreen, formatMinutes } from "./accountScreen";

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

  it("formats minutes and hours", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(120 * 60_000)).toBe("2 hr");
  });
});
