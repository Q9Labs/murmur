import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MurmurBillingContext } from "../../lib/billing/context";
import { en } from "../__tests__/uiText";
import { fixtureBilling, fixturePlans } from "../__tests__/billingFixture";
import { fixtureServices } from "../__tests__/servicesFixture";
import { router } from "../__tests__/navigation";
import { recorded, resetRecorded } from "../__tests__/reactNativePrimitives";

const planLoads = vi.hoisted(() => [] as Array<{ load: () => Promise<unknown>; open: boolean }>);
const signInBilling = vi.hoisted(() => ({ current: null as MurmurBillingContext | null }));

vi.mock("../../lib/observability/sentry", () => ({ captureMobileFailure: vi.fn() }));
vi.mock("../screenServices", () => ({ useScreenServices: () => fixtureServices() }));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("react-native-svg", () => ({ default: () => null, Path: () => null }));
vi.mock("../../lib/billing/context", () => ({ useMurmurBilling: () => signInBilling.current }));
vi.mock("../plans/planList", () => ({
  usePlanList: (open: boolean, load: () => Promise<unknown>) => {
    planLoads.push({ load, open });
    return { plans: { plans: fixturePlans, status: "ready" }, refresh: vi.fn() };
  },
}));

import {
  checkoutAvailability,
  checkoutDoneAction,
  findCheckoutPlan,
  planIdFromParam,
  SignInScreen,
} from "./signInScreen";

function doneButton() {
  return recorded.controls.find(
    (control) => control.accessibilityRole === "button" && control.accessibilityLabel === undefined,
  );
}

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
  signInBilling.current = fixtureBilling({ isRegistered: true });
});

describe("sign-in screen", () => {
  it("reads the plan from the deep link", () => {
    expect(planIdFromParam("$rc_annual")).toBe("$rc_annual");
    expect(planIdFromParam(["pack_300"])).toBe("pack_300");
    expect(planIdFromParam(" ")).toBeUndefined();
  });

  it("titles the screen for the email step and offers Apple and Google there", () => {
    const markup = renderToStaticMarkup(<SignInScreen />);

    expect(markup).toContain("Sign in");
    expect(markup).toContain("Continue with Apple");
    expect(markup).toContain("Continue with Google");
    expect(renderToStaticMarkup(<SignInScreen initialState={{ email: "maya@example.com", step: "done" }} />))
      .not.toContain("Continue with Google");
  });

  it("buys the chosen plan right after signing in", () => {
    const markup = renderToStaticMarkup(
      <SignInScreen initialState={{ email: "maya@example.com", step: "done" }} planId="$rc_annual" />,
    );

    expect(markup).toContain("You&#x27;re signed in");
    expect(markup).toContain("Subscribe for $99.99 / year");
    doneButton()?.onPress?.();
    expect(signInBilling.current?.purchasePlan).toHaveBeenCalledWith("$rc_annual");
    expect(router.back).toHaveBeenCalledOnce();
  });

  it("just goes back when signing in without a plan", () => {
    const markup = renderToStaticMarkup(<SignInScreen initialState={{ email: "maya@example.com", step: "done" }} />);

    expect(markup).toContain("Done");
    doneButton()?.onPress?.();
    expect(signInBilling.current?.purchasePlan).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalledOnce();
  });

  it("keeps the checkout intent while the plan list reloads", () => {
    const purchasePlan = vi.fn(async () => true);
    const leave = vi.fn();
    const action = checkoutDoneAction({ availability: "ready", leave, plan: null, planId: "$rc_annual", purchasePlan, ui: en });

    expect(findCheckoutPlan({ status: "loading" }, "$rc_annual")).toBeNull();
    expect(action.label).toBe("Continue to checkout");
    action.onPress();
    expect(purchasePlan).toHaveBeenCalledWith("$rc_annual");
    expect(leave).toHaveBeenCalledOnce();
  });

  it("finds the chosen plan once the list is ready", () => {
    expect(findCheckoutPlan({ plans: fixturePlans, status: "ready" }, "trip_pass_60")?.title).toBe("Trip Pass");
    expect(findCheckoutPlan({ plans: fixturePlans, status: "ready" }, undefined)).toBeNull();
    expect(findCheckoutPlan({ plans: fixturePlans, status: "ready" }, "gone")).toBeNull();
  });

  it("preloads the plan quietly and only once billing is ready", () => {
    planLoads.length = 0;
    renderToStaticMarkup(<SignInScreen planId="$rc_annual" />);
    expect(planLoads[0]?.open).toBe(true);
    expect(planLoads[0]?.load).toBe(signInBilling.current?.loadPlansSilently);

    planLoads.length = 0;
    signInBilling.current = { ...fixtureBilling({ isRegistered: true }), initialized: false };
    renderToStaticMarkup(<SignInScreen planId="$rc_annual" />);
    expect(planLoads[0]?.open).toBe(false);
  });

  it("does not offer checkout when purchases can't go through", () => {
    const leave = vi.fn();
    const purchasePlan = vi.fn(async () => true);
    const unavailable = checkoutDoneAction({ availability: "unavailable", leave, plan: null, planId: "$rc_annual", purchasePlan, ui: en });
    expect(unavailable.label).toBe("Back to plans");
    unavailable.onPress();
    expect(purchasePlan).not.toHaveBeenCalled();

    expect(checkoutDoneAction({ availability: "busy", leave, plan: null, planId: "$rc_annual", purchasePlan, ui: en }).disabled)
      .toBe(true);
  });

  it("reads checkout availability from billing", () => {
    const signedIn = fixtureBilling({ isRegistered: true });
    expect(checkoutAvailability(signedIn)).toBe("ready");
    expect(checkoutAvailability({ ...signedIn, busy: true })).toBe("busy");
    expect(checkoutAvailability({ ...signedIn, purchasesAvailable: false })).toBe("unavailable");
    expect(checkoutAvailability(fixtureBilling({ isRegistered: true, purchasesEnabled: false }))).toBe("unavailable");
    expect(checkoutAvailability(fixtureBilling())).toBe("unavailable");
  });
});
