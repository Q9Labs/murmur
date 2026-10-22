import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MurmurBillingContext } from "../../lib/billing/context";
import type { MurmurPlan } from "../../lib/billing/planCatalog";
import { fixtureBilling } from "../__tests__/billingFixture";
import { router } from "../__tests__/navigation";
import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";
import { previewPlans } from "../previewFixtures";

const state = vi.hoisted(() => ({ billing: null as MurmurBillingContext | null, plans: [] as MurmurPlan[] }));
const linking = vi.hoisted(() => ({ openURL: vi.fn().mockResolvedValue(undefined) }));
vi.mock("expo-linking", () => linking);
vi.mock("@sentry/react-native", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("react-native-safe-area-context", () => import("../__tests__/navigation").then((m) => m.safeAreaMock));
vi.mock("lucide-react-native", () => ({ X: () => null }));
vi.mock("../../home/variants/hooks", () => ({ useReducedMotion: () => true }));
vi.mock("../../lib/billing/context", () => ({ useMurmurBilling: () => state.billing }));
vi.mock("../plans/planList", () => ({
  PlanListStatus: () => <p>No plans</p>,
  usePlanList: () => ({ plans: { status: "ready", plans: state.plans }, refresh: vi.fn() }),
}));

import { PaywallScreen } from "./paywallScreen";

beforeEach(() => { vi.clearAllMocks(); resetRecorded(); state.billing = fixtureBilling(); state.plans = previewPlans; });

describe("demo-first paywall", () => {
  it.each([
    ["pack", "$7.99 once", "60 minutes that never expire.", "Buy for $7.99", "One payment. No subscription."],
    ["monthly", "Pro, $9.99 / month", "2 hours of translation every month.", "Subscribe for $9.99 / month", "Renews automatically. Cancel anytime."],
    ["yearly", "Pro, $99.99 / year", "2 hours of translation every month.", "Subscribe for $99.99 / year", "Renews automatically. Cancel anytime."],
  ] as const)("renders %s price, detail, checkout and small print", (key, price, detail, cta, finePrint) => {
    const markup = renderToStaticMarkup(<PaywallScreen initialKey={key} />);
    for (const text of [price, detail, cta, finePrint]) expect(markup).toContain(text);
    expect(recorded.controls.filter((control) => control.accessibilityRole === "tab")).toHaveLength(3);
  });
  it("defaults to Trip Pass and hides unavailable segments", () => {
    expect(renderToStaticMarkup(<PaywallScreen />)).toContain("Buy for $7.99");
    resetRecorded();
    state.plans = previewPlans.filter((plan) => plan.term === "monthly");
    const markup = renderToStaticMarkup(<PaywallScreen initialKey="pack" />);
    expect(markup).toContain("Subscribe for $9.99 / month");
    expect(markup).not.toContain("Trip Pass");
    expect(recorded.controls.filter((control) => control.accessibilityRole === "tab")).toHaveLength(1);
  });
  it("uses the existing purchase flow, including guest save-purchase", async () => {
    renderToStaticMarkup(<PaywallScreen />);
    recorded.controls.find((control) => control.accessibilityRole === "button" && !control.accessibilityLabel)?.onPress?.();
    expect(state.billing?.purchasePlan).toHaveBeenCalledWith("trip_pass_60");
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/save-purchase"));
  });
  it("keeps Close, All plans, restore and legal links working", () => {
    renderToStaticMarkup(<PaywallScreen />);
    findControl("Close")?.onPress?.();
    expect(router.back).toHaveBeenCalledOnce();
    findControl("All plans")?.onPress?.();
    expect(router.push).toHaveBeenCalledWith("/plans");
    findControl("Restore purchases")?.onPress?.();
    expect(state.billing?.restorePurchases).toHaveBeenCalledOnce();
    findControl("Terms of use")?.onPress?.();
    findControl("Privacy policy")?.onPress?.();
    expect(linking.openURL).toHaveBeenCalledWith("https://murmur.q9labs.ai/terms");
    expect(linking.openURL).toHaveBeenCalledWith("https://murmur.q9labs.ai/privacy");
  });
  it("does not offer a purchase when the store has no eligible plans", () => {
    state.plans = [];
    expect(renderToStaticMarkup(<PaywallScreen />)).toContain("No plans");
    expect(recorded.controls.filter((control) => control.accessibilityRole === "tab")).toHaveLength(0);
  });
});
