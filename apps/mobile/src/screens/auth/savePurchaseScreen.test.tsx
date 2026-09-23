import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MurmurBillingContext } from "../../lib/billing/context";
import { fixtureBilling } from "../__tests__/billingFixture";
import { router } from "../__tests__/navigation";
import { findControl, reactNativePrimitives, resetRecorded } from "../__tests__/reactNativePrimitives";
import { fixtureServices } from "../__tests__/servicesFixture";
import type { ScreenServices } from "../screenServices";

const state = vi.hoisted(() => ({
  billing: null as MurmurBillingContext | null,
  services: null as ScreenServices | null,
}));

vi.mock("../screenServices", () => ({ useScreenServices: () => state.services }));
vi.mock("../../lib/billing/context", () => ({ useMurmurBilling: () => state.billing }));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("react-native-svg", () => ({ default: () => null, Path: () => null }));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));

import { SavePurchaseScreen } from "./savePurchaseScreen";

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
  reactNativePrimitives.Platform.OS = "ios";
  state.billing = fixtureBilling({ plan: "pro" });
  state.services = fixtureServices();
});

describe("save your purchase", () => {
  it("offers Apple first on iOS, then Google and email, and can be skipped", () => {
    const markup = renderToStaticMarkup(<SavePurchaseScreen />);

    expect(markup).toContain("Save your purchase");
    expect(markup.indexOf("Continue with Apple")).toBeLessThan(markup.indexOf("Continue with Google"));
    expect(markup).toContain("Continue with email");
    findControl("Continue with Apple")?.onPress?.();
    expect(state.services?.signInWithApple).toHaveBeenCalledOnce();
    findControl("Continue with Google")?.onPress?.();
    expect(state.services?.signInWithGoogle).toHaveBeenCalledOnce();
    findControl("Continue with email")?.onPress?.();
    expect(router.replace).toHaveBeenCalledWith("/sign-in");
    findControl("Not now")?.onPress?.();
    expect(router.back).toHaveBeenCalledOnce();
  });

  it("leaves Apple out on Android", () => {
    reactNativePrimitives.Platform.OS = "android";
    const markup = renderToStaticMarkup(<SavePurchaseScreen />);

    expect(markup).not.toContain("Continue with Apple");
    expect(markup).toContain("Continue with Google");
  });

  it("confirms once the purchase is saved", () => {
    state.billing = fixtureBilling({ isRegistered: true, plan: "pro" });
    const markup = renderToStaticMarkup(<SavePurchaseScreen />);

    expect(markup).toContain("Purchase saved");
    findControl("Done")?.onPress?.();
    expect(router.back).toHaveBeenCalledOnce();
  });
});
