import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MurmurBillingContext } from "../../lib/billing/context";
import type { MurmurPlan } from "../../lib/billing/planCatalog";
import { fixtureBilling, fixtureMonthly, fixturePlans } from "../__tests__/billingFixture";
import { router } from "../__tests__/navigation";
import { resetRecorded } from "../__tests__/reactNativePrimitives";

const state = vi.hoisted(() => ({
  billing: null as MurmurBillingContext | null,
  offer: null as null | { discountPercent: number | null; expiresAtMs: number | null },
  opens: [] as boolean[],
  plans: { status: "loading" } as { plans?: MurmurPlan[]; status: string },
}));

vi.mock("lucide-react-native", () => ({ Check: () => null }));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("../../lib/billing/context", () => ({ useMurmurBilling: () => state.billing }));
vi.mock("./offerBanner", () => ({
  OfferBanner: (props: { discountPercent: number | null; expiresAtMs: number | null }) => {
    state.offer = props;
    return null;
  },
  remainingOfferMs: (expiresAtMs: number | null, nowMs: number) => (expiresAtMs === null ? 0 : expiresAtMs - nowMs),
}));
vi.mock("./planList", () => ({
  PlanListStatus: () => <p>plan status</p>,
  usePlanList: (open: boolean) => {
    state.opens.push(open);
    return { plans: state.plans, refresh: vi.fn() };
  },
}));

import { planTermFromParam, PlansScreen } from "./plansScreen";

beforeEach(() => {
  vi.clearAllMocks();
  resetRecorded();
  state.billing = fixtureBilling();
  state.plans = { status: "loading" };
});

describe("plans screen", () => {
  it("reads the tab from the deep link", () => {
    expect(planTermFromParam("monthly")).toBe("monthly");
    expect(planTermFromParam(["yearly"])).toBe("yearly");
    expect(planTermFromParam("packs")).toBe("pack");
    expect(planTermFromParam("toString")).toBeUndefined();
    expect(planTermFromParam(undefined)).toBeUndefined();
  });

  it("shows the store status while plans load", () => {
    const markup = renderToStaticMarkup(<PlansScreen />);

    expect(markup).toContain("plan status");
    expect(markup).not.toContain("Subscribe");
  });

  it("puts the purchase in the footer and sends a guest buyer to save the purchase", async () => {
    state.plans = { plans: fixturePlans, status: "ready" };
    const markup = renderToStaticMarkup(<PlansScreen initialTerm="monthly" />);

    expect(markup).toContain("Subscribe for $9.99 / month");
    const buy = markup.indexOf("Subscribe for");
    expect(buy).toBeGreaterThan(markup.indexOf("Pro Max"));
    const { recorded } = await import("../__tests__/reactNativePrimitives");
    recorded.controls.find((control) => control.accessibilityRole === "button")?.onPress?.();
    expect(state.billing?.purchasePlan).toHaveBeenCalledWith(fixtureMonthly.id);
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/save-purchase"));
  });

  it("passes the personal offer's real expiry and discount to the banner", () => {
    const expiresAtMs = Date.now() + 3_600_000;
    state.billing = { ...fixtureBilling(), config: { ...fixtureBilling().config, personalOffer: { expiresAt: new Date(expiresAtMs).toISOString(), offeringId: "personal_offer" } } };
    state.plans = {
      plans: [{ ...fixtureMonthly, introPrice: { amount: 7.99, price: "$7.99" } }],
      status: "ready",
    };
    renderToStaticMarkup(<PlansScreen />);

    expect(state.offer).toEqual({ discountPercent: 20, expiresAtMs });
  });

  it("waits for billing to finish loading before loading plans on a cold deep link", () => {
    state.opens.length = 0;
    state.billing = { ...fixtureBilling(), initialized: false };
    renderToStaticMarkup(<PlansScreen />);
    state.billing = fixtureBilling();
    renderToStaticMarkup(<PlansScreen />);

    expect(state.opens).toEqual([false, true]);
  });
});
