import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureCustomer } from "../../screens/__tests__/billingFixture";
import { defaultAppConfig } from "./appConfig";

const api = vi.hoisted(() => ({
  fetchMurmurCustomer: vi.fn(),
  fetchMurmurAppConfig: vi.fn(),
}));
vi.mock("./customerApi", () => api);
vi.mock("./revenueCat", () => ({ configureRevenueCat: async () => false }));
vi.mock("../telemetry", () => ({ captureBillingTelemetry: vi.fn() }));
vi.mock("../observability/sentry", () => ({ captureMobileFailure: vi.fn() }));

import { MurmurBillingProvider, useMurmurBilling, type MurmurBillingContext } from "./context";

let billing: MurmurBillingContext;
const mounted: ReactTestRenderer[] = [];
function Probe() {
  billing = useMurmurBilling();
  return null;
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.fetchMurmurCustomer.mockResolvedValue({ ...fixtureCustomer, fulfillmentEnabled: false });
  api.fetchMurmurAppConfig.mockResolvedValue(defaultAppConfig);
  await act(async () => {
    mounted.push(create(<MurmurBillingProvider><Probe /></MurmurBillingProvider>));
  });
  await vi.waitFor(() => expect(billing.initialized).toBe(true));
});
afterEach(async () => {
  await act(async () => {
    for (const renderer of mounted.splice(0)) renderer.unmount();
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
