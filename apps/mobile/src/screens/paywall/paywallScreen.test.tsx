import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MurmurBillingContext } from "../../lib/billing/context";
import type { MurmurPlan } from "../../lib/billing/planCatalog";
import { fixtureBilling } from "../__tests__/billingFixture";
import { router } from "../__tests__/navigation";
import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";
import { previewPlans } from "../previewFixtures";

const state = vi.hoisted(() => ({ billing: null as MurmurBillingContext | null, plans: [] as MurmurPlan[], focused: true }));
const effects = vi.hoisted(() => [] as Array<() => void>);
const telemetry = vi.hoisted(() => ({ captureMobileTelemetry: vi.fn() }));
vi.mock("../../lib/telemetry", () => telemetry);
vi.mock("react", async (importOriginal) => ({ ...await importOriginal<typeof import("react")>(), useEffect: (effect: () => void) => effects.push(effect) }));
const linking = vi.hoisted(() => ({ openURL: vi.fn().mockResolvedValue(undefined) }));
vi.mock("expo-linking", () => linking);
vi.mock("@sentry/react-native", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => ({ ...m.expoRouterMock, useFocusEffect: (effect: () => void) => { if (state.focused) effects.push(effect); } })));
vi.mock("react-native-safe-area-context", () => import("../__tests__/navigation").then((m) => m.safeAreaMock));
vi.mock("lucide-react-native", () => ({ X: () => null }));
vi.mock("../../home/variants/hooks", () => ({ useReducedMotion: () => true }));
vi.mock("../../lib/billing/context", () => ({ useMurmurBilling: () => state.billing }));
vi.mock("../plans/planList", () => ({
  PlanListStatus: () => <p>No plans</p>,
  usePlanList: (_open: boolean, load: () => Promise<MurmurPlan[]>) => { effects.push(() => { void load(); }); return ({ plans: { status: "ready", plans: state.plans }, refresh: vi.fn() }); },
}));

import PaywallRoute from "../../../app/paywall";
import { PaywallScreen } from "./paywallScreen";

beforeEach(() => { vi.clearAllMocks(); resetRecorded(); effects.length = 0; state.focused = true; state.billing = fixtureBilling(); state.plans = previewPlans; });

describe("demo-first paywall", () => {
  it.each([
    ["pack", "$7.99 once", "60 minutes that never expire.", "Buy for $7.99", "One payment. No subscription."],
    ["monthly", "Pro, $9.99 / month", "2 hours of translation every month.", "Subscribe for $9.99 / month", "Renews automatically. Cancel anytime."],
    ["yearly", "Pro, $99.99 / year", "2 hours of translation every month.", "Subscribe for $99.99 / year", "Renews automatically. Cancel anytime."],
  ] as const)("renders %s price, detail, checkout and small print", (key, price, detail, cta, finePrint) => {
    const markup = renderToStaticMarkup(<PaywallScreen initialKey={key} />);
    expect(markup).toContain("Example: Arabic to English");
    for (const text of [price, detail, cta, finePrint]) expect(markup).toContain(text);
    expect(recorded.controls.filter((control) => control.accessibilityRole === "tab")).toHaveLength(3);
  });
  it.each([
    ["monthly", "$7.99", "first month", "Then $9.99 a month"],
    ["yearly", "$79.99", "first year", "Then $99.99 a year"],
  ] as const)("discloses the %s introductory and renewal prices before purchase", (key, price, period, renewal) => {
    state.plans = previewPlans.map((plan) => plan.term === key ? { ...plan, introPrice: { amount: 1, price } } : plan);
    const markup = renderToStaticMarkup(<PaywallScreen initialKey={key} />);
    expect(markup).toContain(`Pro, ${price} ${period}`);
    expect(markup).toContain(`Subscribe for ${price} ${period}`);
    expect(markup).toContain(renewal);
  });
  it.each(["pack", "monthly", "yearly"] as const)("reports the hard paywall and the %s segment", async (key) => {
    renderToStaticMarkup(<PaywallScreen initialKey={key} />);
    effects.splice(0).forEach((effect) => effect());
    expect(state.billing?.loadPlans).toHaveBeenCalledWith("hard_paywall");
    await vi.waitFor(() => expect(telemetry.captureMobileTelemetry).toHaveBeenCalledWith({ event: "plan_tab_viewed", surface: "hard_paywall", tab: key === "pack" ? "credit_packs" : key }));
  });
  it.each(["purchase", "restore", "all plans"])("returns a registered customer home after %s unlocks their balance", async (action) => {
    state.billing = fixtureBilling({ isRegistered: true, freeAllowanceMs: 0, availableMs: 0 });
    renderToStaticMarkup(<PaywallScreen />);
    effects.splice(0).forEach((effect) => effect());
    expect(router.dismissTo).not.toHaveBeenCalled();
    if (action === "purchase") {
      recorded.controls.find((control) => control.accessibilityRole === "button" && !control.accessibilityLabel)?.onPress?.();
      await vi.waitFor(() => expect(state.billing?.purchasePlan).toHaveBeenCalledWith("trip_pass_60"));
    } else if (action === "restore") {
      findControl("Restore purchases")?.onPress?.();
      expect(state.billing?.restorePurchases).toHaveBeenCalledOnce();
    } else {
      findControl("All plans")?.onPress?.();
      expect(router.push).toHaveBeenCalledWith("/plans");
    }
    state.billing = fixtureBilling({ isRegistered: true, freeAllowanceMs: 0, availableMs: 60_000 });
    renderToStaticMarkup(<PaywallScreen />);
    effects.splice(0).forEach((effect) => effect());
    expect(router.dismissTo).toHaveBeenCalledWith("/");
    expect(router.back).not.toHaveBeenCalled();
  });
  it("defaults to Trip Pass and hides unavailable segments", () => {
    expect(renderToStaticMarkup(<PaywallRoute />)).toContain("Buy for $7.99");
    resetRecorded();
    state.plans = previewPlans.filter((plan) => plan.term === "monthly");
    const markup = renderToStaticMarkup(<PaywallScreen initialKey="pack" />);
    expect(markup).toContain("Subscribe for $9.99 / month");
    expect(markup).not.toContain("Trip Pass");
    expect(recorded.controls.filter((control) => control.accessibilityRole === "tab")).toHaveLength(1);
  });
  it("uses the existing purchase flow, including guest save-purchase", async () => {
    state.billing = fixtureBilling({ freeAllowanceMs: 0, availableMs: 0 });
    renderToStaticMarkup(<PaywallScreen />);
    effects.splice(0).forEach((effect) => effect());
    recorded.controls.find((control) => control.accessibilityRole === "button" && !control.accessibilityLabel)?.onPress?.();
    expect(state.billing?.purchasePlan).toHaveBeenCalledWith("trip_pass_60");
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/save-purchase"));
    state.focused = false;
    state.billing = fixtureBilling({ freeAllowanceMs: 0, availableMs: 60_000 });
    renderToStaticMarkup(<PaywallScreen />);
    effects.splice(0).forEach((effect) => effect());
    state.billing = fixtureBilling({ freeAllowanceMs: 0, availableMs: 60_000, isRegistered: true });
    renderToStaticMarkup(<PaywallScreen />);
    effects.splice(0).forEach((effect) => effect());
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
  });
  it.each(["restore", "all plans"])("returns a guest home after %s unlocks their balance", (action) => {
    state.billing = fixtureBilling({ freeAllowanceMs: 0, availableMs: 0 });
    renderToStaticMarkup(<PaywallScreen />);
    effects.splice(0).forEach((effect) => effect());
    findControl(action === "restore" ? "Restore purchases" : "All plans")?.onPress?.();
    if (action === "all plans") {
      expect(router.push).toHaveBeenCalledWith("/plans");
      state.focused = false;
    } else {
      expect(state.billing?.restorePurchases).toHaveBeenCalledOnce();
    }
    state.billing = fixtureBilling({ freeAllowanceMs: 0, availableMs: 60_000 });
    renderToStaticMarkup(<PaywallScreen />);
    effects.splice(0).forEach((effect) => effect());
    if (action === "all plans") {
      expect(router.dismissTo).not.toHaveBeenCalled();
      state.focused = true;
      renderToStaticMarkup(<PaywallScreen />);
      effects.splice(0).forEach((effect) => effect());
    }
    expect(router.dismissTo).toHaveBeenCalledWith("/");
    expect(router.replace).not.toHaveBeenCalled();
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
