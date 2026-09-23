import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MurmurBillingContext } from "../../lib/billing/context";
import { fixtureBilling, fixturePlans } from "../__tests__/billingFixture";
import { router } from "../__tests__/navigation";
import { recorded, resetRecorded } from "../__tests__/reactNativePrimitives";

const signInBilling = vi.hoisted(() => ({ current: null as MurmurBillingContext | null }));

vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("lucide-react-native", () => ({ Check: () => null }));
vi.mock("../../lib/billing/context", () => ({ useMurmurBilling: () => signInBilling.current }));
vi.mock("../plans/planList", () => ({
  usePlanList: () => ({ plans: { plans: fixturePlans, status: "ready" }, refresh: vi.fn() }),
}));

import { planIdFromParam, SignInScreen } from "./signInScreen";

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

  it("titles the screen for the email step", () => {
    expect(renderToStaticMarkup(<SignInScreen />)).toContain("Sign in");
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
});
