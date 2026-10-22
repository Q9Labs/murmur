// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseMobileTelemetryEvent, type MobileTelemetryRequest } from "@murmur/protocol/telemetry";

import { fixtureCustomer, fixturePack, fixtureYearly } from "../../screens/__tests__/billingFixture";
import { purchaseMode } from "../../screens/plans/purchaseMode";
import { initializeAnonymousAnalytics } from "../telemetry";
import { defaultAppConfig } from "./appConfig";

const api = vi.hoisted(() => ({
  fetchMurmurCustomer: vi.fn(),
  fetchMurmurAppConfig: vi.fn(),
  reconcileMurmurCustomer: vi.fn(),
}));
const store = vi.hoisted(() => ({ purchaseMurmurPlan: vi.fn() }));
const telemetry = vi.hoisted(() => ({
  deliverMobileTelemetryRequest: vi.fn<(request: MobileTelemetryRequest) => Promise<void>>(async () => undefined),
}));
vi.mock("./customerApi", () => api);
vi.mock("./revenueCat", () => ({ ...store, configureRevenueCat: async () => true }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { version: "1.2.0", ios: { buildNumber: "10" } } } }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("../anonymousAnalytics", () => ({ getAnonymousAnalyticsEnabled: async () => true }));
vi.mock("../installIdentity", () => ({ getOrCreateInstallId: async () => "install-id-123456" }));
vi.mock("../installAttribution", () => ({ captureInstallAttribution: vi.fn() }));
vi.mock("../replay", () => ({ setReplayAnalyticsEnabled: vi.fn() }));
vi.mock("../providers/mobileTelemetry", () => telemetry);
vi.mock("../observability/sentry", () => ({ captureMobileFailure: vi.fn() }));

import { MurmurBillingProvider, useMurmurBilling, type MurmurBillingContext } from "./context";

let billing: MurmurBillingContext;
const mounted: Root[] = [];
function Probe() {
  billing = useMurmurBilling();
  return null;
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.fetchMurmurCustomer.mockResolvedValue(fixtureCustomer);
  api.fetchMurmurAppConfig.mockResolvedValue(defaultAppConfig);
  api.reconcileMurmurCustomer.mockResolvedValue({ purchaseCount: 0, subscriptionCount: 0 });
  await initializeAnonymousAnalytics();
  await vi.waitFor(() => expect(telemetry.deliverMobileTelemetryRequest).toHaveBeenCalled());
  const root = createRoot(document.createElement("div"));
  mounted.push(root);
  await act(async () => {
    root.render(<MurmurBillingProvider><Probe /></MurmurBillingProvider>);
  });
  await vi.waitFor(() => expect(billing.initialized).toBe(true));
});
afterEach(async () => {
  await act(async () => {
    for (const root of mounted.splice(0)) root.unmount();
  });
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("billing refresh", () => {
  it("returns a loaded customer even when the parallel config request fails", async () => {
    const customer = { ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 0 };
    api.fetchMurmurCustomer.mockResolvedValue(customer);
    api.fetchMurmurAppConfig.mockRejectedValue(new Error("config unavailable"));
    await act(async () => {
      expect(await billing.refresh()).toEqual(customer);
    });
    expect(billing.customer).toEqual(customer);
    expect(billing.config).toEqual(defaultAppConfig);
    expect(billing.error).not.toBeNull();
    expect(billing.busy).toBe(false);
  });

  it("returns null and preserves the last customer when the customer request fails", async () => {
    const previous = billing.customer;
    api.fetchMurmurCustomer.mockRejectedValue(new Error("customer unavailable"));
    await act(async () => {
      expect(await billing.refresh()).toBeNull();
    });
    expect(billing.customer).toEqual(previous);
    expect(billing.error).not.toBeNull();
    expect(billing.busy).toBe(false);
  });
});

describe("checkout telemetry", () => {
  it("keeps active-offer redemption for sign-in checkout without plan metadata", async () => {
    const personalOffer = { offeringId: "personal-offer", expiresAt: new Date(Date.now() + 60_000).toISOString() };
    api.fetchMurmurAppConfig.mockResolvedValue({ ...defaultAppConfig, paywallOfferingId: personalOffer.offeringId, personalOffer });
    await act(async () => { expect(await billing.refresh()).toEqual(fixtureCustomer); });
    telemetry.deliverMobileTelemetryRequest.mockClear();
    store.purchaseMurmurPlan.mockResolvedValue("purchased");
    api.reconcileMurmurCustomer.mockResolvedValue({ purchaseCount: 1, subscriptionCount: 0 });
    await act(async () => { expect(await billing.purchasePlan(fixtureYearly.id, undefined, undefined)).toBe(true); });
    await vi.waitFor(() => expect(telemetry.deliverMobileTelemetryRequest).toHaveBeenCalledWith(expect.objectContaining({
      payload: { event: "offer_redeemed", offering_id: personalOffer.offeringId },
    })));
  }, 10_000);
  it("redeems an active personal offer only for a plan with an intro discount, not a pack", async () => {
    const personalOffer = { offeringId: "personal-offer", expiresAt: new Date(Date.now() + 60_000).toISOString() };
    api.fetchMurmurAppConfig.mockResolvedValue({ ...defaultAppConfig, paywallOfferingId: personalOffer.offeringId, personalOffer });
    await act(async () => {
      expect(await billing.refresh()).toEqual(fixtureCustomer);
    });
    telemetry.deliverMobileTelemetryRequest.mockClear();
    store.purchaseMurmurPlan.mockResolvedValue("purchased");
    const plans = [fixturePack, fixtureYearly, { ...fixtureYearly, introPrice: { amount: 79.99, price: "$79.99" } }];
    for (const [index, plan] of plans.entries()) {
      api.reconcileMurmurCustomer.mockResolvedValue({ purchaseCount: index + 1, subscriptionCount: 0 });
      const completed = vi.fn();
      await act(async () => {
        purchaseMode(billing, completed, "hard_paywall").onBuy(plan);
        await vi.waitFor(() => {
          expect(billing.error).toBeNull();
          expect(completed).toHaveBeenCalledOnce();
        }, { timeout: 6_000 });
      });
      const redemptions = () => telemetry.deliverMobileTelemetryRequest.mock.calls
        .filter(([request]) => request.payload.event === "offer_redeemed").map(([request]) => request.payload);
      if (plan.introPrice) {
        await vi.waitFor(() => expect(redemptions()).toEqual([{ event: "offer_redeemed", offering_id: personalOffer.offeringId }]));
      } else {
        expect(redemptions()).toEqual([]);
      }
    }
  }, 20_000);
  it.each([
    ["purchased", "mobile_checkout_succeeded"],
    ["cancelled", "mobile_checkout_cancelled"],
    ["failed", "mobile_checkout_failed"],
  ] as const)("labels a %s checkout with its purchase surface", async (outcome, event) => {
    await act(async () => {
      expect(await billing.refresh()).toEqual(fixtureCustomer);
    });
    for (const surface of ["hard_paywall", undefined] as const) {
      telemetry.deliverMobileTelemetryRequest.mockClear();
      if (outcome === "failed") store.purchaseMurmurPlan.mockRejectedValueOnce(new Error("store unavailable"));
      else store.purchaseMurmurPlan.mockResolvedValueOnce(outcome);
      api.reconcileMurmurCustomer.mockResolvedValue({ purchaseCount: surface ? 1 : 2, subscriptionCount: 0 });

      await act(async () => {
        expect(billing.customer).toEqual(fixtureCustomer);
        purchaseMode(billing, vi.fn(), surface).onBuy(fixtureYearly);
        await vi.waitFor(() => expect(store.purchaseMurmurPlan).toHaveBeenCalledWith(fixtureYearly.id, defaultAppConfig.paywallOfferingId));
        await vi.waitFor(() => expect(telemetry.deliverMobileTelemetryRequest).toHaveBeenCalledWith(expect.objectContaining({
          payload: expect.objectContaining({ event, package_label: surface ?? "plan_picker" }),
        })));
      });
      const request = telemetry.deliverMobileTelemetryRequest.mock.calls.find(([request]) => request.payload.event === event)?.[0];
      expect(parseMobileTelemetryEvent(request?.payload)).toMatchObject({ event, package_label: surface ?? "plan_picker" });
      if (outcome === "failed") {
        await vi.waitFor(() => expect(telemetry.deliverMobileTelemetryRequest).toHaveBeenCalledWith(expect.objectContaining({
          payload: expect.objectContaining({ event: "mobile_paywall_failed", package_label: surface ?? "plan_picker", result_category: "store_error" }),
        })));
      }
    }
  });
});
