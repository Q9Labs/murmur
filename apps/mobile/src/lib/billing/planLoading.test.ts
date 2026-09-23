import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ loadMurmurPlans: vi.fn() }));

vi.mock("./revenueCat", () => store);

import { loadPlansWithTelemetry } from "./planLoading";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loading plans", () => {
  it("records the paywall opening before waiting on the store", async () => {
    const report = vi.fn();
    let resolveStore: (plans: never[]) => void = () => undefined;
    store.loadMurmurPlans.mockReturnValue(new Promise((resolve) => {
      resolveStore = resolve;
    }));

    const pending = loadPlansWithTelemetry("launch", report);
    expect(report).toHaveBeenCalledWith("mobile_paywall_opened", { packageLabel: "plan_picker" });
    await vi.waitFor(() => expect(store.loadMurmurPlans).toHaveBeenCalledWith("launch"));
    resolveStore([]);
    await expect(pending).resolves.toEqual([]);
    expect(report).toHaveBeenCalledOnce();
  });

  it("records a failed paywall when the store cannot list plans", async () => {
    const report = vi.fn();
    store.loadMurmurPlans.mockRejectedValue(new Error("store down"));

    await expect(loadPlansWithTelemetry(null, report)).rejects.toThrow("store down");
    expect(report).toHaveBeenLastCalledWith("mobile_paywall_failed", { resultCategory: "store_error" });
  });
});
