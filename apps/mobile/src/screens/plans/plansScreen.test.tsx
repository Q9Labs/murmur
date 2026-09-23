import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureBilling, fixtureYearly } from "../__tests__/billingFixture";
import { router } from "../__tests__/navigation";

const plansBilling = vi.hoisted(() => ({ initialized: true }));
const planList = vi.hoisted(() => ({ opens: [] as boolean[], props: null as null | { mode: { kind: string; onSignUp?: (plan: unknown) => void } } }));

vi.mock("./planList", () => ({
  PlanList: (props: { mode: { kind: string; onSignUp?: (plan: unknown) => void } }) => {
    planList.props = props;
    return null;
  },
  usePlanList: (open: boolean) => {
    planList.opens.push(open);
    return { plans: { status: "loading" }, refresh: vi.fn() };
  },
}));
vi.mock("../../lib/billing/context", () => ({
  useMurmurBilling: () => ({ ...fixtureBilling(), initialized: plansBilling.initialized }),
}));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));

import { planTermFromParam, PlansScreen } from "./plansScreen";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("plans screen", () => {
  it("reads the tab from the deep link", () => {
    expect(planTermFromParam("monthly")).toBe("monthly");
    expect(planTermFromParam(["yearly"])).toBe("yearly");
    expect(planTermFromParam("packs")).toBe("pack");
    expect(planTermFromParam("toString")).toBeUndefined();
    expect(planTermFromParam(undefined)).toBeUndefined();
  });

  it("sends signed-out listeners to sign in with the chosen plan", () => {
    const markup = renderToStaticMarkup(<PlansScreen offer={<p>offer slot</p>} />);

    expect(markup).toContain("Plans");
    expect(markup).toContain("offer slot");
    expect(planList.props?.mode.kind).toBe("sign_up");
    planList.props?.mode.onSignUp?.(fixtureYearly);
    expect(router.push).toHaveBeenCalledWith({ params: { plan: "$rc_annual" }, pathname: "/sign-in" });
  });

  it("waits for billing to initialise before loading plans on a cold deep link", () => {
    planList.opens.length = 0;
    plansBilling.initialized = false;
    renderToStaticMarkup(<PlansScreen />);
    plansBilling.initialized = true;
    renderToStaticMarkup(<PlansScreen />);

    expect(planList.opens).toEqual([false, true]);
  });
});
