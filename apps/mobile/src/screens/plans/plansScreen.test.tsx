// cspell:ignore EUNSPECIFIED
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MurmurBillingContext } from "../../lib/billing/context";
import type { MurmurPlan } from "../../lib/billing/planCatalog";
import { fixtureBilling, fixtureMonthly, fixturePlans } from "../__tests__/billingFixture";
import { router } from "../__tests__/navigation";
import { findControl, resetRecorded } from "../__tests__/reactNativePrimitives";

const effects = vi.hoisted(() => [] as Array<() => void>);
const telemetry = vi.hoisted(() => ({ captureMobileTelemetry: vi.fn() }));
vi.mock("react", async (importOriginal) => ({ ...await importOriginal<typeof import("react")>(), useEffect: (effect: () => void) => effects.push(effect) }));
vi.mock("../../lib/telemetry", () => telemetry);
const linking = vi.hoisted(() => ({ openURL: vi.fn().mockResolvedValue(undefined) }));
vi.mock("expo-linking", () => linking);

const state = vi.hoisted(() => ({
  billing: null as MurmurBillingContext | null,
  offer: null as null | { discountPercent: number | null; expiresAtMs: number | null },
  opens: [] as boolean[],
  plans: { status: "loading" } as { plans?: MurmurPlan[]; status: string },
}));

vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
const sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@sentry/react-native", () => sentry);
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("../../lib/billing/context", () => ({ useMurmurBilling: () => state.billing }));
vi.mock("./offerBanner", async (importOriginal) => ({
  ...await importOriginal<typeof import("./offerBanner")>(),
  OfferBanner: (props: { discountPercent: number | null; expiresAtMs: number | null }) => {
    state.offer = props;
    return null;
  },
}));
vi.mock("./planList", () => ({
  PlanListStatus: () => <p>plan status</p>,
  usePlanList: (open: boolean) => {
    state.opens.push(open);
    return { plans: state.plans, refresh: vi.fn() };
  },
}));

import { planTermFromParam, PlansScreen } from "./plansScreen";
import { sanitizeMobileEvent } from "../../lib/observability/sentry";

beforeEach(() => {
  vi.clearAllMocks();
  resetRecorded();
  effects.length = 0;
  state.billing = fixtureBilling();
  state.plans = { status: "loading" };
});

describe("plans screen", () => {
  it("identifies Plans as the tab-view surface", async () => {
    state.plans = { plans: fixturePlans, status: "ready" };
    renderToStaticMarkup(<PlansScreen initialTerm="monthly" />);
    effects.splice(0).forEach((effect) => effect());
    await vi.waitFor(() => expect(telemetry.captureMobileTelemetry).toHaveBeenCalledWith({ event: "plan_tab_viewed", surface: "plan_picker", tab: "monthly" }));
  });

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
    recorded.controls.find((control) => control.accessibilityRole === "button" && control.accessibilityLabel === undefined)?.onPress?.();
    expect(state.billing?.purchasePlan).toHaveBeenCalledWith(fixtureMonthly.id, undefined);
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/save-purchase"));
  });

  it("lets a guest restore purchases and open the purchase terms and privacy policy", () => {
    renderToStaticMarkup(<PlansScreen />);
    findControl("Restore purchases")?.onPress?.();
    expect(state.billing?.restorePurchases).toHaveBeenCalledOnce();
    findControl("Terms of use")?.onPress?.();
    expect(linking.openURL).toHaveBeenCalledWith("https://murmur.q9labs.ai/terms");
    findControl("Privacy policy")?.onPress?.();
    expect(linking.openURL).toHaveBeenCalledWith("https://murmur.q9labs.ai/privacy");
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

  it.each([["Terms of use", "terms"], ["Privacy policy", "privacy"]])("retains safe diagnostics when %s cannot open", async (label, target) => {

    const url = `https://murmur.q9labs.ai/${target}`;
    const failure = Object.assign(new Error(`Unable to open URL: ${url}`), { code: "EUNSPECIFIED" });
    linking.openURL.mockRejectedValueOnce(failure);
    renderToStaticMarkup(<PlansScreen />);

    findControl(label)?.onPress?.();

    await vi.waitFor(() => expect(sentry.captureException).toHaveBeenCalledOnce());
    expect(linking.openURL).toHaveBeenCalledWith(url);
    const hint = sentry.captureException.mock.calls[0]?.[1];
    // Keep the legal-link sanitization assertion local to this screen's failure path.
    // fallow-ignore-next-line code-duplication
    const event = sanitizeMobileEvent({
      ...hint,
      exception: { values: [{ value: failure.message }] },
      type: undefined,
    });
    expect(event.tags).toMatchObject({
      operation: "open_paywall_legal_link", stage: "billing", error_code: "EUNSPECIFIED",
      link_target: target, link_step: "open_url", link_failure: "native_open_rejected",
    });
    expect(event.fingerprint).toEqual(["open_paywall_legal_link", "billing", "EUNSPECIFIED"]);
    expect(JSON.stringify(event)).not.toContain(url);
    expect(JSON.stringify(event)).not.toContain("Unable to open URL");
  });
